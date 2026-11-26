/**
 * Tax form helpers: the financial year's months and the house-rent form's
 * starting values from what is saved.
 */

import { MONTHS } from './dates.ts';
import { isPositiveAmount, plainDecimal } from './money.ts';
import type { HouseRentRead } from './types.ts';

/** April to March of a financial year ("2026-27"). */
export function fyMonths(fy: string): { month: number; year: number; label: string }[] {
  const start = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((i + 3) % 12) + 1;
    const year = month >= 4 ? start : start + 1;
    return { month, year, label: `${MONTHS[month - 1]} ${year}` };
  });
}

/** A saved amount as the field shows it: "25000.00" -> "25000", nothing for zero. */
export function editable(value: string | null | undefined): string {
  return value && isPositiveAmount(value) ? plainDecimal(value) : '';
}

export type RentRow = { month?: number; year?: number; rent?: string };

/** The form's starting values, from what is saved (or a blank year). */
export function rentSeed(current: HouseRentRead | null, months: { month: number; year: number }[]) {
  const rows = ((current?.monthly_rent ?? []) as RentRow[]).filter((r) => r.month && r.year);
  const indexOf = (r: RentRow) => months.findIndex((m) => m.month === r.month && m.year === r.year);
  const indexes = rows.map(indexOf).filter((i) => i >= 0);
  const amounts = new Set(rows.map((r) => editable(r.rent)));
  return {
    rent: editable(rows[0]?.rent),
    from: String(indexes.length ? Math.min(...indexes) : 0),
    to: String(indexes.length ? Math.max(...indexes) : 11),
    landlord: current?.landlord_name ?? '',
    pan: current?.landlord_pan ?? '',
    address: current?.property_address ?? '',
    metro: current?.is_metro ?? false,
    /** Saved months with different rents, or gaps: one amount here would replace them. */
    uneven: amounts.size > 1 || (indexes.length > 0 && Math.max(...indexes) - Math.min(...indexes) + 1 !== indexes.length),
  };
}

