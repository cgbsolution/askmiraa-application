import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { payYears } from '../pay.ts';

const slip = (id: string, year: number, month: number, gross: string, deductions: string, net: string, run_type = 'regular') => ({
  id,
  period_year: year,
  period_month: month,
  run_type,
  gross_earnings: gross,
  total_deductions: deductions,
  net_pay: net,
});

describe('payslips by financial year', () => {
  it('splits at April and lists the newest year first, months April onward', () => {
    const years = payYears([
      slip('a', 2026, 9, '43627.00', '1859.00', '41768.00'),
      slip('b', 2026, 4, '46859.00', '1979.00', '44880.00'),
      slip('c', 2026, 3, '40000.00', '1500.00', '38500.00'),
    ]);
    assert.deepEqual(years.map((y) => y.fy), ['2026-27', '2025-26']);
    assert.deepEqual(years[0]!.months.map((m) => m.key), ['2026-04', '2026-09']);
  });

  it('adds up the year to date exactly, with no float drift', () => {
    const [year] = payYears([
      slip('a', 2026, 4, '0.10', '0.00', '0.10'),
      slip('b', 2026, 5, '0.20', '0.00', '0.20'),
    ]);
    assert.equal(year!.ytd.net, '0.30');
    assert.equal(year!.ytd.count, 2);
  });

  it('puts a supplementary run in the same month as the regular one', () => {
    const [year] = payYears([slip('a', 2026, 9, '1000.00', '100.00', '900.00'), slip('b', 2026, 9, '500.00', '0.00', '500.00', 'supplementary')]);
    assert.equal(year!.months.length, 1);
    assert.equal(year!.months[0]!.net, '1400.00');
    assert.equal(year!.months[0]!.slips.length, 2);
  });

  it('is empty with no payslips', () => {
    assert.deepEqual(payYears([]), []);
  });
});
