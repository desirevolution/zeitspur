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

## Portable single-HTML download (`file://`)

GitHub version-tag releases attach **two ZIP archives**:

- `zeitspur-vX.Y.Z-static.zip` — the original installable PWA for a web server, Docker, or GitHub Pages.
- `zeitspur-vX.Y.Z-portable.zip` — `zeitspur.html` plus `README.txt`; unzip and double-click the HTML file. **No server, network, service worker, or automatic app updates.**

Generate and verify the portable artifact locally:

```bash
npm install
npm run build:portable
npm run test:portable
# Open portable/zeitspur.html directly in the browser (file://)
```

The portable edition is built from the **same TypeScript and CSS sources** as the PWA, without maintaining a separate UI. Its browser storage is deliberately isolated (`zeitspur-file-v1`) and the database name remains stable across future builds. The earlier *PoC* used a different database name. **Transfer existing data using JSON backup/import.** IndexedDB belongs to the **browser profile + file origin**, not to the HTML file, and persistence/identity for `file://` can vary across browsers or when the file is moved/renamed. Keep a backup before replacing or relocating the file. CSV and JSON formats are unchanged.

**Security/update scope:** No auto-updates means an older local file remains in use until manually replaced; it does not prevent browser updates and does not stop a user from voluntarily opening the repository link. Only run HTML downloaded from a source you trust.

## Development

Requires Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. For a production build run `npm run build`. To run the same validations as GitHub Actions use `npm run test:ci`. It first runs `build:standalone` to create the unbundled `dist/assets/*.js` modules required by the smoke tests, then runs the logic/share/PWA/repository tests, then verifies the portable HTML build, and finally runs the production Vite build. Running `npm run test:logic` directly **after** `npm run build` does not work because Vite bundles the modules instead of retaining those test paths. No other GitHub workflow needs to run beforehand.

Or with a Docker development container and live reload:

```bash
docker compose -f compose.dev.yaml up --build
```

This mounts the project into the container, exposes port 5173, and stores dependencies in a named volume. For a fresh dependency install after changing package versions, restart/recreate the development container. The project currently has no `package-lock.json` (the provided source archive did not include one); dependency versions therefore resolve within the semver ranges during `npm install`. Run `npm install` once in a networked development environment and commit the generated lockfile to make future builds reproducible, then switch CI/Docker to `npm ci`. Do not use the development image for production.
