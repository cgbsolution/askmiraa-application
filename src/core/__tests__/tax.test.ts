import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { editable, fyMonths, rentSeed } from '../tax.ts';
import type { HouseRentRead } from '../types.ts';

const months = fyMonths('2026-27');

function saved(rows: { month: number; year: number; rent: string }[]): HouseRentRead {
  return {
    monthly_rent: rows,
    landlord_name: 'Ramesh Gupta',
    landlord_pan: 'ABCDE1234F',
    property_address: null,
    is_metro: true,
  } as unknown as HouseRentRead;
}

describe('financial year months', () => {
  it('runs April to March across two calendar years', () => {
    assert.equal(months.length, 12);
    assert.deepEqual(months[0], { month: 4, year: 2026, label: 'Apr 2026' });
    assert.deepEqual(months[8], { month: 12, year: 2026, label: 'Dec 2026' });
    assert.deepEqual(months[11], { month: 3, year: 2027, label: 'Mar 2027' });
  });
});

describe('saved amounts in a form', () => {
  it('shows a saved amount without trailing zeros, and zero as empty', () => {
    assert.equal(editable('25000.00'), '25000');
    assert.equal(editable('25000.50'), '25000.5');
    assert.equal(editable('0.00'), '');
    assert.equal(editable(null), '');
  });
});

describe('house rent form', () => {
  it('starts as a blank full year when nothing is saved', () => {
    const seed = rentSeed(null, months);
    assert.equal(seed.rent, '');
    assert.equal(seed.from, '0');
    assert.equal(seed.to, '11');
    assert.equal(seed.uneven, false);
  });

  it('reopens on the months that were saved, not the whole year', () => {
    // June to March, as an employee who moved in June would have saved it.
    const rows = months.slice(2).map((m) => ({ month: m.month, year: m.year, rent: '25000.00' }));
    const seed = rentSeed(saved(rows), months);
    assert.equal(seed.from, '2');
    assert.equal(seed.to, '11');
    assert.equal(seed.rent, '25000');
    assert.equal(seed.pan, 'ABCDE1234F');
    assert.equal(seed.metro, true);
    assert.equal(seed.uneven, false);
  });

  it('warns when the saved rent differs by month or has gaps', () => {
    const differs = saved([
      { month: 4, year: 2026, rent: '20000.00' },
      { month: 5, year: 2026, rent: '25000.00' },
    ]);
    assert.equal(rentSeed(differs, months).uneven, true);
    const gap = saved([
      { month: 4, year: 2026, rent: '20000.00' },
      { month: 6, year: 2026, rent: '20000.00' },
    ]);
    assert.equal(rentSeed(gap, months).uneven, true);
  });
});
