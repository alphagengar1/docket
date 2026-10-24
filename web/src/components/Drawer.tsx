import { useState } from 'react'
import type { Applicant, AuditEvent, EvalRun } from '../types'
import { clockMs, pct } from '../lib/format'
import { newestFirst } from '../lib/select'
import { ACTOR_COLOR } from './Inspector'

export type DrawerTab = 'audit' | 'eval'

interface Props {
  events: AuditEvent[]
  applicants: Applicant[]
  selectedId: string | null
  evalRuns: EvalRun[]
  evalCases: number
  onRunEval: () => Promise<void>
  /** Closes the drawer's slot (the rail also toggles it). */
  onClose: () => void
  /** Opens the assistant with a summary of the selected applicant. */
  onAsk: () => void
}

/** Respan log table for the audit log; Laminar eval list for eval metrics. */
export function Drawer({ events, applicants, selectedId, evalRuns, evalCases, onRunEval, onClose, onAsk }: Props) {
  const [tab, setTab] = useState<DrawerTab>('audit')
  const open = true
  const [scope, setScope] = useState<'this' | 'all'>('all')
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      await onRunEval()
    } finally {
      setRunning(false)
    }
  }

  const names = new Map(applicants.map((a) => [a._id, a.name]))
  const rows = newestFirst(scope === 'this' && selectedId ? events.filter((e) => e.applicantId === selectedId) : events).slice(0, 400)
  const last = evalRuns.slice().sort((a, b) => b.startedAt - a.startedAt)[0]

  return (
    <section className="drawer" aria-label="Audit log and eval">
      <div className="drawer-bar">
        <div role="tablist" style={{ display: 'flex', gap: 2 }}>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'audit'} onClick={() => { setTab('audit')}}>
            Audit log <span className="chip">{events.length}</span>
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'eval'} onClick={() => { setTab('eval')}}>
            Eval{' '}
            {last && (
              <span className={`chip ${last.finishedAt == null ? '' : last.agreement >= 0.9 ? 'tone-approve' : 'tone-decline'}`}>{last.finishedAt == null ? '…' : pct(last.agreement)}</span>
            )}
          </button>
        </div>
        {selectedId && (
          <button type="button" className="link ast-link" onClick={onAsk}>
            Ask the assistant to summarize
          </button>
        )}
        <span style={{ flex: 1 }} />
        {tab === 'audit' && open && (
          <button type="button" className="ghost tab" onClick={() => setScope((s) => (s === 'all' ? 'this' : 'all'))} disabled={!selectedId}>
            {scope === 'all' ? 'All applicants' : 'This applicant'}
          </button>
        )}
        {tab === 'eval' && open && (
          <button type="button" className="tab" onClick={run} disabled={running} style={{ border: '1px solid var(--hair-2)' }}>
            {running ? 'Running…' : 'Run eval'}
          </button>
        )}
        <button type="button" className="ghost tab" onClick={onClose}>
          Close
        </button>
      </div>
      {open && (
        <div className="drawer-body">
          {tab === 'audit' && (
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 118 }}>Time</th>
                  <th style={{ width: 150 }}>Applicant</th>
                  <th style={{ width: 140 }}>Actor</th>
                  <th style={{ width: 170 }}>Action</th>
                  <th style={{ width: 190 }}>Ref</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={e._id} className={`${e.applicantId === selectedId ? 'hi' : ''} ${i === 0 ? 'enter' : ''}`}>
                    <td>{clockMs(e.at)}</td>
                    <td className="t" style={{ fontFamily: 'var(--sans)' }}>
                      {names.get(e.applicantId) ?? e.applicantId}
                    </td>
                    <td className="actor t" style={{ ['--actor' as string]: ACTOR_COLOR[e.actor] }}>
                      {e.actor}
                    </td>
                    <td className="t">{e.action}</td>
                    <td>{e.ref ?? ''}</td>
                    <td title={e.note} style={{ fontFamily: 'var(--sans)' }}>
                      {e.note}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>No events yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {tab === 'eval' && <EvalPanel last={last} cases={evalCases} running={running} />}
        </div>
      )}
    </section>
  )
}

function EvalPanel({ last, cases, running }: { last: EvalRun | undefined; cases: number; running: boolean }) {
  const pending = !last || last.finishedAt == null || running
  const sk = (w: number) => <span className="skel" style={{ width: w, height: 20 }} />
  const score = (ok: boolean) => ({ ['--score' as string]: ok ? 'var(--approve)' : 'var(--hard)' })
  return (
    <div className="eval">
      <div className="agg">
        <span className="v mono">{pending ? sk(80) : pct(last.agreement)}</span>
        <span className="k">agreement · {last ? last.cases : cases} cases</span>
      </div>
      <div className="stat" style={pending ? undefined : score(last.fraudZeroOffers)}>
        <div className="v">{pending ? sk(40) : last.fraudZeroOffers ? 'Yes' : 'No'}</div>
        <div className="k">Fraud personas got zero offers</div>
      </div>
      <div className="stat" style={pending ? undefined : score(last.avgReasonsPerDenial >= 2)}>
        <div className="v mono">{pending ? sk(40) : last.avgReasonsPerDenial.toFixed(2)}</div>
        <div className="k">Reasons per denial (≥ 2)</div>
      </div>
      <div className="stat" style={pending ? undefined : score((last.reasonsVerified ?? 0) >= 0.8)}>
        <div className="v mono">{pending ? sk(56) : last.reasonsVerified == null ? '—' : pct(last.reasonsVerified)}</div>
        <div className="k">Reasons verified by counterfactual</div>
      </div>
      <div className="stat" style={pending ? undefined : score(last.failures.length === 0)}>
        <div className="v mono">{pending ? sk(40) : last.failures.length}</div>
        <div className="k">Failures{last ? ` · started ${new Date(last.startedAt).toLocaleTimeString('en-US', { hour12: false })}` : ''}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        {pending ? (
          <ul className="failures">
            <li>{sk(200)}</li>
          </ul>
        ) : last.failures.length === 0 ? (
          <div className="muted">No failures.</div>
        ) : (
          <ul className="failures">
            {last.failures.map((f, i) => (
              <li key={i}>
                <span className="mono">{f.personaId}</span>
                <span className="chip">exp {f.expected}</span>
                <span className="chip tone-decline">got {f.got}</span>
                <span style={{ whiteSpace: 'normal' }}>{f.why}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
