import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { getUnsupportedPlatformMessage } from './platform.js';

export const SERVICE_LABEL = 't3serve';

export class ServiceError extends Error {}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function createPlist({ home, markerPath, stdoutPath, stderrPath }) {
  const workingDirectory = escapeXml(home);
  const marker = escapeXml(markerPath);
  const stdout = escapeXml(stdoutPath);
  const stderr = escapeXml(stderrPath);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>exec npx --yes t3@nightly serve</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${workingDirectory}</string>
  <key>KeepAlive</key>
  <dict>
    <key>PathState</key>
    <dict>
      <key>${marker}</key>
      <true/>
    </dict>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${stdout}</string>
  <key>StandardErrorPath</key>
  <string>${stderr}</string>
</dict>
</plist>
`;
}

function defaultLaunchctl(args) {
  const result = spawnSync('launchctl', args, { encoding: 'utf8' });

  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? ''
  };
}

export class T3Service {
  constructor({
    home = homedir(),
    uid = process.getuid?.(),
    platform = process.platform,
    launchctl = defaultLaunchctl
  } = {}) {
    this.home = home;
    this.platform = platform;
    this.launchctl = launchctl;
    this.domain = `gui/${uid}`;
    this.target = `${this.domain}/${SERVICE_LABEL}`;
    this.launchAgentsDirectory = join(home, 'Library', 'LaunchAgents');
    this.logsDirectory = join(home, 'Library', 'Logs');
    this.plistPath = join(this.launchAgentsDirectory, `${SERVICE_LABEL}.plist`);
    this.markerPath = join(home, '.t3serve-enabled');
    this.stdoutPath = join(this.logsDirectory, 't3serve.log');
    this.stderrPath = join(this.logsDirectory, 't3serve-error.log');
  }

  assertSupported() {
    const message = getUnsupportedPlatformMessage(this.platform);
    if (message) throw new ServiceError(message);
  }

  inspect() {
    this.assertSupported();
    const result = this.launchctl(['print', this.target]);

    if (!result.ok) {
      return { loaded: false, state: 'not-loaded' };
    }

    const state = result.stdout.match(/^\s*state = (.+)$/m)?.[1] ?? 'unknown';
    return { loaded: true, state };
  }

  isRunning(state) {
    return state === 'running' || state === 'xpcproxy';
  }

  ensureLoaded() {
    if (!existsSync(this.plistPath)) {
      throw new ServiceError("t3serve is not loaded — run 't3serve load' first.");
    }
  }

  run(args, message) {
    const result = this.launchctl(args);
    if (!result.ok) {
      throw new ServiceError(message);
    }
  }

  startLoadedService(current, noOpResult) {
    if (existsSync(this.markerPath) && this.isRunning(current.state)) {
      return noOpResult;
    }

    writeFileSync(this.markerPath, '');
    this.run(['kickstart', '-k', this.target], 'Could not start the t3 server.');
    return 'started';
  }

  load() {
    this.assertSupported();
    const current = this.inspect();

    if (current.loaded) {
      return this.startLoadedService(current, 'already-loaded');
    }

    mkdirSync(this.launchAgentsDirectory, { recursive: true });
    mkdirSync(this.logsDirectory, { recursive: true });
    writeFileSync(this.markerPath, '');
    writeFileSync(this.plistPath, createPlist(this), { mode: 0o644 });
    this.run(['bootstrap', this.domain, this.plistPath], 'Could not load the t3 server service.');
    return 'loaded';
  }

  unload() {
    this.assertSupported();
    const current = this.inspect();

    rmSync(this.markerPath, { force: true });
    if (current.loaded) {
      this.run(['bootout', this.target], 'Could not unload the t3 server service.');
    }
    rmSync(this.plistPath, { force: true });
  }

  start() {
    this.assertSupported();
    this.ensureLoaded();
    const current = this.inspect();

    if (!current.loaded) {
      throw new ServiceError("t3 server is not loaded — run 't3serve load' first.");
    }
    return this.startLoadedService(current, 'already-running');
  }

  stop() {
    this.assertSupported();
    const current = this.inspect();

    if (!current.loaded) {
      throw new ServiceError('t3 server is not loaded.');
    }
    if (!existsSync(this.markerPath)) return 'already-stopped';

    rmSync(this.markerPath, { force: true });
    if (this.isRunning(current.state)) {
      this.launchctl(['kill', 'SIGTERM', this.target]);
    }
    return 'stopped';
  }

  restart() {
    this.assertSupported();
    const current = this.inspect();

    if (!current.loaded) {
      throw new ServiceError("t3 server is not loaded — run 't3serve load' first.");
    }
    if (!existsSync(this.markerPath)) {
      throw new ServiceError("t3 server is stopped — run 't3serve start' first.");
    }

    this.run(['kickstart', '-k', this.target], 'Could not restart the t3 server.');
  }

  status() {
    const current = this.inspect();

    if (!current.loaded) return 'not-loaded';
    if (!existsSync(this.markerPath)) return 'stopped';
    if (current.state === 'xpcproxy') return 'starting';
    if (current.state === 'running') return 'running';
    return 'stopped';
  }
}
