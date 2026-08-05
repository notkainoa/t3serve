import assert from 'node:assert/strict';
import test from 'node:test';

import { runCli } from '../src/cli.js';
import { StartupDetailsError } from '../src/startup.js';

function recordingUi() {
  const output = [];
  const recorded = {
    output,
    spinnerStops: 0,
    line: (message = '') => output.push(message),
    success: (message) => output.push(message),
    info: (message) => output.push(message),
    warning: (message) => output.push(message),
    error: (message) => output.push(message),
    spinner: (message) => {
      output.push(message);
      return { stop() { recorded.spinnerStops += 1; } };
    }
  };
  return recorded;
}

test('help lists the core commands', async () => {
  const ui = recordingUi();
  assert.equal(await runCli(['--help'], { ui }), 0);
  assert.match(ui.output.join('\n'), /load/);
  assert.match(ui.output.join('\n'), /unload/);
  assert.match(ui.output.join('\n'), /restart/);
  assert.match(ui.output.join('\n'), /status/);
  assert.equal(ui.output.at(-1), '');
});

test('status reports the service state', async () => {
  const ui = recordingUi();
  const service = { status: () => 'running' };
  assert.equal(await runCli(['status'], { service, ui }), 0);
  assert.match(ui.output.join('\n'), /running/);
});

test('load reports an already-loaded service and its connection details', async () => {
  const ui = recordingUi();
  const service = { load: () => 'already-loaded' };
  const inspector = {
    inspect: async () => ({
      localUrl: 'http://localhost:3773',
      pairToken: 'PAIRCODE',
      pairUrl: 'http://localhost:3773/pair#token=PAIRCODE',
      t3Connect: 'connected'
    })
  };

  assert.equal(await runCli(['load'], { service, inspector, ui }), 0);
  assert.match(ui.output.join('\n'), /already loaded/);
  assert.match(ui.output.join('\n'), /http:\/\/localhost:3773/);
  assert.match(ui.output.join('\n'), /PAIRCODE/);
  assert.match(ui.output.join('\n'), /Connected/);
  assert.match(ui.output.at(-1), /running/);
});

test('load and start describe each startup state', async () => {
  const details = {
    localUrl: 'http://localhost:3773',
    pairToken: 'PAIRCODE',
    pairUrl: 'http://localhost:3773/pair#token=PAIRCODE',
    t3Connect: 'not-connected'
  };
  const cases = [
    { command: 'load', result: 'loaded', expected: /loaded · starting/ },
    { command: 'start', result: 'started', expected: /server: starting/ },
    { command: 'start', result: 'already-running', expected: /already running · checking/ }
  ];

  for (const { command, result, expected } of cases) {
    const ui = recordingUi();
    const service = { [command]: () => result };
    const inspector = { inspect: async () => details };

    assert.equal(await runCli([command], { service, inspector, ui }), 0);
    assert.match(ui.output[0], expected);
    assert.equal(ui.spinnerStops, 1);
  }
});

test('startup detail failures become friendly CLI errors', async () => {
  const ui = recordingUi();
  const service = { start: () => 'started' };
  const inspector = {
    inspect: async () => {
      throw new StartupDetailsError('The server timed out.');
    }
  };

  assert.equal(await runCli(['start'], { service, inspector, ui }), 1);
  assert.match(ui.output.at(-1), /The server timed out/);
  assert.match(ui.output.at(-1), /t3serve-error.log/);
  assert.equal(ui.spinnerStops, 1);
});

test('unknown commands fail with useful guidance', async () => {
  const ui = recordingUi();
  assert.equal(await runCli(['wat'], { ui }), 1);
  assert.match(ui.output.join('\n'), /Unknown command: wat/);
  assert.match(ui.output.join('\n'), /t3serve help/);
});
