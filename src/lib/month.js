// Months are 'YYYY-MM-01' strings (same shape as the bill_month / month date columns). Local time, no UTC surprises.
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (m) => {
  const [y, mo] = m.split('-').map(Number)
  return [y, mo - 1]
}

export function todayISO() {
  return iso(new Date())
}

export function monthOf(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date.slice(0, 10) + 'T12:00:00') : date
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}

export const currentMonth = () => monthOf(new Date())

export function addMonths(m, n) {
  const [y, mo] = parse(m)
  return iso(new Date(y, mo + n, 1))
}
export const prevMonth = (m) => addMonths(m, -1)
export const nextMonth = (m) => addMonths(m, 1)

export function monthLabel(m) {
  const [y, mo] = parse(m)
  const name = new Date(y, mo, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`
}

// { start, end } with end EXCLUSIVE: query spent_on >= start and spent_on < end.
export function monthRange(m) {
  return { start: m, end: nextMonth(m) }
}

export function daysInMonth(m) {
  const [y, mo] = parse(m)
  return new Date(y, mo + 1, 0).getDate()
}

// Due date of a bill in month m, clamping day 31 to the month's last day.
export function dueDate(m, day) {
  return `${m.slice(0, 8)}${pad(Math.min(day, daysInMonth(m)))}`
}

// Default date for a new entry while viewing month m: today if it's in m, else the 1st of m.
export const defaultDate = (m) => (monthOf(todayISO()) === m ? todayISO() : m)
