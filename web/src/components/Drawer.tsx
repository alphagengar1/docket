import { useState } from 'react'
import type { Applicant, AuditEvent, EvalRun } from '../types'
import { clockMs, pct } from '../lib/format'
import { newestFirst } from '../lib/select'

export type DrawerTab = 'audit' | 'eval'

interface Props {
  events: AuditEvent[]
  applicants: Applicant[]
  selectedId: string | null
  evalRuns: EvalRun[]
  evalCases: number
  onRunEval: () => Promise<void>
}

export function Drawer({ events, applicants, selectedId, evalRuns, evalCases, onRunEval }: Props) {
  const [tab, setTab] = useState<DrawerTab>('audit')
  const [open, setOpen] = useState(true)
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
    <section className={`drawer ${open ? '' : 'collapsed'}`} aria-label="Audit log and eval">
      <div className="drawer-bar">
        <div role="tablist" style={{ display: 'flex', gap: 2 }}>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'audit'} onClick={() => { setTab('audit'); setOpen(true) }}>
            Audit log <span className="mono muted">{events.length}</span>
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'eval'} onClick={() => { setTab('eval'); setOpen(true) }}>
            Eval {last && <span className={`mono ${last.finishedAt == null ? 'muted' : last.agreement >= 0.9 ? 'tone-approve' : 'tone-decline'}`}>{last.finishedAt == null ? '…' : pct(last.agreement)}</span>}
          </button>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        {tab === 'audit' && open && (
          <button type="button" className="ghost tab" onClick={() => setScope((s) => (s === 'all' ? 'this' : 'all'))} disabled={!selectedId}>
            {scope === 'all' ? 'All applicants' : 'This applicant'}
          </button>
        )}
        {tab === 'eval' && open && (
          <button type="button" className="tab" onClick={run} disabled={running} style={{ border: '1px solid var(--hair)' }}>
            {running ? 'Running…' : 'Run eval'}
          </button>
        )}
        <button type="button" className="ghost tab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {open && (
        <div className="drawer-body">
          {tab === 'audit' && (
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Time</th>
                  <th style={{ width: 140 }}>Applicant</th>
                  <th style={{ width: 130 }}>Actor</th>
                  <th style={{ width: 170 }}>Action</th>
                  <th style={{ width: 180 }}>Ref</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={e._id} className={`${e.applicantId === selectedId ? 'hi' : ''} ${i === 0 ? 'enter' : ''}`}>
                    <td className="mono muted">{clockMs(e.at)}</td>
                    <td>{names.get(e.applicantId) ?? e.applicantId}</td>
                    <td className="mono">{e.actor}</td>
                    <td className="mono">{e.action}</td>
                    <td className="mono muted">{e.ref ?? ''}</td>
                    <td title={e.note}>{e.note}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No events yet.
                    </td>
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
  return (
    <div className="eval">
      <div className="stat">
        <div className="v mono">{pending ? sk(40) : last.cases}</div>
        <div className="k">Cases{!last && ` (${cases} loaded)`}</div>
      </div>
      <div className="stat">
        <div className={`v mono ${!pending && last.agreement < 0.9 ? 'tone-decline' : ''}`}>{pending ? sk(56) : pct(last.agreement)}</div>
        <div className="k">Agreement with answer key</div>
      </div>
      <div className="stat">
        <div className={`v ${pending ? '' : last.fraudZeroOffers ? 'tone-approve' : 'tone-hard'}`}>
          {pending ? sk(40) : <span className="check">{last.fraudZeroOffers ? 'Yes' : 'No'}</span>}
        </div>
        <div className="k">Fraud personas got zero offers</div>
      </div>
      <div className="stat">
        <div className="v mono">{pending ? sk(40) : last.avgReasonsPerDenial.toFixed(2)}</div>
        <div className="k">Avg reasons per denial (≥ 2)</div>
      </div>
      <div className="stat" style={{ padding: 0, border: 'none' }}>
        <div className="k" style={{ padding: '0 0 4px' }}>
          Failures {last && !pending ? `· ${last.failures.length}` : ''}
          {last && (
            <span className="mono"> · started {new Date(last.startedAt).toLocaleTimeString('en-US', { hour12: false })}</span>
          )}
        </div>
        {pending ? (
          <div className="failures">
            <li style={{ listStyle: 'none' }}>{sk(200)}</li>
          </div>
        ) : last.failures.length === 0 ? (
          <div className="muted">None.</div>
        ) : (
          <ul className="failures">
            {last.failures.map((f, i) => (
              <li key={i}>
                <span className="mono">{f.personaId}</span>
                <span className="mono muted">exp {f.expected}</span>
                <span className="mono tone-decline">got {f.got}</span>
                <span style={{ whiteSpace: 'normal' }}>{f.why}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
