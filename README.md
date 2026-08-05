# t3serve

Keep `npx t3@nightly serve` running on macOS.

`t3serve` creates a small per-user macOS service for `npx t3@nightly serve`.
It starts when you log in, restarts if it crashes, and stays out of the way.

## Get started

```sh
npm i -g t3serve
t3serve load
```

`load` sets up the service and starts the server. You only need it once, or
again after running `unload`.

Both command names work:

```sh
t3serve status
t3-serve status
```

## Commands

```text
t3serve load         Set up and start the service
t3serve unload       Stop and remove the service
t3serve start        Start the server
t3serve stop         Stop the server
t3serve restart      Restart the server
t3serve status       Show the server status
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

## Development

```sh
npm test
npm run check
```

## License

MIT
