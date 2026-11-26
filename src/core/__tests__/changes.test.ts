import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { changeDiff } from '../changes.ts';

describe('profile change requests', () => {
  it('lists only the fields that change, in words', () => {
    const diff = changeDiff(
      { first_name: 'Vikram', last_name: 'Shah-Mehta', date_of_birth: '1988-10-09' },
      { first_name: 'Vikram', last_name: 'Shah', date_of_birth: '1988-10-09' },
    );
    assert.deepEqual(diff, [{ key: 'last_name', label: 'Last name', from: 'Shah', to: 'Shah-Mehta' }]);
  });

  it('reads one level into nested sections and shows blanks as a dash', () => {
    const diff = changeDiff(
      { current: { city: 'Pune', pincode: '411001' }, permanent_same_as_current: true },
      { current: { city: 'Bengaluru', pincode: '411001' }, permanent_same_as_current: false },
    );
    assert.deepEqual(diff, [
      { key: 'Current.city', label: 'Current · City', from: 'Bengaluru', to: 'Pune' },
      { key: 'permanent_same_as_current', label: 'Permanent same as current', from: 'No', to: 'Yes' },
    ]);
    assert.equal(changeDiff({ uan_number: '100200300400' }, {})[0]?.label, 'UAN number');
    assert.deepEqual(changeDiff({ pan: 'ABCDE1234F' }, null), [{ key: 'pan', label: 'PAN', from: '—', to: 'ABCDE1234F' }]);
  });
});
