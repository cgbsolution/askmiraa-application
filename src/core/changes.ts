/**
 * What a profile change request changes, field by field, for the person to
 * read before HR decides: "Last name: Shah → Shah-Mehta".
 */

export interface FieldChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

const ACRONYMS = new Set(['pan', 'uan', 'ifsc', 'esic', 'pf', 'id', 'dob', 'upi']);

function humanise(key: string): string {
  const words = key
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length === 1 ? '1 entry' : `${value.length} entries`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return '…';
  return String(value);
}

/** Changed fields, one level into nested objects ("Current · City"). */
export function changeDiff(proposed: Record<string, unknown>, current: Record<string, unknown> | null | undefined, prefix = ''): FieldChange[] {
  const out: FieldChange[] = [];
  const before = current ?? {};
  for (const [key, to] of Object.entries(proposed ?? {})) {
    const from = before[key];
    const label = prefix ? `${prefix} · ${humanise(key)}` : humanise(key);
    if (to && typeof to === 'object' && !Array.isArray(to) && !prefix) {
      out.push(...changeDiff(to as Record<string, unknown>, (from ?? {}) as Record<string, unknown>, humanise(key)));
      continue;
    }
    if (JSON.stringify(to ?? null) === JSON.stringify(from ?? null)) continue;
    out.push({ key: prefix ? `${prefix}.${key}` : key, label, from: show(from), to: show(to) });
  }
  return out;
}
