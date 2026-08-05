import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class StartupDetailsError extends Error {}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function defaultRunT3(args) {
  const { stdout } = await execFileAsync(
    'npx',
    ['--yes', 't3@nightly', ...args],
    { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30_000 }
  );
  return stdout;
}

export function parsePairOutput(output) {
  const pairUrl = output.match(/^Pairing URL:\s*(.+)$/m)?.[1]?.trim();
  const pairToken = output.match(/^Token:\s*(.+)$/m)?.[1]?.trim();

  if (!pairUrl || !pairToken) {
    throw new StartupDetailsError('T3 did not return complete pairing details.');
  }

  let localUrl;
  try {
    localUrl = new URL(pairUrl).origin;
  } catch {
    throw new StartupDetailsError('T3 returned an invalid pairing URL.');
  }

  return { localUrl, pairToken, pairUrl };
}

export function parseConnectStatus(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');

  if (start === -1 || end < start) {
    throw new StartupDetailsError('T3 did not return its Connect status.');
  }

  let status;
  try {
    status = JSON.parse(output.slice(start, end + 1));
  } catch {
    throw new StartupDetailsError('T3 returned an invalid Connect status.');
  }

  if (typeof status.linked !== 'boolean' || typeof status.desired !== 'boolean') {
    throw new StartupDetailsError('T3 returned an incomplete Connect status.');
  }

  if (status.linked === true) return 'connected';
  if (status.desired === true) return 'connecting';
  return 'not-connected';
}

export class T3StartupInspector {
  constructor({
    runT3 = defaultRunT3,
    sleep = defaultSleep,
    now = Date.now,
    retryDelay = 500,
    timeout = 30_000,
    baseDir = join(homedir(), '.t3')
  } = {}) {
    this.runT3 = runT3;
    this.sleep = sleep;
    this.now = now;
    this.retryDelay = retryDelay;
    this.timeout = timeout;
    this.baseDir = baseDir;
  }

  async inspect() {
    const deadline = this.now() + this.timeout;
    let lastError;
    let pairing;

    do {
      try {
        pairing = parsePairOutput(
          await this.runT3(['pair', '--base-dir', this.baseDir])
        );
        break;
      } catch (error) {
        lastError = error;
        if (this.now() >= deadline) break;
        await this.sleep(this.retryDelay);
      }
    } while (this.now() < deadline);

    if (!pairing) {
      throw new StartupDetailsError(
        lastError instanceof Error
          ? `The t3 server did not become ready: ${lastError.message}`
          : 'The t3 server did not become ready.'
      );
    }

    try {
      const t3Connect = parseConnectStatus(
        await this.runT3(['connect', 'status', '--json', '--base-dir', this.baseDir])
      );
      return { ...pairing, t3Connect };
    } catch (error) {
      throw new StartupDetailsError(
        error instanceof Error
          ? `Could not read T3 Connect status: ${error.message}`
          : 'Could not read T3 Connect status.'
      );
    }
  }
}
