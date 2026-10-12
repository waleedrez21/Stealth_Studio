import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedCoachEmail } from '../src/coach-access.js';

test('coach eligibility matches the exact company domain or an approved external email', () => {
  for (const email of ['alex@stealthgpt.ai', 'Coach@StealthGPT.AI'])
    assert.equal(approvedCoachEmail(email), true);
  for (const email of [
    null,
    '',
    '@stealthgpt.ai',
    'a@@stealthgpt.ai',
    'a@stealthgpt.ai.evil.com',
    'a@team.stealthgpt.ai',
    'a@notstealthgpt.ai',
    'a@gmail.com',
  ])
    assert.equal(approvedCoachEmail(email), false, String(email));
  assert.equal(
    approvedCoachEmail('Waleed.Shammarez21@gmail.com', ['waleed.shammarez21@gmail.com']),
    true,
  );
});
