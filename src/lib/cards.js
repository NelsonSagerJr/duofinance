import { addMonths, monthOf, dueDate } from './month.js'

// Invoice a purchase lands on, as the month the invoice closes ('YYYY-MM-01'). Purchases on or after the
// closing day go to next month's invoice (closing day 31 = last day of short months).
export function invoiceMonth(spentOn, closingDay) {
  const month = monthOf(spentOn)
  return spentOn >= dueDate(month, closingDay) ? addMonths(month, 1) : month
}

// Splits total cents into n installments; the first one takes the leftover cents.
export function splitInstallments(total, n) {
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, k) => base + (k === 0 ? total - base * n : 0))
}

// Date of installment k (0-based): same day k months later, clamped to the month's last day.
export const installmentDate = (date, k) => dueDate(addMonths(monthOf(date), k), Number(date.slice(8, 10)))

// What a tagged expense costs me on my card: personal or paid by me = all of it; split at the till = my share.
export const cardAmount = (e, myShare) => (e.scope === 'house' && e.paid_by === null ? myShare : e.amount_cents)

export const installmentLabel = (e) => (e.installment_count ? ` (${e.installment_no}/${e.installment_count})` : '')
