import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class StartupDetailsError extends Error {}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function defaultRuntimeReady(path) {
  let state;
  try {
    state = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return false;
  }

  if (state.version !== 1 || !Number.isInteger(state.pid)) return false;
  try {
    process.kill(state.pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
}

async function defaultRunT3(args, { timeout = 30_000 } = {}) {
  const { stdout } = await execFileAsync(
    'npx',
    ['--yes', 't3@nightly', ...args],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: Math.max(1, Math.floor(timeout))
    }
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
    maxRetryDelay = 4_000,
    readyDelay = 250,
    timeout = 90_000,
    pairAttempts = 8,
    connectAttempts = 3,
    baseDir = join(homedir(), '.t3'),
    runtimeReady = defaultRuntimeReady
  } = {}) {
    this.runT3 = runT3;
    this.sleep = sleep;
    this.now = now;
    this.retryDelay = retryDelay;
    this.maxRetryDelay = maxRetryDelay;
    this.readyDelay = readyDelay;
    this.timeout = timeout;
    this.pairAttempts = pairAttempts;
    this.connectAttempts = connectAttempts;
    this.baseDir = baseDir;
    this.runtimeReady = runtimeReady;
    this.runtimeStatePath = join(baseDir, 'userdata', 'server-runtime.json');
  }

  async waitForRuntime(deadline) {
    while (this.now() < deadline) {
      if (await this.runtimeReady(this.runtimeStatePath)) return;
      await this.sleep(Math.min(this.readyDelay, deadline - this.now()));
    }
    throw new StartupDetailsError('The t3 server did not become ready.');
  }

  async retryCommand({ args, parse, attempts, deadline, message, retryParseErrors = false }) {
    let lastError;

    for (let attempt = 1; attempt <= attempts && this.now() < deadline; attempt += 1) {
      let output;
      try {
        output = await this.runT3(args, { timeout: deadline - this.now() });
      } catch (error) {
        lastError = error;
      }

      if (output !== undefined) {
        try {
          return parse(output);
        } catch (error) {
          if (!retryParseErrors) throw error;
          lastError = error;
        }
      }

      if (attempt < attempts && this.now() < deadline) {
        const delay = Math.min(
          this.retryDelay * (2 ** (attempt - 1)),
          this.maxRetryDelay,
          deadline - this.now()
        );
        if (delay > 0) await this.sleep(delay);
      }
    }

    throw new StartupDetailsError(
      lastError instanceof Error ? `${message}: ${lastError.message}` : message
    );
  }

  async inspect() {
    const deadline = this.now() + this.timeout;
    await this.waitForRuntime(deadline);
    const pairing = await this.retryCommand({
      args: ['pair', '--base-dir', this.baseDir],
      parse: parsePairOutput,
      attempts: this.pairAttempts,
      deadline,
      message: 'The t3 server did not become ready'
    });
    const t3Connect = await this.retryCommand({
      args: ['connect', 'status', '--json', '--base-dir', this.baseDir],
      parse: parseConnectStatus,
      attempts: this.connectAttempts,
      deadline,
      message: 'Could not read T3 Connect status',
      retryParseErrors: true
    });

    return { ...pairing, t3Connect };
  }
}
