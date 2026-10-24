import { PERSONAS, EVAL_CASES } from '../src/mock/personas'
import { hardStop, underwrite, verifyReason, bundleAfterDispute } from '../src/mock/rules'
let ok = 0
for (const p of PERSONAS) {
  const hs = hardStop(p.bundle)
  const exp = EVAL_CASES.find(c => c.personaId === p.personaId)!.expected
  if (hs) { console.log(p.personaId, p.name, 'HARD_STOP', hs.field, exp === 'hard_stop' ? '' : '  <-- MISMATCH'); if (exp==='hard_stop') ok++; continue }
  let any = false
  const line = (['cu','fintech','prime'] as const).map(l => {
    const input = { bundle: p.bundle, ...p.defaults }
    const r = underwrite(l, input)
    if (r.decision === 'approve') { any = true; return `${l}:${r.classification.toUpperCase()} ${r.apr}%/${r.termMonths}/$${r.amount}` }
    const checks = r.reasons.map(x => `${x.field}${verifyReason(l, input, r.reasons, x.field).flipped ? '✓' : '✗'}`)
    return `${l}:deny[${checks.join(',')}]`
  })
  const got = any ? 'approve' : 'decline'
  if (got === exp) ok++
  console.log(p.personaId, p.name.padEnd(22), line.join('  '), got === exp ? '' : `  <-- MISMATCH exp ${exp}`)
}
console.log('agree', ok, '/', PERSONAS.length)
const p16 = PERSONAS.find(p => p.personaId === 'P16')!
const b2 = bundleAfterDispute(p16.bundle, 1)
console.log('P16 after dispute', b2.credit.fico9, b2.credit.utilization, (['cu','fintech','prime'] as const).map(l => underwrite(l, { bundle: b2, ...p16.defaults }).classification))
