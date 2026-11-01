export type ReportingPeriod = 'week' | 'current-month' | 'previous-month' | 'yearly';

export const REPORTING_PERIODS: ReadonlyArray<{ id: ReportingPeriod; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'current-month', label: 'Current Month' },
  { id: 'previous-month', label: 'Previous Month' },
  { id: 'yearly', label: 'Yearly' },
];

export type ReportingRange = { period: ReportingPeriod; label: string; start: string; end: string; granularity: 'day' | 'month' };

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lusaka', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function lusakaDateKey(now = new Date()): string {
  const parts = formatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function monthStart(dateKey: string): string { return `${dateKey.slice(0, 7)}-01`; }
function previousMonthStart(dateKey: string): string {
  const [year, month] = dateKey.slice(0, 7).split('-').map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
}
function mondayOffset(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return 1 - (dayOfWeek === 0 ? 7 : dayOfWeek);
}

// The canonical client contract is an Africa/Lusaka calendar interval [start, end).
export function reportingPeriodRange(period: ReportingPeriod, now = new Date()): ReportingRange {
  const today = lusakaDateKey(now);
  const currentMonthStart = monthStart(today);
  if (period === 'week') return { period, label: 'Week', start: addCalendarDays(today, mondayOffset(today)), end: addCalendarDays(today, 1), granularity: 'day' };
  if (period === 'previous-month') return { period, label: 'Previous Month', start: previousMonthStart(today), end: currentMonthStart, granularity: 'day' };
  if (period === 'yearly') return { period, label: 'Yearly', start: `${today.slice(0, 4)}-01-01`, end: addCalendarDays(today, 1), granularity: 'month' };
  return { period: 'current-month', label: 'Current Month', start: currentMonthStart, end: addCalendarDays(today, 1), granularity: 'day' };
}

