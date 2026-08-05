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
    error: (message) => output.push(message)
  };
}

test('help lists the core commands', () => {
  const ui = recordingUi();
  assert.equal(runCli(['--help'], { ui }), 0);
  assert.match(ui.output.join('\n'), /load/);
  assert.match(ui.output.join('\n'), /unload/);
  assert.match(ui.output.join('\n'), /restart/);
  assert.match(ui.output.join('\n'), /status/);
});

test('status reports the service state', () => {
  const ui = recordingUi();
  const service = { status: () => 'running' };
  assert.equal(runCli(['status'], { service, ui }), 0);
  assert.match(ui.output.join('\n'), /running/);
});

test('load reports an already-loaded service without restarting it', () => {
  const ui = recordingUi();
  const service = { load: () => 'already-loaded' };
  assert.equal(runCli(['load'], { service, ui }), 0);
  assert.match(ui.output.join('\n'), /already loaded/);
});

test('unknown commands fail with useful guidance', () => {
  const ui = recordingUi();
  assert.equal(runCli(['wat'], { ui }), 1);
  assert.match(ui.output.join('\n'), /Unknown command: wat/);
  assert.match(ui.output.join('\n'), /t3serve help/);
});
