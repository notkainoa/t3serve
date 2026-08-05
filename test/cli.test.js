import assert from 'node:assert/strict';
import test from 'node:test';

import { runCli } from '../src/cli.js';

function recordingUi() {
  const output = [];
  return {
    output,
    line: (message = '') => output.push(message),
    success: (message) => output.push(message),
    info: (message) => output.push(message),
    warning: (message) => output.push(message),
    error: (message) => output.push(message),
    spinner: (message) => {
      output.push(message);
      return { stop() {} };
    }
  };
}

test('help lists the core commands', async () => {
  const ui = recordingUi();
  assert.equal(await runCli(['--help'], { ui }), 0);
  assert.match(ui.output.join('\n'), /load/);
  assert.match(ui.output.join('\n'), /unload/);
  assert.match(ui.output.join('\n'), /restart/);
  assert.match(ui.output.join('\n'), /status/);
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

test('unknown commands fail with useful guidance', async () => {
  const ui = recordingUi();
  assert.equal(await runCli(['wat'], { ui }), 1);
  assert.match(ui.output.join('\n'), /Unknown command: wat/);
  assert.match(ui.output.join('\n'), /t3serve help/);
});
