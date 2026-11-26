import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checks, normaliseId, passwordProblem, sharesProblem, validateField } from '../validators.ts';

describe('identifiers', () => {
  it('checks PAN', () => {
    assert.equal(checks.pan('ABCDE1234F'), null);
    assert.equal(checks.pan('abcde1234f'), null, 'case is forgiven');
    assert.ok(checks.pan('ABCD1234F'));
    assert.ok(checks.pan('12345ABCDE'));
  });

  it('checks IFSC', () => {
    assert.equal(checks.ifsc('UTIB0000009'), null);
    assert.ok(checks.ifsc('UTIB1000009'), 'the fifth character is always 0');
    assert.ok(checks.ifsc('UTIB000009'));
  });

  it('checks PIN, Aadhaar, UAN and account numbers', () => {
    assert.equal(checks.pincode('560066'), null);
    assert.ok(checks.pincode('060066'));
    assert.ok(checks.pincode('56006'));
    assert.equal(checks.aadhaar('2345 6789 0123'), null);
    assert.ok(checks.aadhaar('1234 5678 9012'), 'Aadhaar never starts with 0 or 1');
    assert.equal(checks.uan('100200300400'), null);
    assert.ok(checks.uan('10020030040'));
    assert.equal(checks.accountNumber('000123456789'), null);
    assert.ok(checks.accountNumber('12ab'));
  });

  it('checks phone numbers and email', () => {
    assert.equal(checks.phone('+91 99000 10005'), null);
    assert.equal(checks.phone('9900010005'), null);
    assert.equal(checks.phone('+44 7911 123456'), null);
    assert.ok(checks.phone('12345'));
    assert.ok(checks.phone('5900010005'), 'Indian mobiles start 6–9');
    assert.equal(checks.email('meera@example.com'), null);
    assert.ok(checks.email('meera@example'));
  });

  it('checks years and shares', () => {
    assert.equal(checks.year('2018'), null);
    assert.ok(checks.year('18'));
    assert.ok(checks.year('1890'));
    assert.equal(checks.percent('50'), null);
    assert.ok(checks.percent('0'));
    assert.ok(checks.percent('101'));
  });
});

describe('fields', () => {
  it('accepts an empty optional field and refuses an empty required one', () => {
    assert.equal(validateField('', {}), null);
    assert.equal(validateField('  ', { required: true }), 'This is needed.');
    assert.equal(validateField('', { check: 'pan' }), null);
    assert.ok(validateField('abc', { check: 'pan' }));
    assert.match(validateField('x'.repeat(11), { maxLength: 10 }) ?? '', /under 10/);
  });

  it('normalises identifiers before sending', () => {
    assert.equal(normaliseId('pan', ' abcde 1234f '), 'ABCDE1234F');
    assert.equal(normaliseId('aadhaar', '2345 6789 0123'), '234567890123');
    assert.equal(normaliseId(undefined, '  Meera '), 'Meera');
  });

  it('wants nominee shares to add up to 100 per purpose', () => {
    assert.equal(sharesProblem([{ purpose: 'pf', share_percent: 60 }, { purpose: 'pf', share_percent: '40' }]), null);
    assert.match(sharesProblem([{ purpose: 'pf', share_percent: 60 }]) ?? '', /60%/);
    assert.equal(sharesProblem([]), null);
  });
});


describe('passwords', () => {
  it('follows the server: ten characters, a letter and a digit', () => {
    assert.equal(passwordProblem('short1'), 'Use at least 10 characters.');
    assert.equal(passwordProblem('1234567890'), 'Include a letter.');
    assert.equal(passwordProblem('abcdefghij'), 'Include a digit.');
    assert.equal(passwordProblem('Correct-horse-9'), null);
  });
});
