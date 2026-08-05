import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getUnsupportedPlatformMessage,
  LINUX_BACKGROUND_SERVICE_URL
} from '../src/platform.js';

test('macOS passes the install platform check', () => {
  assert.equal(getUnsupportedPlatformMessage('darwin'), null);
});

test('Linux users are directed to the built-in T3 Code service', () => {
  const message = getUnsupportedPlatformMessage('linux');

  assert.match(message, /only supports macOS/);
  assert.match(message, /Detected platform: Linux/);
  assert.match(message, /npx t3@latest service install/);
  assert.match(message, new RegExp(LINUX_BACKGROUND_SERVICE_URL.replaceAll('.', '\\.')));
});

test('Windows users receive a clear unsupported-platform message', () => {
  const message = getUnsupportedPlatformMessage('win32');

  assert.match(message, /only supports macOS/);
  assert.match(message, /Detected platform: Windows/);
  assert.doesNotMatch(message, /service install/);
});
