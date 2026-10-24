import { useEffect, useState } from 'react'
import { CONSENT_TEXT, PURPOSES } from '../config'
import type { DeskPersona } from '../hooks/useDesk'
import type { IntakeInput } from '../types'

interface Props {
  personas: DeskPersona[]
  initialPersonaId: string | null
  onSubmit: (input: IntakeInput) => Promise<void>
  onCancel: () => void
}

export function IntakePane({ personas, initialPersonaId, onSubmit, onCancel }: Props) {
  const [personaId, setPersonaId] = useState<string>(initialPersonaId ?? '')
  const [purpose, setPurpose] = useState(PURPOSES[0])
  const [amount, setAmount] = useState('10000')
  const [income, setIncome] = useState('60000')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const p = personas.find((x) => x.personaId === personaId)
    if (!p) return
    setPurpose(p.defaults.purpose)
    setAmount(String(p.defaults.amountRequested))
    setIncome(String(p.defaults.statedIncome))
  }, [personaId, personas])

  const amountN = Number(amount)
  const incomeN = Number(income)
  const valid = personaId && purpose && amountN > 0 && incomeN > 0 && consent

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSubmit({ personaId, purpose, amountRequested: amountN, statedIncome: incomeN })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="intake" onSubmit={submit}>
      <h2>New application</h2>
      <div className="field">
        <span className="label">Persona card (the judge draws one)</span>
        <div className="persona-list" role="radiogroup" aria-label="Persona">
          {personas.map((p) => (
            <button
              key={p.personaId}
              type="button"
              role="radio"
              aria-checked={p.personaId === personaId}
              aria-pressed={p.personaId === personaId}
              className="persona-item"
              onClick={() => setPersonaId(p.personaId)}
            >
              <span className="mono">{p.personaId}</span>
              <span>{p.name}</span>
              <span className="hint">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="purpose">
          Loan purpose
        </label>
        <select id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          {PURPOSES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="amount">
            Amount requested (USD)
          </label>
          <input id="amount" className="mono" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        </div>
        <div className="field">
          <label className="label" htmlFor="income">
            Stated annual income (USD, self-reported)
          </label>
          <input id="income" className="mono" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ''))} />
        </div>
      </div>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{CONSENT_TEXT}</span>
      </label>
      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!valid || busy}>
          Submit application
        </button>
      </div>
    </form>
  )
}
