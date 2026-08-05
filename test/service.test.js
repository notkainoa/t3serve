import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createPlist, T3Service } from '../src/service.js';

test('the plist runs t3@nightly from the home directory', () => {
  const plist = createPlist({
    home: '/Users/Test & Co',
    markerPath: '/Users/Test & Co/.t3serve-enabled',
    stdoutPath: '/tmp/t3serve.log',
    stderrPath: '/tmp/t3serve-error.log'
  });

  assert.match(plist, /exec npx --yes t3@nightly serve/);
  assert.match(plist, /<string>\/Users\/Test &amp; Co<\/string>/);
  assert.match(plist, /<key>\/Users\/Test &amp; Co\/.t3serve-enabled<\/key>/);
});

test('install writes the service and asks launchd to load it', () => {
  const home = mkdtempSync(join(tmpdir(), 't3serve-'));
  const calls = [];
  const launchctl = (args) => {
    calls.push(args);
    if (args[0] === 'print') return { ok: false, stdout: '', stderr: '' };
    return { ok: true, stdout: '', stderr: '' };
  };
  const service = new T3Service({ home, uid: 501, platform: 'darwin', launchctl });

  try {
    service.install();

    assert.match(readFileSync(service.plistPath, 'utf8'), /t3@nightly/);
    assert.deepEqual(calls.at(-1), ['bootstrap', 'gui/501', service.plistPath]);
    assert.equal(service.status(), 'not-loaded');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
