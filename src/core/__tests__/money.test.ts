/**
 * Money and amount input.
 *
 * Amounts arrive as decimal strings and must never pass through float maths;
 * amount fields must refuse bad input as it is typed (CLAUDE.md).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { acceptAmountInput, normaliseAmount, validateAmount } from '../amount.ts';
import {
  compareDecimals,
  isPositiveAmount,
  formatCount,
  formatDays,
  formatINR,
  groupIndian,
  maskAccount,
  plainDecimal,
  sumDecimals,
  toUnits,
} from '../money.ts';

describe('formatINR', () => {
  it('groups the Indian way with two decimals', () => {
    assert.equal(formatINR('123456'), '₹1,23,456.00');
    assert.equal(formatINR('123456.5'), '₹1,23,456.50');
    assert.equal(formatINR('12345678.91'), '₹1,23,45,678.91');
    assert.equal(formatINR('999'), '₹999.00');
    assert.equal(formatINR('1000'), '₹1,000.00');
    assert.equal(formatINR('0'), '₹0.00');
  });

  it('rounds half away from zero at the second decimal', () => {
    assert.equal(formatINR('10.005'), '₹10.01');
    assert.equal(formatINR('10.004'), '₹10.00');
    assert.equal(formatINR('-10.005'), '-₹10.01');
  });

  it('shows negatives with the sign before the symbol', () => {
    assert.equal(formatINR('-2500'), '-₹2,500.00');
  });

  it('never shows NaN for a missing or malformed value', () => {
    assert.equal(formatINR(null), '—');
    assert.equal(formatINR(undefined), '—');
    assert.equal(formatINR('abc'), '—');
    assert.equal(formatINR(''), '—');
    assert.equal(formatINR('1e5'), '—');
  });

  it('handles amounts beyond float precision exactly', () => {
    // 2^53 + 1: a float would print ...992.
    assert.equal(formatINR('9007199254740993.27'), `₹${groupIndian('9007199254740993')}.27`);
    assert.ok(formatINR('9007199254740993.27').includes('993.27'));
    assert.equal(sumDecimals(['0.1', '0.2']), '0.30');
  });

  it('can trim whole-rupee decimals and drop the symbol', () => {
    assert.equal(formatINR('5000', { trimZeros: true }), '₹5,000');
    assert.equal(formatINR('5000.5', { trimZeros: true }), '₹5,000.50');
    assert.equal(formatINR('5000', { symbol: false }), '5,000.00');
  });
});

describe('decimal helpers', () => {
  it('sums exactly', () => {
    assert.equal(sumDecimals(['1250.50', '749.50', null, 'x']), '2000.00');
  });

  it('compares exactly', () => {
    assert.equal(compareDecimals('100.10', '100.1'), 0);
    assert.equal(compareDecimals('99.99', '100'), -1);
    assert.equal(compareDecimals('x', '1'), null);
  });

  it('converts to paise', () => {
    assert.equal(toUnits('12.345'), 1235n);
    assert.equal(toUnits('.5'), 50n);
    assert.equal(toUnits('-0.001'), 0n);
  });

  it('formats days and counts', () => {
    assert.equal(formatDays('1.00'), '1 day');
    assert.equal(formatDays('1.5'), '1.5 days');
    assert.equal(formatDays('12'), '12 days');
    assert.equal(formatDays(null), '—');
    assert.equal(formatCount(1234567), '12,34,567');
    assert.equal(plainDecimal('2.50'), '2.5');
    assert.equal(plainDecimal('3.00'), '3');
  });

  it('masks an account number to its last four digits', () => {
    assert.equal(maskAccount('123456789012'), '•••• 9012');
    assert.equal(maskAccount(null), '—');
  });
});

describe('amount input, as typed', () => {
  const type = (sequence: string[]) => sequence.reduce((shown, next) => acceptAmountInput(shown, next), '');

  it('refuses letters, minus signs, e and spaces in the middle of typing', () => {
    assert.equal(acceptAmountInput('12', '12a'), '12');
    assert.equal(acceptAmountInput('12', '-12'), '12');
    assert.equal(acceptAmountInput('12', '12e'), '12');
    assert.equal(acceptAmountInput('12', '1e2'), '12');
    assert.equal(acceptAmountInput('12', '12+'), '12');
  });

  it('refuses a third decimal and a second point', () => {
    assert.equal(acceptAmountInput('12.34', '12.345'), '12.34');
    assert.equal(acceptAmountInput('12.3', '12.3.'), '12.3');
  });

  it('collapses leading zeros and completes a bare point', () => {
    assert.equal(acceptAmountInput('', '007'), '7');
    assert.equal(acceptAmountInput('', '.'), '0.');
    assert.equal(acceptAmountInput('0', '00'), '0');
    assert.equal(acceptAmountInput('', '0.5'), '0.5');
  });

  it('forgives grouping and the rupee sign in pasted text', () => {
    assert.equal(acceptAmountInput('', '1,23,456.78'), '123456.78');
    assert.equal(acceptAmountInput('', '₹ 2 500'), '2500');
  });

  it('refuses a number longer than ten digits before the point', () => {
    assert.equal(acceptAmountInput('1234567890', '12345678901'), '1234567890');
  });

  it('can be limited to whole numbers', () => {
    assert.equal(acceptAmountInput('5', '5.', { decimals: 0 }), '5');
  });

  it('builds a value one keystroke at a time', () => {
    assert.equal(type(['1', '12', '12x', '12.', '12.5', '12.50', '12.505']), '12.50');
  });

  it('validates a finished amount', () => {
    assert.equal(validateAmount(''), 'Enter an amount.');
    assert.equal(validateAmount('0'), 'The amount must be more than zero.');
    assert.equal(validateAmount('0.00'), 'The amount must be more than zero.');
    assert.equal(validateAmount('12.'), null);
    assert.equal(validateAmount('150', { max: '100' }), 'The amount cannot be more than ₹100.00.');
    assert.equal(validateAmount('200000', { max: '150000.00' }), 'The amount cannot be more than ₹1,50,000.00.');
    assert.equal(validateAmount('25', { max: '24', maxLabel: '24 hours' }), 'The amount cannot be more than 24 hours.');
    assert.equal(validateAmount('100.00', { max: '100' }), null);
    assert.equal(normaliseAmount('12.'), '12');
  });
});

describe('isPositiveAmount', () => {
  it('is true only for a number above zero', () => {
    assert.equal(isPositiveAmount('0.01'), true);
    assert.equal(isPositiveAmount('0.00'), false);
    assert.equal(isPositiveAmount('-5'), false);
    assert.equal(isPositiveAmount('abc'), false);
    assert.equal(isPositiveAmount(null), false);
  });
});
