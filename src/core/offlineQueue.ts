/**
 * Offline punch queue.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND THE RULES THAT MATTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Field staff lose signal constantly — basements, factory floors, lifts, sites
 * with no coverage at all. A punch lost to a dead zone becomes a payroll
 * dispute weeks later, by which point nobody can prove what happened.
 *
 * So a punch is recorded locally the instant the button is pressed, and the
 * **original timestamp is kept and never rewritten**.
 *
 * The backend timestamps a punch someone records for themselves (it refuses a
 * self-punch that carries its own time — see `punch_source_for` in
 * `services/attendance/service.py`; a back-dated punch typed in by the person
 * it is about is not an observation of anything). That leaves one honest way
 * to send a queued punch:
 *
 *   - Within LIVE_WINDOW_MS of the tap, it goes as a live punch and the server
 *     stamps it. The difference is network latency, nothing more.
 *   - Later than that, sending it would record the sync time as the punch
 *     time — exactly the rewrite this queue exists to prevent. So it is NOT
 *     sent. It turns `stale`, keeps its original time, and the person is asked
 *     to raise a regularisation for that time (pre-filled), which a manager
 *     approves. Nothing is lost and nothing is invented.
 *
 * The second rule is about honesty: a queued punch is *never* displayed as
 * confirmed. `PunchState` distinguishes queued, syncing, synced, failed,
 * rejected and stale, and `describeState` owns the copy and the `confirmed`
 * flag together, so no screen can show a tick for something on the device.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No React Native imports here on purpose. Storage and transport are injected,
 * so this is testable in plain Node — and the logic that decides whether
 * someone gets paid should be tested, not demonstrated on a simulator.
 */

export type PunchDirection = 'in' | 'out';

export type PunchState =
  /** Written locally. Not on the server. Never show this as confirmed. */
  | 'queued'
  /** In flight. */
  | 'syncing'
  /** Server acknowledged. This is the only state that may show a tick. */
  | 'synced'
  /** Transport failed; will retry while still inside the live window. */
  | 'failed'
  /** The server refused it and a retry cannot help. Needs a person. */
  | 'rejected'
  /** Signal came back too late to send it live. Needs a regularisation for `punchedAt`. */
  | 'stale';

export interface QueuedPunch {
  /** Client-generated, so a retry cannot create a duplicate locally. */
  id: string;
  direction: PunchDirection;
  /** ISO 8601. The moment the button was pressed. Never rewritten. */
  punchedAt: string;
  latitude?: number;
  longitude?: number;
  /** How accurate the phone said the location was, in metres. */
  accuracy?: number;
  /** A selfie, when the workspace asks for one (base64 data URL). */
  photo?: string;
  state: PunchState;
  attempts: number;
  lastError?: string;
  /** When the queue first wrote it — diagnostics only, never sent as the punch time. */
  queuedAt: string;
  syncedAt?: string;
  /** The time the server recorded, once synced. */
  serverPunchedAt?: string;
  /** Set by the server when the punch fell outside every geofence. */
  outsideGeofence?: boolean;
  /** The person raised a regularisation for this stale punch (or dismissed it). */
  resolvedAt?: string;
}

export interface QueueStorage {
  read(): Promise<QueuedPunch[]>;
  write(punches: QueuedPunch[]): Promise<void>;
}

export interface PunchTransport {
  /**
   * Submit one punch as a live punch (the server stamps the time).
   *
   * Throws to signal a transient failure (retry). Return `accepted: false`
   * for a permanent refusal that a retry cannot fix.
   */
  submit(punch: QueuedPunch): Promise<{
    accepted: boolean;
    outsideGeofence?: boolean;
    serverPunchedAt?: string;
    reason?: string;
  }>;
}

export interface SyncSummary {
  synced: number;
  failed: number;
  rejected: number;
  stale: number;
  remaining: number;
}

/** Give up after this many attempts and surface the punch for a human. */
export const MAX_ATTEMPTS = 8;

/**
 * How long after the tap a punch may still be sent live. Two minutes covers a
 * dropped request and a retry; beyond it the server's own clock would move the
 * punch, so it goes to a regularisation instead.
 */
export const LIVE_WINDOW_MS = 2 * 60 * 1000;

/** Keep synced punches this long so the UI can show recent history offline. */
const SYNCED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class OfflinePunchQueue {
  // Plain fields rather than TypeScript parameter properties: those emit code,
  // so a runtime that only strips types (Node's --experimental-strip-types,
  // and some bundler configurations) cannot load a module that uses them.
  private readonly storage: QueueStorage;
  private readonly transport: PunchTransport;
  private readonly now: () => Date;
  private running: Promise<SyncSummary> | null = null;

  constructor(
    storage: QueueStorage,
    transport: PunchTransport,
    now: () => Date = () => new Date(),
  ) {
    this.storage = storage;
    this.transport = transport;
    this.now = now;
  }

  /**
   * Record a punch locally and return it.
   *
   * Returns immediately with state `queued`. The caller shows "saved on this
   * device" — never a confirmation.
   */
  async enqueue(input: {
    direction: PunchDirection;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    photo?: string;
    id?: string;
    punchedAt?: Date;
  }): Promise<QueuedPunch> {
    const moment = input.punchedAt ?? this.now();

    const punch: QueuedPunch = {
      id: input.id ?? cryptoRandomId(),
      direction: input.direction,
      // Captured once, here, and never touched again.
      punchedAt: moment.toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      photo: input.photo,
      state: 'queued',
      attempts: 0,
      queuedAt: this.now().toISOString(),
    };

    const existing = await this.storage.read();
    await this.storage.write([...existing, punch]);
    return punch;
  }

  /** Everything still waiting to be sent. What the UI shows as unconfirmed. */
  async pending(): Promise<QueuedPunch[]> {
    const all = await this.storage.read();
    return all.filter((p) => p.state === 'queued' || p.state === 'failed' || p.state === 'syncing');
  }

  /** Punches that need a person: refused, or too late to send live, and not yet resolved. */
  async needsAttention(): Promise<QueuedPunch[]> {
    const all = await this.storage.read();
    return all.filter((p) => (p.state === 'stale' || p.state === 'rejected') && !p.resolvedAt);
  }

  async all(): Promise<QueuedPunch[]> {
    return this.storage.read();
  }

  /**
   * Mark a stale or rejected punch as handled — the person raised a
   * regularisation for it. Kept (not deleted) so the history stays honest.
   */
  async resolve(id: string): Promise<void> {
    const all = await this.storage.read();
    const stamp = this.now().toISOString();
    await this.storage.write(all.map((p) => (p.id === id ? { ...p, resolvedAt: stamp } : p)));
  }

  /**
   * Drain the queue. Concurrent calls share one run, so a foreground event and
   * a button press cannot send the same punch twice.
   */
  sync(): Promise<SyncSummary> {
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  /**
   * Oldest first, so a day's punches reach the server in the order they
   * happened — an OUT arriving before its IN is an attendance record nobody
   * can interpret.
   */
  private async drain(): Promise<SyncSummary> {
    const all = await this.storage.read();
    const summary: SyncSummary = { synced: 0, failed: 0, rejected: 0, stale: 0, remaining: 0 };
    const ordered = [...all].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));

    for (const punch of ordered) {
      if (punch.state === 'synced' || punch.state === 'rejected' || punch.state === 'stale') continue;

      const age = this.now().getTime() - Date.parse(punch.punchedAt);
      if (age > LIVE_WINDOW_MS) {
        // Too late to send live: the server would stamp it with the sync time.
        punch.state = 'stale';
        punch.lastError = 'Signal came back too late to send this punch with its real time.';
        summary.stale += 1;
        continue;
      }

      if (punch.attempts >= MAX_ATTEMPTS) {
        punch.state = 'rejected';
        punch.lastError =
          `Could not sync after ${MAX_ATTEMPTS} attempts. Raise a regularisation ` +
          `so this is not lost.`;
        summary.rejected += 1;
        continue;
      }

      punch.state = 'syncing';
      punch.attempts += 1;

      try {
        const result = await this.transport.submit(punch);
        if (result.accepted) {
          punch.state = 'synced';
          punch.syncedAt = this.now().toISOString();
          punch.serverPunchedAt = result.serverPunchedAt;
          punch.outsideGeofence = result.outsideGeofence;
          punch.lastError = undefined;
          // The selfie has done its job; do not keep a face on the device.
          punch.photo = undefined;
          summary.synced += 1;
        } else {
          // The server refused it. Retrying will not change that.
          punch.state = 'rejected';
          punch.lastError = result.reason ?? 'The server refused this punch.';
          summary.rejected += 1;
        }
      } catch (error) {
        punch.state = 'failed';
        punch.lastError = error instanceof Error ? error.message : String(error);
        summary.failed += 1;
      }
    }

    const kept = this.prune(ordered);
    await this.storage.write(kept);
    summary.remaining = kept.filter((p) => p.state === 'queued' || p.state === 'failed').length;
    return summary;
  }

  /**
   * Drop synced punches older than the retention window.
   *
   * A `rejected` or `stale` punch is never pruned: it needs a person to act on
   * it, and silently dropping it recreates the problem this queue exists to
   * solve.
   */
  private prune(punches: QueuedPunch[]): QueuedPunch[] {
    const cutoff = this.now().getTime() - SYNCED_RETENTION_MS;
    return punches.filter((punch) => {
      if (punch.state !== 'synced') return true;
      const syncedAt = punch.syncedAt ? Date.parse(punch.syncedAt) : 0;
      return syncedAt >= cutoff;
    });
  }
}

/**
 * A client-generated id.
 *
 * Client-side so a retry after an ambiguous timeout is the same record
 * locally, never a second one.
 */
export function cryptoRandomId(): string {
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();

  // Expo's Hermes runtime does not always expose randomUUID.
  return 'punch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * What the UI should say about a punch.
 *
 * Centralised so no screen can accidentally describe a queued punch as
 * confirmed — the copy and the boolean live together.
 */
export function describeState(punch: QueuedPunch): {
  label: string;
  confirmed: boolean;
  needsAttention: boolean;
} {
  switch (punch.state) {
    case 'synced':
      return { label: 'Recorded', confirmed: true, needsAttention: false };
    case 'syncing':
      return { label: 'Sending…', confirmed: false, needsAttention: false };
    case 'queued':
      return { label: 'Saved on this device', confirmed: false, needsAttention: false };
    case 'failed':
      return { label: 'Waiting for signal', confirmed: false, needsAttention: false };
    case 'rejected':
      return {
        label: 'Not recorded — raise a regularisation',
        confirmed: false,
        needsAttention: true,
      };
    case 'stale':
      return {
        label: 'Saved offline, not sent — raise a regularisation for this time',
        confirmed: false,
        needsAttention: !punch.resolvedAt,
      };
  }
}
