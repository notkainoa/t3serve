import { ServiceError, T3Service } from './service.js';
import { StartupDetailsError, T3StartupInspector } from './startup.js';
import { blue, bold, cyan, gray, green, ui as defaultUi, yellow } from './ui.js';

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
}

function reportStatus(status, ui) {
  if (status === 'running') ui.success(`t3 server: ${bold('running')}`);
  else if (status === 'starting') ui.warning(`t3 server: ${bold('starting')}`);
  else if (status === 'stopped') ui.warning(`t3 server: ${bold('stopped')}`);
  else ui.warning(`t3 server: ${bold('not loaded')}`);
}

function connectLabel(status) {
  if (status === 'connected') return green('Connected');
  if (status === 'connecting') return yellow('Connecting…');
  if (status === 'not-connected') return gray('Not connected');
  return gray('Unknown');
}

function reportStartupDetails(details, ui) {
  ui.line(`  ${gray('Localhost'.padEnd(12))}${cyan(details.localUrl)}`);
  ui.line(`  ${gray('Pair token'.padEnd(12))}${details.pairToken}`);
  ui.line(`  ${gray('Pair URL'.padEnd(12))}${cyan(details.pairUrl)}`);
  ui.line(`  ${gray('T3 Connect'.padEnd(12))}${connectLabel(details.t3Connect)}`);
  ui.line();
  ui.success(`t3 server: ${bold('running')}`);
}

async function showStartup(serviceResult, command, inspector, ui) {
  if (command === 'load') {
    if (serviceResult === 'already-loaded') ui.info('t3 server: already loaded · checking');
    else ui.info('t3 server: loaded · starting');
  } else if (serviceResult === 'already-running') {
    ui.info('t3 server: already running · checking');
  } else {
    ui.info('t3 server: starting');
  }

  const spinner = ui.spinner('Waiting for connection details…');
  try {
    const details = await inspector.inspect();
    spinner.stop();
    reportStartupDetails(details, ui);
  } catch (error) {
    spinner.stop();
    if (error instanceof StartupDetailsError) {
      throw new ServiceError(
        `${error.message}\n  Check ~/Library/Logs/t3serve-error.log for details.`
      );
    }
    throw error;
  }
}

export async function runCli(
  args,
  {
    service = new T3Service(),
    inspector = new T3StartupInspector(),
    ui = defaultUi
  } = {}
) {
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
        await showStartup(result, command, inspector, ui);
        break;
      }
      case 'unload':
        service.unload();
        ui.warning(`t3 server: ${bold('unloaded')}`);
        break;
      case 'start': {
        const result = service.start();
        await showStartup(result, command, inspector, ui);
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
