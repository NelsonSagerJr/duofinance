// Regra do acerto (docs/spec.md). Pure: no Supabase, no Vue.
// expenses: rows (only scope 'house' count), each with its own share_pct {user_id: pct}; members: [{ user_id }];
// settlements: rows for the same month [{ from_id, to_id, amount_cents }].

// Each member's share of one house expense, in cents, summing exactly to the amount.
// Rounding leftover (+/- 1 cent) stays with whoever paid; "Dividido na hora" (paid_by null) gives it to the
// first member, so the parts still add up.
export function dueByMember(e, members) {
  const due = {}
  let assigned = 0
  for (const m of members) {
    due[m.user_id] = Math.round((e.amount_cents * Number(e.share_pct?.[m.user_id] ?? 0)) / 100)
    assigned += due[m.user_id]
  }
  const rest = e.paid_by && e.paid_by in due ? e.paid_by : members[0]?.user_id
  if (rest) due[rest] += e.amount_cents - assigned
  return due
}

export function computeSettlement({ expenses = [], members = [], settlements = [] }) {
  const per = {}
  for (const m of members) per[m.user_id] = { due: 0, paid: 0, balance: 0 }
  let total = 0

  for (const e of expenses) {
    if (e.scope !== 'house') continue
    total += e.amount_cents
    const due = dueByMember(e, members)
    for (const id in due) {
      per[id].due += due[id]
      // Dividido na hora: everyone paid their own part at the till, so it nets to zero.
      if (!e.paid_by) per[id].paid += due[id]
    }
    if (e.paid_by) per[e.paid_by].paid += e.amount_cents
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
