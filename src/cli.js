import { ServiceError, T3Service } from './service.js';
import { blue, bold, cyan, gray, ui as defaultUi } from './ui.js';

export const VERSION = '0.1.0';

function showHelp(ui) {
  ui.line(`${bold(blue('t3serve'))}  ${gray('— keep the T3 server running')}`);
  ui.line();
  ui.line(`  ${bold('Usage')}  t3serve ${cyan('<command>')}`);
  ui.line();
  ui.line(`  ${cyan('load')}         Set up and start the service`);
  ui.line(`  ${cyan('unload')}       Stop and remove the service`);
  ui.line(`  ${cyan('start')}        Start the server`);
  ui.line(`  ${cyan('stop')}         Stop the server`);
  ui.line(`  ${cyan('restart')}      Restart the server`);
  ui.line(`  ${cyan('status')}       Show the server status`);
  ui.line(`  ${cyan('help')}         Show this help`);
  ui.line();
}

function reportStatus(status, ui) {
  if (status === 'running') ui.success(`t3 server: ${bold('running')}`);
  else if (status === 'starting') ui.warning(`t3 server: ${bold('starting')}`);
  else if (status === 'stopped') ui.warning(`t3 server: ${bold('stopped')}`);
  else ui.warning(`t3 server: ${bold('not loaded')}`);
}

export function runCli(args, { service = new T3Service(), ui = defaultUi } = {}) {
  const [command, ...extraArgs] = args;

  if (!command || ['help', '--help', '-h'].includes(command)) {
    showHelp(ui);
    return 0;
  }
  if (['version', '--version', '-v'].includes(command)) {
    ui.line(VERSION);
    return 0;
  }
  if (extraArgs.length > 0) {
    ui.error(`'${command}' does not take any arguments.`);
    return 1;
  }

  try {
    switch (command) {
      case 'load': {
        const result = service.load();
        if (result === 'already-loaded') ui.info('t3 server: already loaded');
        else ui.success(`t3 server: ${bold('loaded and running')}`);
        break;
      }
      case 'unload':
        service.unload();
        ui.warning(`t3 server: ${bold('unloaded')}`);
        break;
      case 'start': {
        const result = service.start();
        if (result === 'already-running') ui.info('t3 server: already running');
        else ui.success(`t3 server: ${bold('started')}`);
        break;
      }
      case 'stop': {
        const result = service.stop();
        if (result === 'already-stopped') ui.info('t3 server: already stopped');
        else ui.warning(`t3 server: ${bold('stopped')}`);
        break;
      }
      case 'restart':
        service.restart();
        ui.success(`t3 server: ${bold('restarted')}`);
        break;
      case 'status':
        reportStatus(service.status(), ui);
        break;
      default:
        ui.error(`Unknown command: ${bold(command)}`);
        ui.line(`  Run ${bold('t3serve help')} to see what is available.`);
        return 1;
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      ui.error(error.message);
      return 1;
    }
    throw error;
  }

  return 0;
}
