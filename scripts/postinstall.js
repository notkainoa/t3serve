import { getUnsupportedPlatformMessage } from '../src/platform.js';

const message = getUnsupportedPlatformMessage(process.platform);

if (message) {
  console.error(`\n${message}\n`);
  process.exitCode = 1;
}
