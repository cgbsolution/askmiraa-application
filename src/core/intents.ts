/**
 * "Apply leave for Friday" → an action chip that opens the leave form,
 * pre-filled.
 *
 * Miraa's lookups are read-only. People will still ask it to *do* things, so
 * the phone recognises a handful of intents in what they typed (or what Miraa
 * replied) and offers a chip under the reply. The chip opens the normal form
 * with what could be read unambiguously from the words; the person reviews it
 * and submits through the module's own endpoint, as themselves. Nothing is
 * ever submitted from here.
 *
 * Dates are only filled when they are unambiguous. "Friday" is the coming
 * Friday (today, if today is Friday); "next Friday" is the coming Friday after
 * today; 26/10 is day/month, as written in India.
 */

import { addDays, diffDays, parseISODate, toISODate, weekday } from './dates.ts';
import type { RouteName } from './routes.ts';

export type IntentKey =
  | 'apply_leave'
  | 'regularise'
  | 'new_expense'
  | 'raise_ticket'
  | 'payslip'
  | 'form16'
  | 'tax_declaration'
  | 'give_shoutout';

export interface Intent {
  key: IntentKey;
  label: string;
  route: RouteName;
  params: Record<string, string>;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};
const DAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

const MONTH_NAMES = Object.keys(MONTHS).join('|');
const DAY_NAMES = Object.keys(DAYS).join('|');

/** One date expression, as an ISO date, or null when it is not one or is ambiguous. */
export function parseDateWords(text: string, today: string): string | null {
  const s = text.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  if (/^today$/.test(s)) return today;
  if (/^tomorrow$/.test(s)) return addDays(today, 1);
  if (/^(the )?day after tomorrow$/.test(s)) return addDays(today, 2);
  if (/^yesterday$/.test(s)) return addDays(today, -1);

  const day = new RegExp(`^(this |coming |next )?(${DAY_NAMES})$`).exec(s);
  if (day) {
    const target = DAYS[day[2]!]!;
    const now = weekday(today);
    let ahead = (target - now + 7) % 7;
    if (day[1]?.trim() === 'next' && ahead === 0) ahead = 7;
    return addDays(today, ahead);
  }

  const year = parseISODate(today)!.y;
  const pick = (d: number, m: number, y?: number) => {
    const candidate = toISODate({ y: y ?? year, m, d });
    if (!parseISODate(candidate)) return null;
    // Without a year, a date more than two months back means next year.
    if (y === undefined && diffDays(candidate, today) > 62) return toISODate({ y: year + 1, m, d });
    return candidate;
  };

  let match = new RegExp(`^(\\d{1,2}) (${MONTH_NAMES})(?: (\\d{4}))?$`).exec(s);
  if (match) return pick(Number(match[1]), MONTHS[match[2]!]!, match[3] ? Number(match[3]) : undefined);
  match = new RegExp(`^(${MONTH_NAMES}) (\\d{1,2})(?:,? (\\d{4}))?$`).exec(s);
  if (match) return pick(Number(match[2]), MONTHS[match[1]!]!, match[3] ? Number(match[3]) : undefined);
  match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
  if (match) {
    const y = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : undefined;
    return pick(Number(match[1]), Number(match[2]), y);
  }
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (match) return parseISODate(s) ? s : null;
  return null;
}

const DATE_TOKEN = `(?:today|tomorrow|(?:the )?day after tomorrow|yesterday|(?:this |coming |next )?(?:${DAY_NAMES})|\\d{1,2}(?:st|nd|rd|th)? (?:${MONTH_NAMES})(?: \\d{4})?|(?:${MONTH_NAMES}) \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{4}-\\d{2}-\\d{2})`;

export interface DateRange {
  start: string;
  end: string;
}

/** A single day or a range in free text: "from 3 nov to 5 nov", "friday", "tomorrow for 2 days". */
export function parseRange(text: string, today: string): DateRange | null {
  const s = text.toLowerCase();
  const range = new RegExp(`(?:from )?(${DATE_TOKEN})\\s*(?:to|till|until|-|–|through)\\s*(${DATE_TOKEN})`).exec(s);
  if (range) {
    const start = parseDateWords(range[1]!, today);
    let end = parseDateWords(range[2]!, today);
    if (start && end) {
      // "28 dec to 2 jan" crosses a year.
      if (diffDays(start, end) < 0) {
        const bumped = parseISODate(end)!;
        end = toISODate({ ...bumped, y: bumped.y + 1 });
      }
      return diffDays(start, end) >= 0 && diffDays(start, end) <= 92 ? { start, end } : null;
    }
  }
  const single = new RegExp(`(?:^|\\b|\\s)(${DATE_TOKEN})(?:\\b|$)`).exec(s);
  if (!single) return null;
  const start = parseDateWords(single[1]!, today);
  if (!start) return null;
  const forDays = /\bfor (\d{1,2}|one|two|three|four|five) days?\b/.exec(s);
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const count = forDays ? Number(words[forDays[1]!] ?? forDays[1]) : 1;
  return { start, end: addDays(start, Math.max(count, 1) - 1) };
}

/** An amount in rupees in free text: "₹1,250", "1250 rs", "Rs. 300.50". */
export function parseAmount(text: string): string | null {
  const match = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs|rupees|inr|\/-)/i.exec(text);
  const raw = (match?.[1] ?? match?.[2])?.replace(/,/g, '');
  return raw && Number(raw) > 0 ? raw : null;
}

const RULES: { key: IntentKey; label: string; route: RouteName; test: RegExp }[] = [
  {
    key: 'apply_leave',
    label: 'Apply leave',
    route: 'ApplyLeave',
    test: /\b(apply|take|need|want|book|request|put in|mark)\b[^.?!]*\b(leave|day off|days off|off|vacation|holiday|sick)\b|\b(sick|casual|earned|privilege) leave\b.*\b(on|for|from|tomorrow|today)\b|\bleave (on|for|from|tomorrow|today)\b/i,
  },
  {
    key: 'regularise',
    label: 'Regularise attendance',
    route: 'Regularise',
    test: /\bregulari[sz]|\bmissed (my )?punch|\bforgot to (punch|clock|check)|\b(fix|correct|wrong)\b[^.?!]*\battendance\b/i,
  },
  {
    key: 'new_expense',
    label: 'New expense',
    route: 'NewExpense',
    test: /\b(raise|new|submit|file|add|make|claim|create)\b[^.?!]*\b(expense|reimbursement|bill|receipt)s?\b|\bclaim\b[^.?!]*\b(travel|taxi|cab|food|meal|fuel|mileage)\b/i,
  },
  {
    key: 'raise_ticket',
    label: 'Raise a ticket',
    route: 'NewTicket',
    test: /\b(raise|open|create|log|file|submit|make)\b[^.?!]*\b(ticket|issue|complaint|request to (it|hr))\b|\bhelpdesk ticket\b/i,
  },
  { key: 'form16', label: 'Form 16', route: 'Form16', test: /\bform[\s-]?16\b/i },
  {
    key: 'payslip',
    label: 'Open payslips',
    route: 'Payslips',
    test: /\b(download|show|view|get|send|open|need|see)\b[^.?!]*\b(pay ?slip|salary slip|pay stub)s?\b/i,
  },
  {
    key: 'tax_declaration',
    label: 'Tax declarations',
    route: 'TaxDeclarations',
    test: /\b(tax declaration|investment declaration|investment proof|declare\b[^.?!]*\b(80c|hra|rent|investment))|\b80c\b/i,
  },
  {
    key: 'give_shoutout',
    label: 'Give a shoutout',
    route: 'GiveShoutout',
    test: /\b(shout ?out|kudos|appreciate|thank)\b[^.?!]*\b(to|for)\b|\bgive\b[^.?!]*\bshout ?out\b/i,
  },
];

/** The action chips for a turn: what the person asked, then what Miraa said. At most two. */
export function matchIntents(userText: string, replyText = '', today: string): Intent[] {
  const found: Intent[] = [];
  for (const rule of RULES) {
    const source = rule.test.test(userText) ? userText : rule.test.test(replyText) ? replyText : null;
    if (!source) continue;
    found.push({ key: rule.key, label: rule.label, route: rule.route, params: prefillFor(rule.key, userText || source, today) });
    if (found.length === 2) break;
  }
  return found;
}

function prefillFor(key: IntentKey, text: string, today: string): Record<string, string> {
  const params: Record<string, string> = {};
  const s = text.toLowerCase();
  if (key === 'apply_leave') {
    const range = parseRange(text, today);
    if (range) Object.assign(params, range);
    if (/\bhalf[\s-]?day\b/.test(s)) {
      params.halfDay = '1';
      if (/\b(first half|morning)\b/.test(s)) params.session = 'first_half';
      if (/\b(second half|afternoon|evening)\b/.test(s)) params.session = 'second_half';
    }
    const kind = /\b(sick|casual|earned|privilege|comp[\s-]?off|maternity|paternity|bereavement)\b/.exec(s);
    if (kind) params.kind = kind[1]!.replace(/\s|-/g, '');
    const reason = /\b(?:because|as|since|for)\s+(?:i |my |of )?([a-z][^.?!]{3,80})$/.exec(s);
    // A "reason" that is itself a date ("for Friday") is the date, not a reason.
    if (reason && !/\bdays?\b/.test(reason[1]!) && !parseRange(reason[1]!, today)) params.reason = reason[1]!.trim();
  }
  if (key === 'regularise') {
    const range = parseRange(text, today);
    if (range) params.date = range.start;
  }
  if (key === 'new_expense') {
    const amount = parseAmount(text);
    if (amount) params.amount = amount;
    const range = parseRange(text, today);
    if (range) params.date = range.start;
  }
  if (key === 'raise_ticket') {
    const about = /\b(?:about|for|regarding|re:?)\s+(.{4,120})$/i.exec(text.trim());
    if (about) params.subject = about[1]!.replace(/[.?!]+$/, '');
  }
  return params;
}
