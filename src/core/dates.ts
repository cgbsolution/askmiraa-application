/**
 * Calendar dates as the backend sends them ("2026-10-26"), handled without
 * time zones. `new Date("2026-10-26")` is midnight UTC — the 25th in the
 * evening anywhere west of Greenwich — so date-only values never go through
 * Date parsing here; they are split into numbers.
 */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d/;

export function parseISODate(value: string | null | undefined): YMD | null {
  if (!value) return null;
  // A timestamp ("2026-10-25T20:30:00Z") is a moment, and its day is the
  // local one: 20:30 UTC is already the 26th in India. Cutting the first ten
  // characters would give the UTC day.
  if (TIMESTAMP.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
  }
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** The local calendar day of a date or a timestamp, as "YYYY-MM-DD". */
export function localDay(value: string | null | undefined): string | null {
  const ymd = parseISODate(value);
  return ymd ? toISODate(ymd) : null;
}

export function toISODate({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** A local Date's calendar day as "YYYY-MM-DD". */
export function isoFromDate(date: Date): string {
  return toISODate({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() });
}

/** Local midnight of a date string, for date pickers. */
export function dateFromISO(value: string): Date {
  const ymd = parseISODate(value);
  if (!ymd) return new Date(NaN);
  return new Date(ymd.y, ymd.m - 1, ymd.d);
}

export function todayISO(now: Date = new Date()): string {
  return isoFromDate(now);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day of week, 0 = Sunday. */
export function weekday(value: string): number {
  const ymd = parseISODate(value);
  if (!ymd) return -1;
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

export function addDays(value: string, days: number): string {
  const ymd = parseISODate(value);
  if (!ymd) return value;
  const date = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return toISODate({ y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() });
}

export function addMonths(value: string, months: number): string {
  const ymd = parseISODate(value);
  if (!ymd) return value;
  const total = ymd.y * 12 + (ymd.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return toISODate({ y, m, d: Math.min(ymd.d, daysInMonth(y, m)) });
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const x = parseISODate(a);
  const y = parseISODate(b);
  if (!x || !y) return NaN;
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86_400_000);
}

export function firstOfMonth(value: string): string {
  const ymd = parseISODate(value);
  return ymd ? toISODate({ ...ymd, d: 1 }) : value;
}

export function lastOfMonth(value: string): string {
  const ymd = parseISODate(value);
  return ymd ? toISODate({ ...ymd, d: daysInMonth(ymd.y, ymd.m) }) : value;
}

/** Monday of the week the date falls in (timesheets run Monday to Sunday). */
export function startOfWeek(value: string): string {
  const day = weekday(value);
  if (day < 0) return value;
  return addDays(value, day === 0 ? -6 : 1 - day);
}

export interface CalendarCell {
  date: string;
  day: number;
  inMonth: boolean;
}

/**
 * The weeks of a month for a calendar grid, Monday first, padded with the
 * neighbouring months' days so every week has seven cells.
 */
/**
 * A month as full weeks. Weeks start on Monday unless `weekStartsOn` is 0
 * (Sunday), which the attendance calendar uses — S M T W T F S, as HR teams
 * read it on their older HRMS.
 */
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 1): CalendarCell[][] {
  const first = toISODate({ y: year, m: month, d: 1 });
  let cursor = weekStartsOn === 0 ? addDays(first, -Math.max(0, weekday(first))) : startOfWeek(first);
  const last = toISODate({ y: year, m: month, d: daysInMonth(year, month) });
  const weeks: CalendarCell[][] = [];
  while (diffDays(cursor, last) >= 0) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const ymd = parseISODate(cursor)!;
      week.push({ date: cursor, day: ymd.d, inMonth: ymd.m === month && ymd.y === year });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** "26 Oct 2026". */
export function formatDate(value: string | null | undefined): string {
  const ymd = parseISODate(value);
  if (!ymd) return '—';
  return `${ymd.d} ${MONTHS[ymd.m - 1]} ${ymd.y}`;
}

/** "26 Oct" (the year is dropped when it is this year). */
export function formatDateShort(value: string | null | undefined, now: Date = new Date()): string {
  const ymd = parseISODate(value);
  if (!ymd) return '—';
  return ymd.y === now.getFullYear() ? `${ymd.d} ${MONTHS[ymd.m - 1]}` : `${ymd.d} ${MONTHS[ymd.m - 1]} ${ymd.y}`;
}

/** "Mon, 26 Oct". */
export function formatDayLabel(value: string | null | undefined, now: Date = new Date()): string {
  const day = value ? weekday(value) : -1;
  if (day < 0) return '—';
  return `${WEEKDAYS[day]}, ${formatDateShort(value, now)}`;
}

/** "October 2026". */
export function formatMonth(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

/** "26 Oct – 28 Oct", "26 Oct" for one day. */
export function formatRange(start: string, end: string, now: Date = new Date()): string {
  if (!end || start === end) return formatDateShort(start, now);
  return `${formatDateShort(start, now)} – ${formatDateShort(end, now)}`;
}

/** A timestamp's local time, "09:05". */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * A clock reading as the portal's punch card shows it: "11:13:57 pm", or
 * "11:13 pm" without seconds. Takes a Date or an ISO timestamp (read in the
 * phone's time zone).
 */
export function formatClock(value: Date | string | null | undefined, seconds = true): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const h24 = date.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${h12}:${mm}${seconds ? `:${ss}` : ''} ${h24 < 12 ? 'am' : 'pm'}`;
}

/** A timestamp as "26 Oct, 09:05". */
export function formatDateTime(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDateShort(isoFromDate(date), now)}, ${formatTime(value)}`;
}

/** "Today", "Yesterday", "2 days ago", or the date — for a timestamp. */
export function relativeDay(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const gap = diffDays(isoFromDate(date), isoFromDate(now));
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Yesterday';
  if (gap > 1 && gap < 7) return `${gap} days ago`;
  return formatDateShort(isoFromDate(date), now);
}

/** "2 min ago", "3 h ago", or the relative day. */
export function timeAgo(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return '—';
  const minutes = Math.floor((now.getTime() - at) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && isoFromDate(new Date(at)) === isoFromDate(now)) return `${hours} h ago`;
  return relativeDay(value, now);
}

/** Minutes as "7h 30m". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`;
}

/** "Good morning" etc., for the Home greeting. */
export function greetingFor(now: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The Indian financial year a date falls in, April to March, in the two
 * spellings the modules use: tax "2026-27", reimbursements "2026-2027".
 */
export function financialYear(value: string, style: 'short' | 'long' = 'short'): string {
  const ymd = parseISODate(value);
  if (!ymd) return '';
  const start = ymd.m >= 4 ? ymd.y : ymd.y - 1;
  return style === 'short' ? `${start}-${String((start + 1) % 100).padStart(2, '0')}` : `${start}-${start + 1}`;
}

/** Whether a <= b, for date strings. */
export function onOrBefore(a: string, b: string): boolean {
  return diffDays(a, b) >= 0;
}

/**
 * Server messages carry dates as 2026-10-26; people read 26 Oct 2026.
 * Only whole ISO dates are rewritten, and only real ones: a reference like
 * "LR-2026-10-261" or an impossible 2026-13-40 is left alone.
 */
export function readableDates(message: string): string {
  return message.replace(/(?<![\w-])(\d{4})-(\d{2})-(\d{2})(?![\w-]|T\d)/g, (whole) => (parseISODate(whole) ? formatDate(whole) : whole));
}
