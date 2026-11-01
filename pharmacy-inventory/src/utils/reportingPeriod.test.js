import { reportingPeriodRange } from './reportingPeriod';

describe('reportingPeriodRange', () => {
  // This instant is a Sunday evening in Lusaka, while it is still Sunday in
  // UTC, so it confirms the calendar derives from the business time zone.
  const lusakaSunday = new Date('2026-03-29T20:30:00.000Z');

  it('uses Monday through the current Lusaka day for Week', () => {
    expect(reportingPeriodRange('week', lusakaSunday)).toMatchObject({
      start: '2026-03-23', end: '2026-03-30', granularity: 'day',
    });
  });

  it('uses calendar-month boundaries rather than rolling 30-day windows', () => {
    expect(reportingPeriodRange('current-month', lusakaSunday)).toMatchObject({
      start: '2026-03-01', end: '2026-03-30', granularity: 'day',
    });
    expect(reportingPeriodRange('previous-month', lusakaSunday)).toMatchObject({
      start: '2026-02-01', end: '2026-03-01', granularity: 'day',
    });
  });

  it('uses a calendar year with monthly analytics', () => {
    expect(reportingPeriodRange('yearly', lusakaSunday)).toMatchObject({
      start: '2026-01-01', end: '2026-03-30', granularity: 'month',
    });
  });
});

