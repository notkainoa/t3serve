export const LINUX_BACKGROUND_SERVICE_URL =
  'https://github.com/pingdotgg/t3code/blob/main/docs/user/background-service.md';

const PLATFORM_NAMES = {
  linux: 'Linux',
  win32: 'Windows'
};

export function getUnsupportedPlatformMessage(platform) {
  if (platform === 'darwin') return null;

  const name = PLATFORM_NAMES[platform] ?? platform;
  const lines = [
    't3serve only supports macOS.',
    `Detected platform: ${name}.`
  ];

  if (platform === 'linux') {
    lines.push(
      '',
      "On Linux with systemd, use T3 Code's built-in background service:",
      '  npx t3@latest service install',
      '',
      `Learn more: ${LINUX_BACKGROUND_SERVICE_URL}`
    );
  }

  return lines.join('\n');
}
