import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseConnectStatus,
  parsePairOutput,
  T3StartupInspector
} from '../src/startup.js';

const pairOutput = `Pairing with My Mac (http://127.0.0.1:3773).

Pairing URL: http://localhost:3773/pair#token=PAIRCODE
Token: PAIRCODE
Expires: 2026-08-04T20:00:00.000Z
`;

test('pair output becomes local connection details', () => {
  assert.deepEqual(parsePairOutput(pairOutput), {
    localUrl: 'http://localhost:3773',
    pairToken: 'PAIRCODE',
    pairUrl: 'http://localhost:3773/pair#token=PAIRCODE'
  });
});

test('Connect status distinguishes connected, pending, and unused setups', () => {
  assert.equal(parseConnectStatus('{"desired":true,"linked":true}'), 'connected');
  assert.equal(parseConnectStatus('{"desired":true,"linked":false}'), 'connecting');
  assert.equal(parseConnectStatus('{"desired":false,"linked":false}'), 'not-connected');
  assert.throws(() => parseConnectStatus('{}'), /incomplete Connect status/);
});

test('startup inspection retries until the managed server is ready', async () => {
  const calls = [];
  let pairAttempts = 0;
  let currentTime = 0;
  const inspector = new T3StartupInspector({
    baseDir: '/Users/test/.t3',
    now: () => currentTime,
    sleep: async (milliseconds) => { currentTime += milliseconds; },
    runT3: async (args) => {
      calls.push(args);
      if (args[0] === 'pair') {
        pairAttempts += 1;
        if (pairAttempts === 1) throw new Error('not ready');
        return pairOutput;
      }
      return '{"desired":false,"linked":false}';
    }
  });

  assert.deepEqual(await inspector.inspect(), {
    localUrl: 'http://localhost:3773',
    pairToken: 'PAIRCODE',
    pairUrl: 'http://localhost:3773/pair#token=PAIRCODE',
    t3Connect: 'not-connected'
  });
  assert.deepEqual(calls, [
    ['pair', '--base-dir', '/Users/test/.t3'],
    ['pair', '--base-dir', '/Users/test/.t3'],
    ['connect', 'status', '--json', '--base-dir', '/Users/test/.t3']
  ]);
});
