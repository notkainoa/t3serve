# t3serve

Keep `npx t3@nightly serve` running on macOS.

`t3serve` installs a small per-user launchd service. It starts when you log in,
restarts if it crashes, and gives you simple commands to control it.

## Install

```sh
npm i -g t3serve
t3serve load
```

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

The server runs from your home directory. Logs are written to:

```text
~/Library/Logs/t3serve.log
~/Library/Logs/t3serve-error.log
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
