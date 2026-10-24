import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDesk } from './hooks/useDesk'
import { LENDERS, type IntakeInput } from './types'
import { useNow } from './hooks/useNow'
import { summarize } from './lib/summary'
import { stopLabel } from '../../convex/labels'
import { eventsFor, hardStopEvent, offersFor, originalOf, stepTimings } from './lib/select'
import { IN_FLIGHT, STATUS_TONE, STATUS_WORD } from './lib/status'
import { rankDecisions } from './lib/rank'
import { TopBar } from './components/TopBar'
import { DecisionSummary, lenderMeta, lenderTone } from './components/DecisionSummary'
import { Disclose, DiscloseGroup, Mono } from './components/Disclose'
import { ApplicantFacts } from './components/ApplicantFacts'
import { Queue } from './components/Queue'
import { IntakePane } from './components/IntakePane'
import { PersonaDeck } from './components/PersonaDeck'
import { Waterfall } from './components/Waterfall'
import { PipelineStrip } from './components/PipelineStrip'
import { BeforeCard, OfferCard } from './components/OfferCard'
import { HardStopCard } from './components/HardStopCard'
import { Inspector, type InspectorTab } from './components/Inspector'
import { Drawer } from './components/Drawer'
import { ApplicantView } from './components/ApplicantView'
import { DecisionSheet } from './components/DecisionSheet'
import { Rail, type PanelId } from './components/Rail'
import { Assistant } from './components/Assistant'
import { useAssistant } from './hooks/useAssistant'

type Theme = 'tag' | 'dark' | 'light'

const PANEL_KEY = 'docket.panels'
const NO_PANELS: Record<PanelId, boolean> = { queue: false, inspector: false, log: false, assistant: false }
function loadPanels(): Record<PanelId, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}') as Partial<Record<PanelId, unknown>>
    return {
      queue: raw.queue === true,
      inspector: raw.inspector === true,
      log: raw.log === true,
      assistant: raw.assistant === true,
    }
  } catch {
    return NO_PANELS
  }
}

export default function App() {
  const desk = useDesk()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [intakePersona, setIntakePersona] = useState<string | null>(null)
  const [deckOpen, setDeckOpen] = useState(false)
  const [applicantView, setApplicantView] = useState(false)
  const [tab, setTab] = useState<InspectorTab>('offer')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('tag')
  // Focus (default): only what the decision needs. Detail: every panel, the timing waterfall and the log.
  const [focus, setFocus] = useState<boolean>(() => {
    try {
      return localStorage.getItem('docket.focus') !== 'off'
    } catch {
      return true
    }
  })
  const [timing, setTiming] = useState(false)
  // Editor-style chrome: every side panel starts hidden and slides in when toggled or needed.
  const [panels, setPanels] = useState<Record<PanelId, boolean>>(loadPanels)
  const [summonKey, setSummonKey] = useState(0)
  const assistantApi = useAssistant()
  const setPanel = useCallback((id: PanelId, on: boolean) => setPanels((p) => (p[id] === on ? p : { ...p, [id]: on })), [])
  const togglePanel = useCallback((id: PanelId) => setPanels((p) => ({ ...p, [id]: !p[id] })), [])
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify(panels))
    } catch {
      /* storage blocked: panel state just does not persist */
    }
  }, [panels])
  const inspect = useCallback((t: InspectorTab) => {
    setTab(t)
    setPanel('inspector', true)
  }, [setPanel])
  const changeFocus = (v: boolean) => {
    setFocus(v)
    if (!v) setPanels((p) => ({ ...p, inspector: true, log: true }))
  }
  // Cmd/Ctrl+1..4 toggle queue, inspector, log, assistant.
  useEffect(() => {
    const ids: PanelId[] = ['queue', 'inspector', 'log', 'assistant']
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const i = ['1', '2', '3', '4'].indexOf(e.key)
      if (i < 0) return
      e.preventDefault()
      togglePanel(ids[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePanel])
  // The queue slides open when an applicant newly reaches "awaiting_human" and nothing else is open.
  const prevStatus = useRef(new Map<string, string>())
  useEffect(() => {
    let arrived = false
    for (const a of desk.applicants) {
      const before = prevStatus.current.get(a._id)
      if (before !== undefined && before !== 'awaiting_human' && a.status === 'awaiting_human') arrived = true
      prevStatus.current.set(a._id, a.status)
    }
    if (arrived) setPanels((p) => (Object.values(p).some(Boolean) ? p : { ...p, queue: true }))
  }, [desk.applicants])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    try {
      localStorage.setItem('docket.focus', focus ? 'on' : 'off')
    } catch {
      /* private window or blocked storage: the preference just does not persist */
    }
  }, [focus])

  // Follow the newest applicant when nothing is selected (replay mode relies on this).
  useEffect(() => {
    if (desk.applicants.length === 0) {
      if (selectedId) setSelectedId(null)
      return
    }
    if (!selectedId || !desk.applicants.some((a) => a._id === selectedId)) {
      const newest = desk.applicants.slice().sort((a, b) => b.createdAt - a.createdAt)[0]
      setSelectedId(newest._id)
    }
  }, [desk.applicants, selectedId])

  const applicant = desk.applicants.find((a) => a._id === selectedId)
  const original = originalOf(desk.applicants, applicant)
  const bundle = desk.bundles.find((b) => b.applicantId === selectedId)
  const offers = useMemo(() => offersFor(desk.offers, selectedId), [desk.offers, selectedId])
  const beforeOffers = useMemo(() => offersFor(desk.offers, original?._id ?? null), [desk.offers, original])
  const events = useMemo(() => eventsFor(desk.auditEvents, selectedId), [desk.auditEvents, selectedId])
  const notice = desk.notices.find((n) => n.applicantId === selectedId)
  const decision = desk.decisions.find((d) => d.applicantId === selectedId)
  const steps = useMemo(() => stepTimings(applicant, events), [applicant, events])
  const inFlight = desk.applicants.filter((a) => IN_FLIGHT.includes(a.status)).length
  const running = !!applicant && (IN_FLIGHT.includes(applicant.status) || applicant.status === 'awaiting_human')
  const now = useNow(running)

  const selectedOffer = offers.find((o) => o._id === selectedOfferId && o.decision === 'approve')
  const bestApr = offers.reduce<number | null>((m, o) => (o.status === 'done' && o.apr != null && (m == null || o.apr < m) ? o.apr : m), null)
  const underwriteStart = steps.find((s) => s.id === 'underwrite')?.startedAt ?? null

  const onSubmit = useCallback(
    async (input: IntakeInput) => {
      const id = await desk.createApplicant(input)
      setSelectedId(id)
      setSelectedOfferId(null)
      setIntakeOpen(false)
      setTab('offer')
    },
    [desk],
  )

  const openIntake = (personaId: string | null) => {
    setIntakePersona(personaId)
    setIntakeOpen(true)
    setDeckOpen(false)
  }

  const select = (id: string) => {
    setSelectedId(id)
    setSelectedOfferId(null)
    setIntakeOpen(false)
  }
  const open = (id: string) => {
    select(id)
    setSheetOpen(true)
  }

  const stopReasons = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of desk.auditEvents) if (e.action === 'rules.hard_stop' || e.action === 'hard_stop') m[e.applicantId] = e.note || stopLabel(e.ref ?? '')
    return m
  }, [desk.auditEvents])
  const hs = applicant?.status === 'hard_stop' ? hardStopEvent(events) : undefined

  // Ranked decision queue: after a quick approve/decline, move to the next applicant waiting on a human.
  const ranked = useMemo(() => rankDecisions(desk.applicants, desk.offers), [desk.applicants, desk.offers])
  const advanceFrom = useCallback(
    (id: string) => {
      const rest = ranked.filter((r) => r.applicant._id !== id)
      if (rest.length) {
        setSelectedId(rest[0].applicant._id)
        setSelectedOfferId(null)
        setTab('offer')
      }
    },
    [ranked],
  )
  const quickApprove = useCallback(
    async (applicantId: string, offerId: string) => {
      await desk.approveOffer(applicantId, offerId, 'approved from queue (best APR)')
      advanceFrom(applicantId)
    },
    [desk, advanceFrom],
  )
  const quickDecline = useCallback(
    async (applicantId: string) => {
      await desk.declineApplicant(applicantId, 'declined from queue')
      advanceFrom(applicantId)
    },
    [desk, advanceFrom],
  )

  // Sheet navigation walks the sidebar order: decisions first (ranked), then everything else newest first.
  const walkOrder = useMemo(() => {
    const ids = new Set(ranked.map((r) => r.applicant._id))
    const rest = desk.applicants.filter((a) => !ids.has(a._id)).sort((a, b) => b.createdAt - a.createdAt)
    return [...ranked.map((r) => r.applicant), ...rest]
  }, [ranked, desk.applicants])
  const walkIndex = walkOrder.findIndex((a) => a._id === selectedId)
  const walk = (delta: number) => {
    if (!walkOrder.length) return
    const i = walkIndex < 0 ? 0 : (walkIndex + delta + walkOrder.length) % walkOrder.length
    setSelectedId(walkOrder[i]._id)
    setSelectedOfferId(null)
  }

  // Keyboard: A approves the best offer for the selected applicant, X declines, N jumps to the top of the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (intakeOpen || deckOpen || desk.replaying || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        if (ranked[0]) open(ranked[0].applicant._id)
        return
      }
      if (k === 'enter' && selectedId && !sheetOpen) {
        setSheetOpen(true)
        return
      }
      const cur = ranked.find((r) => r.applicant._id === selectedId)
      if (!cur) return
      if (k === 'a' && cur.best) void quickApprove(cur.applicant._id, cur.best._id)
      if (k === 'x') void quickDecline(cur.applicant._id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (applicantView) {
    return <ApplicantView applicant={applicant} offers={offers} notice={notice} decision={decision} onBack={() => setApplicantView(false)} />
  }

  return (
    <div className={`app ${focus ? 'focus' : ''}`}>
      <TopBar
        focus={focus}
        onFocus={changeFocus}
        onNew={() => openIntake(null)}
        sandbox={desk.sandbox}
        onReset={desk.resetBoard ? () => { if (window.confirm('Reset the board? This deletes every applicant.')) { setSelectedId(null); setSelectedOfferId(null); void desk.resetBoard?.() } } : undefined}
        connection={desk.connection}
        inFlight={inFlight}
        replaying={desk.replaying}
        view={applicantView ? 'applicant' : 'desk'}
        onView={(v) => setApplicantView(v === 'applicant')}
        onDeck={() => setDeckOpen(true)}
        onReplay={() => {
          setSelectedId(null)
          setSelectedOfferId(null)
          setIntakeOpen(false)
          desk.startReplay()
        }}
        onStopReplay={() => {
          setSelectedId(null)
          desk.stopReplay()
        }}
        theme={theme}
        onTheme={() => setTheme((t) => (t === 'tag' ? 'dark' : t === 'dark' ? 'light' : 'tag'))}
      />
      <div className={`main ${Object.values(panels).some(Boolean) ? '' : 'bare'}`}>
        <Rail side="left" items={['queue']} open={panels} onToggle={togglePanel} waiting={ranked.length} />
        <div className={`slot slot-q ${panels.queue ? 'open' : ''}`}>
          <div className="slot-in" style={{ width: 'var(--queue-w)' }}>
            <Queue
              applicants={desk.applicants}
              offers={desk.offers}
              selectedId={intakeOpen ? null : selectedId}
              onSelect={open}
              onNew={() => openIntake(null)}
              onApproveBest={(aid, oid) => void quickApprove(aid, oid)}
              onDecline={(aid) => void quickDecline(aid)}
              disabled={desk.replaying}
              stopReasons={stopReasons}
              bundles={desk.bundles}
              notices={desk.notices}
              decisions={desk.decisions}
              auditEvents={desk.auditEvents}
              reasonChecks={desk.reasonChecks}
            />
          </div>
        </div>

        <main className="pane work" aria-label="Work surface">
          {intakeOpen ? (
            <div className="pane-body">
              <IntakePane personas={desk.personas} initialPersonaId={intakePersona} onSubmit={onSubmit} onCancel={() => setIntakeOpen(false)} />
            </div>
          ) : (
            <div className="board">
                <div className="board-head">
                  {applicant ? (
                    <>
                      <h2>{applicant.name}</h2>
                      <span className={`status tone-${STATUS_TONE[applicant.status]} ${IN_FLIGHT.includes(applicant.status) ? 'live' : ''}`}>
                        {STATUS_WORD[applicant.status]}
                      </span>
                      {original && (
                        <span className="muted">
                          · replay after dispute ·{' '}
                          <button type="button" className="link" onClick={() => select(original._id)}>
                            view original
                          </button>
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="muted">No applicant selected</h2>
                      <span className="muted">Choose one from the queue, or start a new application.</span>
                    </>
                  )}
                </div>
                {applicant && !intakeOpen && <ApplicantFacts a={applicant} />}
                {focus && (
                  <PipelineStrip
                    applicant={applicant}
                    steps={steps}
                    offers={offers}
                    checks={desk.reasonChecks.filter((c) => c.applicantId === selectedId)}
                    now={now}
                    timingOpen={timing}
                    onTiming={() => setTiming((t) => !t)}
                  />
                )}
                {(!focus || timing) && (
                  <Waterfall applicant={applicant} steps={steps} offers={offers} checks={desk.reasonChecks.filter((c) => c.applicantId === selectedId)} now={now} />
                )}
                <div className="board-scroll">
                {applicant && (
                  <DecisionSummary
                    applicant={applicant}
                    offers={offers}
                    hardStop={hs}
                    canDecide={applicant.status === 'awaiting_human' && !desk.replaying}
                    onApprove={(oid) => void quickApprove(applicant._id, oid)}
                    onDecline={() => void quickDecline(applicant._id)}
                    checks={desk.reasonChecks}
                    bundle={bundle}
                    notice={notice}
                    events={events}
                  />
                )}
                {!applicant && !intakeOpen && (
                  <div className="columns" aria-label="Lenders on this desk">
                    {LENDERS.map((l, i) => (
                      <div key={`h-${l.id}`} className="col-head">
                        <span className="letter">{'ABCDE'[i]}</span>
                        <span className="nm">{l.label}</span>
                      </div>
                    ))}
                    {LENDERS.map((l) => (
                      <OfferCard
                        key={l.id}
                        lender={l.id}
                        offer={undefined}
                        checks={[]}
                        bestApr={null}
                        underwriteStartedAt={null}
                        now={now}
                        selected={false}
                        chosen={false}
                        dim={false}
                        canSelect={false}
                        onSelect={() => {}}
                        onTrace={() => {}}
                        compact={focus}
                      />
                    ))}
                  </div>
                )}
                {applicant && applicant.status !== 'hard_stop' && (() => {
                  // One disclosure row per lender: the glance sentence from summarize(), the card underneath.
                  // The group's Expand all / Collapse all opens every row and the count reads "N of 5 open".
                  const sm = summarize(applicant, offers, hs, desk.reasonChecks)
                  return (
                    <section className="lg" aria-label="Lender decisions">
                      <p className="lg-glance">{sm.lenderGlance}</p>
                      <DiscloseGroup title="Lender decisions">
                        {original && (
                          <div className="diff-label section-label">
                            Before dispute · {original.name} (left card) · after re-pull on the right, changed values highlighted
                          </div>
                        )}
                        {LENDERS.map((l, i) => {
                          const o = offers.find((x) => x.lender === l.id)
                          const line = sm.lenders.find((x) => x.lender === l.id)!
                          const chosen = !!decision?.chosenOfferId && o?._id === decision.chosenOfferId
                          const latency = o?.status === 'done' && o.latencyMs != null ? `${(o.latencyMs / 1000).toFixed(1)}s · ` : ''
                          return (
                            <Disclose
                              key={`${applicant._id}-${l.id}`}
                              id={`lg-${l.id}`}
                              tone={lenderTone(line)}
                              defaultOpen={!!original}
                              summary={
                                <>
                                  <span className="lg-letter" aria-hidden="true">{'ABCDEFGH'[i] ?? i + 1}</span>
                                  {line.sentence}
                                </>
                              }
                              meta={<Mono>{latency}{o ? lenderMeta(line) : l.policy.toLowerCase()}</Mono>}
                              detail={
                                <div className={`lg-cell ${original ? 'diff' : ''}`}>
                                  {original && <BeforeCard lender={l.id} offer={beforeOffers.find((x) => x.lender === l.id)} after={o} checks={desk.reasonChecks} />}
                                  <OfferCard
                                    lender={l.id}
                                    offer={o}
                                    checks={desk.reasonChecks}
                                    bestApr={bestApr}
                                    before={original ? beforeOffers.find((x) => x.lender === l.id) : undefined}
                                    underwriteStartedAt={underwriteStart}
                                    now={now}
                                    selected={!!o && o._id === selectedOfferId}
                                    chosen={chosen}
                                    dim={!!decision && !chosen}
                                    canSelect={applicant.status === 'awaiting_human'}
                                    onSelect={() => {
                                      if (!o) return
                                      setSelectedOfferId((cur) => (cur === o._id ? null : o._id))
                                      setTab('offer')
                                    }}
                                    onTrace={() => inspect('trace')}
                                    compact={focus}
                                  />
                                </div>
                              }
                            />
                          )
                        })}
                      </DiscloseGroup>
                    </section>
                  )
                })()}
                {applicant?.status === 'hard_stop' && (
                  <div className="columns">
                    <HardStopCard event={hs} events={events} applicant={applicant} />
                  </div>
                )}
                </div>
            </div>
          )}
          <Rail side="bottom" items={['log']} open={panels} onToggle={togglePanel} waiting={ranked.length} count={desk.auditEvents.length} />
          <div className={`slot-h ${panels.log ? 'open' : ''}`}>
            <Drawer
              events={desk.auditEvents}
              applicants={desk.applicants}
              selectedId={selectedId}
              evalRuns={desk.evalRuns}
              evalCases={desk.evalCases.length}
              onRunEval={desk.runEval}
              onClose={() => setPanel('log', false)}
              onAsk={() => {
                setPanel('assistant', true)
                setSummonKey((k) => k + 1)
              }}
            />
          </div>
        </main>

        <div className={`slot slot-i ${panels.inspector ? 'open' : ''}`}>
          <div className="slot-in" style={{ width: 'var(--inspector-w)' }}>
            <Inspector
              applicant={applicant}
              original={original}
              bundle={bundle}
              offers={offers}
              notice={notice}
              decision={decision}
              events={events}
              checks={desk.reasonChecks}
              selectedOffer={selectedOffer}
              tab={tab}
              onTab={setTab}
              compact={focus}
              onApprove={async () => {
                if (applicant && selectedOffer) await desk.approveOffer(applicant._id, selectedOffer._id)
              }}
              onDecline={async (note) => {
                if (applicant) await desk.declineApplicant(applicant._id, note)
              }}
              onDispute={async (index) => {
                if (!applicant) return
                const id = await desk.disputeTradeline(applicant._id, index)
                setSelectedId(id)
                setSelectedOfferId(null)
                setTab('offer')
              }}
            />
          </div>
        </div>
        <div className={`slot slot-a ${panels.assistant ? 'open' : ''}`}>
          <div className="slot-in" style={{ width: 'var(--assistant-w)' }}>
            <Assistant api={assistantApi} applicant={applicant} summonKey={summonKey} />
          </div>
        </div>
        <Rail side="right" items={['inspector', 'assistant']} open={panels} onToggle={togglePanel} waiting={ranked.length} />
      </div>
      {sheetOpen && applicant && (
        <DecisionSheet
          applicant={applicant}
          offers={offers}
          checks={desk.reasonChecks}
          events={events}
          notice={notice}
          decision={decision}
          bundle={bundle}
          now={now}
          underwriteStartedAt={underwriteStart}
          position={{ index: Math.max(0, walkIndex), total: walkOrder.length }}
          selectedOfferId={selectedOfferId}
          onSelectOffer={(id) => setSelectedOfferId((cur) => (cur === id ? null : id))}
          onPrev={() => walk(-1)}
          onNext={() => walk(1)}
          onClose={() => setSheetOpen(false)}
          onApprove={(offerId) => void quickApprove(applicant._id, offerId)}
          onDecline={() => void quickDecline(applicant._id)}
          onInspect={(t) => {
            inspect(t)
            setSheetOpen(false)
          }}
        />
      )}
      {deckOpen && <PersonaDeck personas={desk.personas} onPick={(id) => openIntake(id)} onClose={() => setDeckOpen(false)} />}
    </div>
  )
}
