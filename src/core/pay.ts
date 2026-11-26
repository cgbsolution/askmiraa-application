/**
 * Payslips by financial year, as the older HRMS's payslip screen read them:
 * a year switch, net pay month by month, and year-to-date totals. Amounts
 * stay decimal strings (core/money.ts); nothing is added up in floats.
 */

import { financialYear } from './dates.ts';
import { sumDecimals } from './money.ts';

export interface SlipSummary {
  id: string;
  period_year: number;
  period_month: number;
  run_type: string;
  gross_earnings: string;
  total_deductions: string;
  net_pay: string;
}

export interface PayMonth<T extends SlipSummary = SlipSummary> {
  /** "2026-09". */
  key: string;
  year: number;
  month: number;
  slips: T[];
  gross: string;
  deductions: string;
  net: string;
}

export interface PayYear<T extends SlipSummary = SlipSummary> {
  /** "2026-27". */
  fy: string;
  /** Months that have a payslip, April first. */
  months: PayMonth<T>[];
  ytd: { gross: string; deductions: string; net: string; count: number };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Payslips grouped by financial year (newest first) and month (April → March). */
export function payYears<T extends SlipSummary>(slips: T[]): PayYear<T>[] {
  const years = new Map<string, Map<string, T[]>>();
  for (const slip of slips) {
    const fy = financialYear(`${monthKey(slip.period_year, slip.period_month)}-01`);
    const months = years.get(fy) ?? new Map<string, T[]>();
    const key = monthKey(slip.period_year, slip.period_month);
    months.set(key, [...(months.get(key) ?? []), slip]);
    years.set(fy, months);
  }
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fy, months]) => {
      const ordered: PayMonth<T>[] = [...months.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, list]) => ({
          key,
          year: list[0]!.period_year,
          month: list[0]!.period_month,
          slips: list,
          gross: sumDecimals(list.map((s) => s.gross_earnings)),
          deductions: sumDecimals(list.map((s) => s.total_deductions)),
          net: sumDecimals(list.map((s) => s.net_pay)),
        }));
      const all = ordered.flatMap((m) => m.slips);
      return {
        fy,
        months: ordered,
        ytd: {
          gross: sumDecimals(all.map((s) => s.gross_earnings)),
          deductions: sumDecimals(all.map((s) => s.total_deductions)),
          net: sumDecimals(all.map((s) => s.net_pay)),
          count: all.length,
        },
      };
    });
}
