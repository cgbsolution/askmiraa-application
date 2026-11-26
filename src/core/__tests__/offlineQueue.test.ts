/**
 * Slice 06 gate: the offline punch queue.
 *
 * The headline assertion is that the original punch time survives a sync that
 * happens hours later. Getting that wrong moves someone's shift and produces a
 * payroll dispute nobody can settle.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIVE_WINDOW_MS,
  MAX_ATTEMPTS,
  OfflinePunchQueue,
  type PunchTransport,
  type QueueStorage,
  type QueuedPunch,
  describeState,
} from '../offlineQueue.ts';

function memoryStorage(initial: QueuedPunch[] = []): QueueStorage & { rows: QueuedPunch[] } {
  let rows = [...initial];
  return {
    get rows() {
      return rows;
    },
    async read() {
      return rows.map((r) => ({ ...r }));
    },
    async write(punches) {
      rows = punches.map((p) => ({ ...p }));
    },
  };
}

function transport(
  behaviour: 'ok' | 'offline' | 'refuse' = 'ok',
): PunchTransport & { received: QueuedPunch[] } {
  const received: QueuedPunch[] = [];
  return {
    received,
    async submit(punch) {
      received.push({ ...punch });
      if (behaviour === 'offline') throw new Error('Network request failed');
      if (behaviour === 'refuse') {
        return { accepted: false, reason: 'No shift assigned for this date' };
      }
      return { accepted: true, outsideGeofence: false };
    },
  };
}

const PUNCH_MOMENT = new Date('2026-04-06T09:00:00.000Z');
const SYNC_MOMENT = new Date('2026-04-06T14:30:00.000Z');

describe('offline punch queue', () => {
  it('records a punch locally and reports it as unconfirmed', async () => {
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport(), () => PUNCH_MOMENT);

    const punch = await queue.enqueue({ direction: 'in' });

    assert.equal(punch.state, 'queued');
    assert.equal(describeState(punch).confirmed, false);
    assert.equal((await queue.pending()).length, 1);
  });

  it('never lets a much later sync record the sync time as the punch time', async () => {
    // The gate. Enqueue at 09:00 with no signal; signal returns at 14:30. The
    // server stamps live punches with its own clock, so sending this one now
    // would record 14:30. It must not be sent; it keeps 09:00 and asks for a
    // regularisation instead.
    let now = PUNCH_MOMENT;
    const storage = memoryStorage();
    const wire = transport();
    const queue = new OfflinePunchQueue(storage, wire, () => now);

    await queue.enqueue({ direction: 'in' });

    now = SYNC_MOMENT;
    const summary = await queue.sync();

    assert.equal(wire.received.length, 0, 'a stale punch is never sent live');
    assert.equal(summary.stale, 1);
    const [stored] = await queue.all();
    assert.ok(stored);
    assert.equal(stored.state, 'stale');
    assert.equal(stored.punchedAt, PUNCH_MOMENT.toISOString(), 'the original time is kept');
    const described = describeState(stored);
    assert.equal(described.confirmed, false);
    assert.equal(described.needsAttention, true);
    assert.match(described.label, /regularisation/);
    assert.equal((await queue.needsAttention()).length, 1);
  });

  it('sends a punch live when signal returns inside the live window', async () => {
    let now = PUNCH_MOMENT;
    const storage = memoryStorage();
    const wire = transport();
    const queue = new OfflinePunchQueue(storage, wire, () => now);

    await queue.enqueue({ direction: 'in' });
    now = new Date(PUNCH_MOMENT.getTime() + LIVE_WINDOW_MS - 1000);
    await queue.sync();

    assert.equal(wire.received.length, 1);
    const [stored] = await queue.all();
    assert.equal(stored?.state, 'synced');
  });

  it('turns a punch stale once the live window passes, even after failed retries', async () => {
    let now = PUNCH_MOMENT;
    let online = false;
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(
      storage,
      {
        async submit() {
          if (!online) throw new Error('Network request failed');
          return { accepted: true };
        },
      },
      () => now,
    );
    await queue.enqueue({ direction: 'out' });
    await queue.sync();
    assert.equal((await queue.all())[0]?.state, 'failed');

    now = new Date(PUNCH_MOMENT.getTime() + LIVE_WINDOW_MS + 1000);
    online = true;
    await queue.sync();

    assert.equal((await queue.all())[0]?.state, 'stale');
  });

  it('records the sync time separately, for diagnostics only', async () => {
    let now = PUNCH_MOMENT;
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport(), () => now);
    await queue.enqueue({ direction: 'in' });

    const syncMoment = new Date(PUNCH_MOMENT.getTime() + 45_000);
    now = syncMoment;
    await queue.sync();

    const [stored] = await queue.all();

    assert.ok(stored);
    assert.equal(stored.punchedAt, PUNCH_MOMENT.toISOString());
    assert.equal(stored.syncedAt, syncMoment.toISOString());
  });

  it('keeps a stale punch after it is resolved, but stops asking for attention', async () => {
    let now = PUNCH_MOMENT;
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport(), () => now);
    const punch = await queue.enqueue({ direction: 'in' });
    now = SYNC_MOMENT;
    await queue.sync();

    await queue.resolve(punch.id);

    const [stored] = await queue.all();
    assert.ok(stored?.resolvedAt);
    assert.equal(stored?.punchedAt, PUNCH_MOMENT.toISOString());
    assert.equal(describeState(stored!).needsAttention, false);
    assert.equal((await queue.needsAttention()).length, 0);

    // Two weeks later it is still there: stale punches are never pruned.
    now = new Date('2026-04-20T09:00:00.000Z');
    await queue.sync();
    assert.equal((await queue.all()).length, 1);
  });

  it('shares one run between concurrent syncs, so a punch is sent once', async () => {
    const storage = memoryStorage();
    const wire = transport();
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);
    await queue.enqueue({ direction: 'in' });

    await Promise.all([queue.sync(), queue.sync(), queue.sync()]);

    assert.equal(wire.received.length, 1);
  });

  it('drops the selfie from the device once the punch is recorded', async () => {
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport(), () => PUNCH_MOMENT);
    await queue.enqueue({ direction: 'in', photo: 'data:image/jpeg;base64,AAAA' });
    await queue.sync();
    assert.equal((await queue.all())[0]?.photo, undefined);
  });

  it('never marks a queued punch as confirmed', async () => {
    // The second gate: honest sync state.
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport('offline'), () => PUNCH_MOMENT);
    const punch = await queue.enqueue({ direction: 'in' });

    assert.equal(describeState(punch).confirmed, false);

    await queue.sync();
    const [afterFailedSync] = await queue.all();
    assert.ok(afterFailedSync);
    assert.equal(afterFailedSync.state, 'failed');
    assert.equal(describeState(afterFailedSync).confirmed, false);
  });

  it('marks a punch confirmed only once the server has acknowledged it', async () => {
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport(), () => PUNCH_MOMENT);
    await queue.enqueue({ direction: 'in' });
    await queue.sync();

    const [stored] = await queue.all();

    assert.ok(stored);
    assert.equal(stored.state, 'synced');
    assert.equal(describeState(stored).confirmed, true);
  });

  it('keeps retrying while offline and clears once signal returns', async () => {
    const storage = memoryStorage();
    let online = false;
    const wire: PunchTransport = {
      async submit() {
        if (!online) throw new Error('Network request failed');
        return { accepted: true };
      },
    };
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);

    await queue.enqueue({ direction: 'in' });
    await queue.sync();
    assert.equal((await queue.pending()).length, 1);

    online = true;
    const summary = await queue.sync();

    assert.equal(summary.synced, 1);
    assert.equal(summary.remaining, 0);
  });

  it('syncs in punch order, not enqueue order', async () => {
    // An OUT reaching the server before its IN is an attendance record nobody
    // can interpret.
    const storage = memoryStorage();
    const wire = transport();
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);

    await queue.enqueue({
      direction: 'out',
      punchedAt: new Date('2026-04-06T18:00:00.000Z'),
    });
    await queue.enqueue({
      direction: 'in',
      punchedAt: new Date('2026-04-06T09:00:00.000Z'),
    });

    await queue.sync();

    assert.deepEqual(
      wire.received.map((p) => p.direction),
      ['in', 'out'],
    );
  });

  it('gives up after a bounded number of attempts and asks for a human', async () => {
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport('offline'), () => PUNCH_MOMENT);
    await queue.enqueue({ direction: 'in' });

    for (let i = 0; i < MAX_ATTEMPTS + 1; i += 1) {
      await queue.sync();
    }

    const [stored] = await queue.all();

    assert.ok(stored);
    assert.equal(stored.state, 'rejected');
    assert.equal(describeState(stored).needsAttention, true);
    assert.match(stored.lastError ?? '', /regularisation/);
  });

  it('does not retry a punch the server refused', async () => {
    const storage = memoryStorage();
    const wire = transport('refuse');
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);
    await queue.enqueue({ direction: 'in' });

    await queue.sync();
    await queue.sync();

    assert.equal(wire.received.length, 1, 'a refusal is not retried');
    const [stored] = await queue.all();
    assert.ok(stored);
    assert.equal(stored.state, 'rejected');
    assert.equal(stored.lastError, 'No shift assigned for this date');
  });

  it('carries geolocation through the queue', async () => {
    const storage = memoryStorage();
    const wire = transport();
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);

    await queue.enqueue({ direction: 'in', latitude: 12.9716, longitude: 77.5946 });
    await queue.sync();

    assert.equal(wire.received[0]?.latitude, 12.9716);
    assert.equal(wire.received[0]?.longitude, 77.5946);
  });

  it('submits a punch that fell outside the geofence and records the flag', async () => {
    // Per slice 02: flag, never reject. An employee who cannot punch stops
    // trying, and then there is no data at all.
    const storage = memoryStorage();
    const wire: PunchTransport = {
      async submit() {
        return { accepted: true, outsideGeofence: true };
      },
    };
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);

    await queue.enqueue({ direction: 'in', latitude: 0, longitude: 0 });
    const summary = await queue.sync();

    assert.equal(summary.synced, 1);
    const [stored] = await queue.all();
    assert.ok(stored);
    assert.equal(stored.state, 'synced');
    assert.equal(stored.outsideGeofence, true);
  });

  it('gives each punch a stable client id so a retry cannot duplicate it', async () => {
    const storage = memoryStorage();
    const wire = transport();
    const queue = new OfflinePunchQueue(storage, wire, () => PUNCH_MOMENT);

    const punch = await queue.enqueue({ direction: 'in' });
    await queue.sync();

    assert.equal(wire.received[0]?.id, punch.id);
    assert.ok(punch.id.length > 8);
  });

  it('prunes old synced punches but never a rejected one', async () => {
    let now = new Date('2026-04-06T09:00:00.000Z');
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport(), () => now);

    await queue.enqueue({ direction: 'in' });
    await queue.sync();

    const failing = new OfflinePunchQueue(storage, transport('refuse'), () => now);
    await failing.enqueue({ direction: 'out' });
    await failing.sync();

    // Two weeks later.
    now = new Date('2026-04-20T09:00:00.000Z');
    await new OfflinePunchQueue(storage, transport(), () => now).sync();

    const remaining = await queue.all();
    const states = remaining.map((p) => p.state);
    assert.ok(!states.includes('synced'), 'the old synced punch was pruned');
    assert.ok(states.includes('rejected'), 'a rejected punch still needs a person');
  });

  it('reports an honest summary', async () => {
    const storage = memoryStorage();
    const queue = new OfflinePunchQueue(storage, transport('offline'), () => PUNCH_MOMENT);
    await queue.enqueue({ direction: 'in' });
    await queue.enqueue({ direction: 'out' });

    const summary = await queue.sync();

    assert.equal(summary.synced, 0);
    assert.equal(summary.failed, 2);
    assert.equal(summary.remaining, 2);
  });
});
