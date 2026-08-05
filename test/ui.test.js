import assert from 'node:assert/strict';
import test from 'node:test';

import { createSpinner } from '../src/ui.js';

test('spinner stays silent when output is not a terminal', () => {
  const writes = [];
  const spinner = createSpinner('Waiting…', {
    isTTY: false,
    write: (value) => writes.push(value)
  });

  spinner.stop();
  assert.deepEqual(writes, []);
});
