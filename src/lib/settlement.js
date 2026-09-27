// Regra do acerto (docs/spec.md). Pure: no Supabase, no Vue.
// expenses: rows (only scope 'house' count), each with its own share_pct {user_id: pct}; members: [{ user_id }];
// settlements: rows for the same month [{ from_id, to_id, amount_cents }].
export function computeSettlement({ expenses = [], members = [], settlements = [] }) {
  const per = {}
  for (const m of members) per[m.user_id] = { due: 0, paid: 0, balance: 0 }
  let total = 0

  for (const e of expenses) {
    if (e.scope !== 'house') continue
    const amount = e.amount_cents
    total += amount
    const pct = (id) => Number(e.share_pct?.[id] ?? 0)
    let assigned = 0
    for (const m of members) {
      const due = Math.round((amount * pct(m.user_id)) / 100)
      per[m.user_id].due += due
      assigned += due
    }
    // Rounding leftover (+/- 1 cent) stays with whoever paid.
    per[e.paid_by].due += amount - assigned
    per[e.paid_by].paid += amount
  }

  const net = {}
  for (const id in per) {
    per[id].balance = per[id].paid - per[id].due
    net[id] = per[id].balance
  }
  let settled = 0
  for (const s of settlements) {
    net[s.from_id] += s.amount_cents
    net[s.to_id] -= s.amount_cents
    settled += s.amount_cents
  }

  // ponytail: two-member household, so one debtor and one creditor.
  const ids = Object.keys(net).sort((a, b) => net[a] - net[b])
  const from = ids[0]
  const to = ids[ids.length - 1]
  const transfer = ids.length > 1 && net[from] < 0 ? { from_id: from, to_id: to, amount_cents: -net[from] } : null

  return { total, perMember: per, settled, transfer }
}
