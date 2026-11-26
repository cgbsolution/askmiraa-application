import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchIntents, parseAmount, parseDateWords, parseRange } from '../intents.ts';

// Monday 26 October 2026.
const TODAY = '2026-10-26';

describe('dates in words', () => {
  it('reads relative days', () => {
    assert.equal(parseDateWords('today', TODAY), '2026-10-26');
    assert.equal(parseDateWords('tomorrow', TODAY), '2026-10-27');
    assert.equal(parseDateWords('day after tomorrow', TODAY), '2026-10-28');
  });

  it('reads weekdays as the coming one', () => {
    assert.equal(parseDateWords('friday', TODAY), '2026-10-30');
    assert.equal(parseDateWords('monday', TODAY), '2026-10-26', 'today, when today is that day');
    assert.equal(parseDateWords('next monday', TODAY), '2026-11-02');
    assert.equal(parseDateWords('Fri', TODAY), '2026-10-30');
  });

  it('reads written dates, day first as in India', () => {
    assert.equal(parseDateWords('3 nov', TODAY), '2026-11-03');
    assert.equal(parseDateWords('3rd November', TODAY), '2026-11-03');
    assert.equal(parseDateWords('nov 3', TODAY), '2026-11-03');
    assert.equal(parseDateWords('03/11', TODAY), '2026-11-03');
    assert.equal(parseDateWords('3/11/2026', TODAY), '2026-11-03');
    assert.equal(parseDateWords('5 jan', TODAY), '2027-01-05', 'a date long past this year is next year');
  });

  it('refuses impossible or unknown dates rather than guessing', () => {
    assert.equal(parseDateWords('31/02', TODAY), null);
    assert.equal(parseDateWords('someday', TODAY), null);
  });

  it('reads ranges and durations', () => {
    assert.deepEqual(parseRange('leave from 3 nov to 5 nov', TODAY), { start: '2026-11-03', end: '2026-11-05' });
    assert.deepEqual(parseRange('28 dec - 2 jan', TODAY), { start: '2026-12-28', end: '2027-01-02' });
    assert.deepEqual(parseRange('tomorrow for 2 days', TODAY), { start: '2026-10-27', end: '2026-10-28' });
    assert.deepEqual(parseRange('on friday', TODAY), { start: '2026-10-30', end: '2026-10-30' });
    assert.equal(parseRange('no date here', TODAY), null);
  });

  it('reads amounts in rupees', () => {
    assert.equal(parseAmount('cab ₹1,250 yesterday'), '1250');
    assert.equal(parseAmount('Rs. 300.50 lunch'), '300.50');
    assert.equal(parseAmount('450 rupees'), '450');
    assert.equal(parseAmount('3 meals'), null);
  });
});

describe('intents', () => {
  it('turns "apply leave for Friday" into a pre-filled leave form', () => {
    const [intent] = matchIntents('Apply leave for Friday', '', TODAY);
    assert.equal(intent?.key, 'apply_leave');
    assert.equal(intent?.route, 'ApplyLeave');
    assert.deepEqual(intent?.params, { start: '2026-10-30', end: '2026-10-30' });
  });

  it('carries a half day, its session and a leave type', () => {
    const [intent] = matchIntents('I need a half day sick leave tomorrow morning', '', TODAY);
    assert.equal(intent?.params.halfDay, '1');
    assert.equal(intent?.params.session, 'first_half');
    assert.equal(intent?.params.kind, 'sick');
    assert.equal(intent?.params.start, '2026-10-27');
  });

  it('offers a regularisation with the day', () => {
    const [intent] = matchIntents('I forgot to punch out on 23/10', '', TODAY);
    assert.equal(intent?.key, 'regularise');
    assert.equal(intent?.params.date, '2026-10-23');
  });

  it('offers an expense with the amount', () => {
    const [intent] = matchIntents('claim my cab ₹640 from yesterday', '', TODAY);
    assert.equal(intent?.key, 'new_expense');
    assert.equal(intent?.params.amount, '640');
    assert.equal(intent?.params.date, '2026-10-25');
  });

  it('offers a ticket with its subject', () => {
    const [intent] = matchIntents('raise a ticket about my laptop not charging', '', TODAY);
    assert.equal(intent?.key, 'raise_ticket');
    assert.equal(intent?.params.subject, 'my laptop not charging');
  });

  it('recognises payslips, Form 16 and tax declarations', () => {
    assert.equal(matchIntents('download my payslip', '', TODAY)[0]?.key, 'payslip');
    assert.equal(matchIntents('where is my form 16?', '', TODAY)[0]?.key, 'form16');
    assert.equal(matchIntents('I want to declare my HRA rent', '', TODAY)[0]?.key, 'tax_declaration');
  });

  it('also reads Miraa’s reply', () => {
    const intents = matchIntents('how many days off do I have', 'You can apply leave from the Time tab.', TODAY);
    assert.equal(intents[0]?.key, 'apply_leave');
  });

  it('offers nothing for a plain question', () => {
    assert.deepEqual(matchIntents('Who is on leave this week?', 'Three people are out.', TODAY), []);
    assert.deepEqual(matchIntents('How many leaves do I have left?', '', TODAY), []);
  });

  it('never offers more than two chips', () => {
    const intents = matchIntents('apply leave tomorrow and raise a ticket and download payslip and form 16', '', TODAY);
    assert.ok(intents.length <= 2);
  });
});
