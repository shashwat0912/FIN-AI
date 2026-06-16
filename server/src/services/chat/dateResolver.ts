import { DateTime } from 'luxon';

export class DateResolver {
  resolveTimeRange(
    timeRange: string,
    userTimezone: string
  ): { startDate: Date; endDate: Date } {
    const now = DateTime.now().setZone(userTimezone);

    switch (timeRange) {
      case 'today':
        return {
          startDate: now.startOf('day').toJSDate(),
          endDate: now.endOf('day').toJSDate(),
        };
      case 'yesterday': {
        const yesterday = now.minus({ days: 1 });
        return {
          startDate: yesterday.startOf('day').toJSDate(),
          endDate: yesterday.endOf('day').toJSDate(),
        };
      }
      case 'this_week':
        return {
          startDate: now.startOf('week').toJSDate(),
          endDate: now.endOf('week').toJSDate(),
        };
      case 'last_week': {
        const lastWeek = now.minus({ weeks: 1 });
        return {
          startDate: lastWeek.startOf('week').toJSDate(),
          endDate: lastWeek.endOf('week').toJSDate(),
        };
      }
      case 'this_month':
        return {
          startDate: now.startOf('month').toJSDate(),
          endDate: now.endOf('month').toJSDate(),
        };
      case 'last_month': {
        const lastMonth = now.minus({ months: 1 });
        return {
          startDate: lastMonth.startOf('month').toJSDate(),
          endDate: lastMonth.endOf('month').toJSDate(),
        };
      }
      case 'this_year':
        return {
          startDate: now.startOf('year').toJSDate(),
          endDate: now.endOf('year').toJSDate(),
        };
      default:
        return {
          startDate: now.startOf('month').toJSDate(),
          endDate: now.toJSDate(),
        };
    }
  }

  resolveRelativeDate(dateStr: string, userTimezone: string): Date {
    const now = DateTime.now().setZone(userTimezone);
    const lower = dateStr.toLowerCase().trim();

    if (lower === 'today') return now.startOf('day').toJSDate();
    if (lower === 'yesterday') return now.minus({ days: 1 }).startOf('day').toJSDate();
    if (lower === 'day before yesterday') return now.minus({ days: 2 }).startOf('day').toJSDate();

    const daysAgoMatch = lower.match(/^(\d+)\s*days?\s*ago$/);
    if (daysAgoMatch) {
      return now.minus({ days: parseInt(daysAgoMatch[1]) }).startOf('day').toJSDate();
    }

    const parsed = DateTime.fromISO(dateStr, { zone: userTimezone });
    if (parsed.isValid) return parsed.toJSDate();

    return now.startOf('day').toJSDate();
  }
}
