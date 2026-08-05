# t3serve

Run T3 Code in the background 24/7 on macOS.

`t3serve` creates a small per-user macOS service for `npx t3@nightly serve`.
It starts when you log in, restarts if it crashes, and stays out of the way.

## Get started

```sh
npm i -g t3-serve
t3-serve load
```

`load` sets up the service and starts the server. You only need it once, or
again after running `unload`.

t3-serve will shows t3code's localhost address, fresh pair token, the
complete pairing URL, and whether T3 Connect is connected, in a nicer format then just the output of npx t3. `start` shows the
same connection details.

Both command names work:

```sh
t3-serve status
t3serve status
```

## Commands

```text
t3serve load         Set up and start the service
t3serve unload       Stop and remove the service
t3serve start        Start the server (if service is already loaded)
t3serve stop         Stop the server (but keeps service loaded, just not running)
t3serve restart      Restart the server
t3serve status       Show the status of the server and service
t3serve help         Show help
```

## Everyday use

After `t3serve load`, these are the commands you will normally use:

```sh
t3serve status
t3serve restart
t3serve stop
t3serve start
```

`stop` keeps the setup in place, so `start` brings the server back later.

Run `t3serve unload` only when you want to stop the server and remove its
macOS setup. To use t3serve again afterward, run `t3serve load`.

## Logs

The server runs from your home directory. Logs are written to:

```text
~/Library/Logs/t3serve.log
~/Library/Logs/t3serve-error.log
```

Follow the live server log with:

```sh
tail -f ~/Library/Logs/t3serve.log
```

## Requirements

- macOS
- Node.js 18 or newer

On Linux you can use T3 Code's built-in background service instead:

```sh
npx t3@latest service install
```

See the [T3 Code background service docs](https://github.com/pingdotgg/t3code/blob/main/docs/user/background-service.md)
for status, updates, and removal instructions.

## Development

```sh
cd [t3-serve repo path]
npm test
npm run check
npm I -g .
npm uninstall -g t3-serve
```

## License

MIT
