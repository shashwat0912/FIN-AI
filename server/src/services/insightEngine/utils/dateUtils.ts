import { TimeWindow } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

export function startOfDay(date: Date): Date {
  const next = cloneDate(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = cloneDate(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function getRollingDayWindow(reference: Date, days: number, offsetDays = 0, label = `${days}d`): TimeWindow {
  const end = endOfDay(addDays(reference, -offsetDays));
  const start = startOfDay(addDays(end, -(days - 1)));

  return { label, start, end };
}

export function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diffFromMonday = day === 0 ? 6 : day - 1;
  return addDays(next, -diffFromMonday);
}

export function endOfWeek(date: Date): Date {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function getCurrentWeekToDateWindow(reference: Date): TimeWindow {
  return {
    label: 'current_week_to_date',
    start: startOfWeek(reference),
    end: endOfDay(reference),
  };
}

export function getPreviousWeekWindow(reference: Date): TimeWindow {
  const currentWeekStart = startOfWeek(reference);
  const previousWeekStart = addDays(currentWeekStart, -7);

  return {
    label: 'previous_week',
    start: previousWeekStart,
    end: endOfDay(addDays(previousWeekStart, 6)),
  };
}

export function getPreviousWeekWindows(reference: Date, count: number): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const currentWeekStart = startOfWeek(reference);

  for (let i = 1; i <= count; i += 1) {
    const start = addDays(currentWeekStart, -7 * i);
    windows.push({
      label: `week_minus_${i}`,
      start,
      end: endOfDay(addDays(start, 6)),
    });
  }

  return windows;
}

export function getElapsedWeekDays(reference: Date): number {
  const currentWeekStart = startOfWeek(reference);
  const diffMs = endOfDay(reference).getTime() - currentWeekStart.getTime();
  return Math.max(1, Math.floor(diffMs / DAY_MS) + 1);
}

export function projectToFullWeek(currentWeekSpend: number, reference: Date): number {
  const elapsedDays = getElapsedWeekDays(reference);
  return (currentWeekSpend / elapsedDays) * 7;
}
