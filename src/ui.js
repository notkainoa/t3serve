const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

const paint = (code, text) => useColor ? `\u001b[${code}m${text}\u001b[0m` : text;

export const bold = (text) => paint('1', text);
export const blue = (text) => paint('34', text);
export const cyan = (text) => paint('36', text);
export const green = (text) => paint('32', text);
export const red = (text) => paint('31', text);
export const gray = (text) => paint('38;5;245', text);
export const yellow = (text) => paint('33', text);

export function createSpinner(message, output = process.stdout) {
  if (!output.isTTY) return { stop() {} };

  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  output.write(`${cyan(frames[frame])} ${message}`);
  const timer = setInterval(() => {
    frame = (frame + 1) % frames.length;
    output.write(`\r\u001b[2K${cyan(frames[frame])} ${message}`);
  }, 80);
  timer.unref();

  return {
    stop() {
      clearInterval(timer);
      output.write('\r\u001b[2K');
    }
  };
}

export const ui = {
  line(message = '') {
    console.log(message);
  },
  success(message) {
    console.log(`${green('●')} ${message}`);
  },
  info(message) {
    console.log(`${cyan('●')} ${message}`);
  },
  warning(message) {
    console.log(`${yellow('○')} ${message}`);
  },
  error(message) {
    console.error(`${red('✗')} ${message}`);
  },
  spinner(message) {
    return createSpinner(message);
  }
};
