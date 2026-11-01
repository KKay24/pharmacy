import { useMemo, useState } from 'react';

export const REPORTING_PERIODS = Object.freeze([
  { id: 'week', label: 'Week' },
  { id: 'current-month', label: 'Current Month' },
  { id: 'previous-month', label: 'Previous Month' },
  { id: 'yearly', label: 'Yearly' },
]);

const LUSAKA_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lusaka', year: 'numeric', month: '2-digit', day: '2-digit',
});

function formatParts(date) {
  const parts = LUSAKA_FORMATTER.formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return { year: value('year'), month: value('month'), day: value('day') };
}

export function lusakaDateKey(now = new Date()) {
  const { year, month, day } = formatParts(now);
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekday(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function monthStart(dateKey) { return `${dateKey.slice(0, 7)}-01`; }
function previousMonthStart(dateKey) {
  const [year, month] = dateKey.slice(0, 7).split('-').map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
}

// Every range is a Lusaka calendar interval [start, end), including the
// ongoing day but never the following day. The values are API-ready date keys.
export function reportingPeriodRange(period, now = new Date()) {
  const today = lusakaDateKey(now);
  const currentMonthStart = monthStart(today);
  switch (period) {
    case 'week':
      return { period, label: 'Week', start: addCalendarDays(today, 1 - weekday(today)), end: addCalendarDays(today, 1), granularity: 'day' };
    case 'previous-month':
      return { period, label: 'Previous Month', start: previousMonthStart(today), end: currentMonthStart, granularity: 'day' };
    case 'yearly':
      return { period, label: 'Yearly', start: `${today.slice(0, 4)}-01-01`, end: addCalendarDays(today, 1), granularity: 'month' };
    case 'current-month':
    default:
      return { period: 'current-month', label: 'Current Month', start: currentMonthStart, end: addCalendarDays(today, 1), granularity: 'day' };
  }
}

export function useReportingPeriod(initialPeriod = 'current-month') {
  const [period, setPeriod] = useState(initialPeriod);
  const range = useMemo(() => reportingPeriodRange(period), [period]);
  return { period, setPeriod, range, periods: REPORTING_PERIODS };
}

