// REQ-X5: the prebuilt pages (public/_headers) and the product pages (src/middleware.js)
// send the same security headers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECURITY_HEADERS, CSP } from '../src/lib/security-headers.js';

test('REQ-X5: public/_headers sends the same security headers as the product pages', () => {
  const file = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const block = file.split(/\r?\n/).slice(file.split(/\r?\n/).indexOf('/*') + 1);
  const sent = Object.fromEntries(block.filter(l => /^\s+\S/.test(l)).map(l => l.trim().split(/:\s(.*)/s).slice(0, 2)));
  assert.deepEqual(sent, SECURITY_HEADERS);
});

test('REQ-X5: scripts only from the site itself, and no framing by other sites', () => {
  assert.match(CSP, /script-src 'self'(;|$)/);
  assert.doesNotMatch(CSP, /script-src[^;]*unsafe/);
  assert.match(CSP, /frame-ancestors 'none'/);
});
