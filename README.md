# Zeitspur

**Offline-first time tracking, without user accounts or a backend.** Zeitspur is a private, installable PWA; sessions are stored in **IndexedDB in each browser**. No data is transferred to the web server. Export CSV or create JSON backups from the UI.

[GitHub repository](https://github.com/desirevolution/zeitspur) · [GitHub Pages](https://desirevolution.github.io/zeitspur/)

## Quick start (end users)

The recommended installation runs the published **multi-architecture Docker image** (AMD64 and ARM64):

```bash
curl -O https://raw.githubusercontent.com/desirevolution/zeitspur/main/compose.yaml
docker compose up -d
```

Then open `http://localhost:8080`. Override the host port with `ZEITSPUR_PORT=8081 docker compose up -d`. The default bind address is **127.0.0.1**; to expose it on the LAN, explicitly use `ZEITSPUR_BIND=0.0.0.0` and protect access with HTTPS.

The container exposes port 8080 and serves built static files using unprivileged Nginx. **No volume or server database is necessary**: data is in the browser, not the container. **Use HTTPS** when accessing from a different device or installing the PWA; `localhost` is also supported by browsers. For example, proxy to `http://localhost:8080` with Caddy.

The `:latest` image is published after the first version-tag release; the `:main` tag follows pushes to the default branch. Alternatively build the image locally with `docker build -t zeitspur .`.

## Development

Requires Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. For a production build run `npm run build`. To run the same validations as GitHub Actions use `npm run test:ci`. It first runs `build:standalone` to create the unbundled `dist/assets/*.js` modules required by the smoke tests, then runs the logic/share/PWA/repository tests, and finally runs the production Vite build. Running `npm run test:logic` directly **after** `npm run build` does not work because Vite bundles the modules instead of retaining those test paths. No other GitHub workflow needs to run beforehand.

Or with a Docker development container and live reload:

```bash
docker compose -f compose.dev.yaml up --build
```

This mounts the project into the container, exposes port 5173, and stores dependencies in a named volume. For a fresh dependency install after changing package versions, restart/recreate the development container. The project currently has no `package-lock.json` (the provided source archive did not include one); dependency versions therefore resolve within the semver ranges during `npm install`. Run `npm install` once in a networked development environment and commit the generated lockfile to make future builds reproducible, then switch CI/Docker to `npm ci`. Do not use the development image for production.

## Storage, privacy, backups

- All sessions, preferences and categories remain local to the user's browser (`IndexedDB`). There is no server-side API, login, server backup or multi-device synchronization.
- Exported CSVs use English snake_case column names, local timestamps without offset and English date-range filenames. JSON backup retains unambiguous time data.
- **Back up before clearing browser data or changing the hosting URL.** Docker volumes do not protect local IndexedDB data.

## About this project

This project was built with AI assistance. I'm a lazy dev.

## License

[MIT](LICENSE).
