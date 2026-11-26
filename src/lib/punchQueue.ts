/**
 * The punch queue, one per signed-in person.
 *
 * Storage is AsyncStorage: these are attendance events, not credentials.
 * Tokens live in the Keystore (`secureTokens.ts`); this does not.
 *
 * The storage key carries the user's id. A shared phone (a supervisor's
 * handset at a site gate) must never send one person's unsent punches as the
 * next person who signs in; each person's queue waits for them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { OfflinePunchQueue, type PunchTransport, type QueueStorage, type QueuedPunch } from '../core/offlineQueue';
import type { PunchRead } from '../core/types';
import { ApiError, api } from './api';

function storageFor(userId: string): QueueStorage {
  const key = `askmira.punch_queue.v2.${userId}`;
  return {
    async read() {
      try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? (JSON.parse(raw) as QueuedPunch[]) : [];
      } catch {
        // Corrupt local state must not brick the punch button. Start clean; the
        // server already has anything that synced.
        return [];
      }
    },
    async write(punches) {
      await AsyncStorage.setItem(key, JSON.stringify(punches));
    },
  };
}

const transport: PunchTransport = {
  async submit(punch) {
    try {
      // A live punch: the server stamps the time (it refuses a self-punch that
      // carries its own). The queue only calls this inside the live window —
      // see core/offlineQueue.ts.
      const result = await api<PunchRead>('/attendance/punch', {
        method: 'POST',
        body: {
          direction: punch.direction,
          // The server has no "phone, without a location" source, and
          // mobile_geo would claim a location that is not there — so a phone
          // punch without one goes as web (MOBILE_PLAN.md, backend gap 6).
          source: punch.latitude !== undefined ? 'mobile_geo' : 'web',
          latitude: punch.latitude ?? null,
          longitude: punch.longitude ?? null,
          accuracy_metres: punch.accuracy !== undefined ? Math.round(punch.accuracy) : null,
          photo: punch.photo ?? null,
        },
        timeoutMs: 15_000,
      });
      return { accepted: true, outsideGeofence: result.outside_geofence, serverPunchedAt: result.punched_at };
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        // The server refused it — no shift, location required, not linked.
        // A retry cannot fix that, so surface it instead of looping.
        return { accepted: false, reason: error.message };
      }
      // Network failure, a timeout, rate limiting or a 5xx: throw, and the queue retries.
      throw error;
    }
  },
};

const queues = new Map<string, OfflinePunchQueue>();

export function punchQueueFor(userId: string): OfflinePunchQueue {
  let queue = queues.get(userId);
  if (!queue) {
    queue = new OfflinePunchQueue(storageFor(userId), transport);
    queues.set(userId, queue);
  }
  return queue;
}
