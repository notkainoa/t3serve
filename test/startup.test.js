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
const runtimeReady = async () => true;

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
    runtimeReady,
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

test('startup inspection stops retrying when its deadline is exhausted', async () => {
  let currentTime = 0;
  let attempts = 0;
  const inspector = new T3StartupInspector({
    timeout: 1_000,
    runtimeReady,
    now: () => currentTime,
    sleep: async (milliseconds) => { currentTime += milliseconds; },
    runT3: async () => {
      attempts += 1;
      throw new Error('server unavailable');
    }
  });

  await assert.rejects(
    inspector.inspect(),
    /The t3 server did not become ready: server unavailable/
  );
  assert.equal(attempts, 2);
});

test('invalid pairing output fails immediately without more npx calls', async () => {
  let attempts = 0;
  const inspector = new T3StartupInspector({
    runtimeReady,
    runT3: async () => {
      attempts += 1;
      return 'unexpected output';
    }
  });

  await assert.rejects(inspector.inspect(), /complete pairing details/);
  assert.equal(attempts, 1);
});

test('Connect status retries transient execution and output failures', async () => {
  let connectAttempts = 0;
  const inspector = new T3StartupInspector({
    runtimeReady,
    sleep: async () => {},
    runT3: async (args) => {
      if (args[0] === 'pair') return pairOutput;
      connectAttempts += 1;
      if (connectAttempts === 1) throw new Error('temporary failure');
      if (connectAttempts === 2) return '{';
      return '{"desired":true,"linked":true}';
    }
  });

  assert.equal((await inspector.inspect()).t3Connect, 'connected');
  assert.equal(connectAttempts, 3);
});

test('Connect status reports a bounded failure after pairing succeeds', async () => {
  let connectAttempts = 0;
  const inspector = new T3StartupInspector({
    runtimeReady,
    sleep: async () => {},
    runT3: async (args) => {
      if (args[0] === 'pair') return pairOutput;
      connectAttempts += 1;
      throw new Error('status unavailable');
    }
  });

  await assert.rejects(
    inspector.inspect(),
    /Could not read T3 Connect status: status unavailable/
  );
  assert.equal(connectAttempts, 3);
});

test('each t3 command is bounded by the shared startup deadline', async () => {
  let currentTime = 100;
  const timeouts = [];
  const inspector = new T3StartupInspector({
    timeout: 1_000,
    runtimeReady,
    now: () => currentTime,
    runT3: async (args, options) => {
      timeouts.push(options.timeout);
      if (args[0] === 'pair') {
        currentTime += 400;
        return pairOutput;
      }
      return '{"desired":false,"linked":false}';
    }
  });

  await inspector.inspect();
  assert.deepEqual(timeouts, [1_000, 600]);
});

test('startup waits for the runtime state before invoking npx', async () => {
  let currentTime = 0;
  let readinessChecks = 0;
  let commands = 0;
  const inspector = new T3StartupInspector({
    timeout: 1_000,
    readyDelay: 250,
    now: () => currentTime,
    sleep: async (milliseconds) => { currentTime += milliseconds; },
    runtimeReady: async (path) => {
      assert.equal(path, '/Users/test/.t3/userdata/server-runtime.json');
      readinessChecks += 1;
      return readinessChecks === 3;
    },
    baseDir: '/Users/test/.t3',
    runT3: async (args) => {
      commands += 1;
      return args[0] === 'pair'
        ? pairOutput
        : '{"desired":false,"linked":false}';
    }
  });

  await inspector.inspect();
  assert.equal(currentTime, 500);
  assert.equal(commands, 2);
});
