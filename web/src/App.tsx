import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDesk } from './hooks/useDesk'
import { LENDERS, type IntakeInput } from './types'
import { useNow } from './hooks/useNow'
import { eventsFor, hardStopEvent, offersFor, originalOf, stepTimings } from './lib/select'
import { IN_FLIGHT, STATUS_TONE, STATUS_WORD } from './lib/status'
import { rankDecisions } from './lib/rank'
import { TopBar } from './components/TopBar'
import { Queue } from './components/Queue'
import { IntakePane } from './components/IntakePane'
import { PersonaDeck } from './components/PersonaDeck'
import { Waterfall } from './components/Waterfall'
import { BeforeCard, OfferCard } from './components/OfferCard'
import { HardStopCard } from './components/HardStopCard'
import { Inspector, type InspectorTab } from './components/Inspector'
import { Drawer } from './components/Drawer'
import { ApplicantView } from './components/ApplicantView'

type Theme = 'tag' | 'dark' | 'light'

export default function App() {
  const desk = useDesk()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [intakePersona, setIntakePersona] = useState<string | null>(null)
  const [deckOpen, setDeckOpen] = useState(false)
  const [applicantView, setApplicantView] = useState(false)
  const [tab, setTab] = useState<InspectorTab>('offer')
  const [theme, setTheme] = useState<Theme>('tag')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

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

  // Keyboard: A approves the best offer for the selected applicant, X declines, N jumps to the top of the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (intakeOpen || deckOpen || desk.replaying || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        if (ranked[0]) select(ranked[0].applicant._id)
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
    <div className="app">
      <TopBar
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
      <div className="main">
        <Queue
          applicants={desk.applicants}
          offers={desk.offers}
          selectedId={intakeOpen ? null : selectedId}
          onSelect={select}
          onNew={() => openIntake(null)}
          onApproveBest={(aid, oid) => void quickApprove(aid, oid)}
          onDecline={(aid) => void quickDecline(aid)}
          disabled={desk.replaying}
        />

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
                      <span className="muted">
                        {applicant.purpose} · <span className="mono">${applicant.amountRequested.toLocaleString('en-US')}</span>
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
                <Waterfall applicant={applicant} steps={steps} offers={offers} checks={desk.reasonChecks.filter((c) => c.applicantId === selectedId)} now={now} />
                <div className="board-scroll">
                <div className={`columns ${original ? 'diff' : ''}`}>
                  {LENDERS.map((l, i) => {
                    const o = offers.find((x) => x.lender === l.id)
                    return (
                      <div key={`h-${l.id}`} className="col-head">
                        <span className="letter">{'ABC'[i]}</span>
                        <span className="nm">{l.label}</span>
                        <span className="chips">
                          {o?.status === 'done' && <span className="chip">{(o.latencyMs! / 1000).toFixed(1)}s</span>}
                          {o?.status === 'done' && <span className="chip">{o.reasons.length} reasons</span>}
                          {!o && <span className="chip">{l.policy.toLowerCase()}</span>}
                        </span>
                      </div>
                    )
                  })}
                  {original && (
                    <>
                      <div className="diff-label section-label">Before dispute · {original.name}</div>
                      {LENDERS.map((l) => (
                        <BeforeCard key={`b-${l.id}`} lender={l.id} offer={beforeOffers.find((x) => x.lender === l.id)} />
                      ))}
                      <div className="diff-label section-label">After re-pull · changed values highlighted</div>
                    </>
                  )}
                  {applicant?.status === 'hard_stop' ? (
                    <HardStopCard event={hs} />
                  ) : (
                    LENDERS.map((l) => {
                      const o = offers.find((x) => x.lender === l.id)
                      const chosen = !!decision?.chosenOfferId && o?._id === decision.chosenOfferId
                      return (
                        <OfferCard
                          key={l.id}
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
                          canSelect={!!applicant && applicant.status === 'awaiting_human'}
                          onSelect={() => {
                            if (!o) return
                            setSelectedOfferId((cur) => (cur === o._id ? null : o._id))
                            setTab('offer')
                          }}
                          onTrace={() => setTab('trace')}
                        />
                      )
                    })
                  )}
                </div>
                </div>
            </div>
          )}
          <Drawer
            events={desk.auditEvents}
            applicants={desk.applicants}
            selectedId={selectedId}
            evalRuns={desk.evalRuns}
            evalCases={desk.evalCases.length}
            onRunEval={desk.runEval}
          />
        </main>

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
      {deckOpen && <PersonaDeck personas={desk.personas} onPick={(id) => openIntake(id)} onClose={() => setDeckOpen(false)} />}
    </div>
  )
}
