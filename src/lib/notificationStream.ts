/**
 * Live notifications while the app is open: GET /notifications/stream
 * (server-sent events).
 *
 * React Native's fetch cannot read a response as it streams, but its
 * XMLHttpRequest reports partial text through `onprogress`, which is enough to
 * read SSE frames. Each new notification refreshes the Inbox and the tab
 * badge. When the stream drops (signal, server restart) it reconnects with a
 * back-off; the badge also polls, so nothing depends on the stream alone.
 */

import { queryClient } from './queryClient';
import { API_ROOT, authHeaders } from './api';

export function parseFrames(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    let event = 'message';
    const data: string[] = [];
    for (const line of part.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

export function startNotificationStream(): () => void {
  let stopped = false;
  let xhr: XMLHttpRequest | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = async () => {
    if (stopped) return;
    const headers = await authHeaders();
    if (stopped || !headers.Authorization) return;
    const request = new XMLHttpRequest();
    xhr = request;
    let seen = 0;
    let buffer = '';
    request.open('GET', `${API_ROOT}/notifications/stream`);
    request.setRequestHeader('Accept', 'text/event-stream');
    request.setRequestHeader('Authorization', headers.Authorization);
    request.onprogress = () => {
      const text = request.responseText ?? '';
      buffer += text.slice(seen);
      seen = text.length;
      const { events, rest } = parseFrames(buffer);
      buffer = rest;
      if (events.some((e) => e.event === 'notification')) {
        attempt = 0;
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    };
    const reconnect = () => {
      if (stopped) return;
      attempt += 1;
      retry = setTimeout(() => void connect(), Math.min(60_000, 2000 * 2 ** Math.min(attempt, 5)));
    };
    request.onerror = reconnect;
    request.onload = reconnect;
    request.send();
  };

  void connect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    xhr?.abort();
  };
}
