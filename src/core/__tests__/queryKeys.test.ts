/**
 * One cache entry, one way to fill it.
 *
 * TanStack Query keeps one result per key. Two screens that share a key but
 * fetch different ranges overwrite each other: Home once cached October only
 * up to today, and the attendance calendar, reading the same key, lost the
 * holidays and leave still to come. A month of attendance is fetched through
 * `monthPeriodQuery` in api/attendance.ts and nowhere else.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SRC = join(fileURLToPath(new URL('../../', import.meta.url)));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') out.push(...sources(full));
    } else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('query keys', () => {
  it('fetches a month of attendance only through monthPeriodQuery', () => {
    const offenders = sources(SRC)
      .filter((file) => !file.endsWith(join('api', 'attendance.ts')))
      .filter((file) => /\[\s*'attendance'\s*,\s*'period'/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(SRC, ''));
    assert.deepEqual(offenders, [], 'use monthPeriodQuery(month) from api/attendance.ts');
  });

  it('asks for the whole month, not up to today', () => {
    const source = readFileSync(join(SRC, 'api', 'attendance.ts'), 'utf8');
    assert.match(source, /attendanceApi\.period\(firstOfMonth\(month\), lastOfMonth\(month\)\)/);
  });
});
