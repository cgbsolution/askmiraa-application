import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { refreshVerdict } from '../refresh.ts';

describe('token refresh', () => {
  it('ends the session only when the server refuses the refresh token', () => {
    assert.equal(refreshVerdict(200), 'ok');
    assert.equal(refreshVerdict(401), 'refused');
    assert.equal(refreshVerdict(403), 'refused');
  });

  it('keeps the person signed in when the network or the server is the problem', () => {
    assert.equal(refreshVerdict(null), 'unavailable', 'no signal');
    assert.equal(refreshVerdict(429), 'unavailable', 'rate limited');
    assert.equal(refreshVerdict(500), 'unavailable');
    assert.equal(refreshVerdict(502), 'unavailable', 'server restarting');
    assert.equal(refreshVerdict(503), 'unavailable', 'database pool busy');
  });
});
