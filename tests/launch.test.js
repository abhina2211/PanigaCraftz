// Tests for the coming-soon switch in src/lib/launch.js (REQ-S10). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comingSoon, contactMailto, CONTACT_EMAIL } from '../src/lib/launch.js';

test('the shop shows the coming-soon page only when the variable is "true"', () => {
  assert.equal(comingSoon('true'), true);
  assert.equal(comingSoon(' TRUE '), true);
  for (const off of [undefined, null, '', 'false', '0', 'yes', 'no']) assert.equal(comingSoon(off), false, String(off));
});

test('the email link goes to the shop address with a subject', () => {
  assert.equal(CONTACT_EMAIL, 'panigacraftz@gmail.com');
  assert.equal(contactMailto(), 'mailto:panigacraftz@gmail.com?subject=Hello%20PanigaCraftz');
});
