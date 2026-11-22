import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(
  new URL('../../apps/backend/src/services/firebase-auth-service.ts', import.meta.url),
  'utf8'
);

test('S2-T01: public registration assigns reader claims only', () => {
  const registration = source.match(
    /export async function registerCloud\([\s\S]*?(?=\nfunction cryptoNumber)/
  );

  assert.ok(registration, 'Cloud registration function must exist');

  assert.match(
    registration[0],
    /setCustomUserClaims\(created\.uid,\s*\{\s*role:\s*'reader'\s*\}\)/
  );

  assert.doesNotMatch(
    registration[0],
    /setCustomUserClaims\(created\.uid,\s*\{\s*role\s*\}\)/
  );
});
