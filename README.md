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

Open `http://localhost:5173`. TypeScript and production build: `npm run build`; tests: `npm run test:logic && npm run test:share && npm run test:pwa && npm run test:github` (run after a build).

Or with a Docker development container and live reload:

```bash
docker compose -f compose.dev.yaml up --build
```

This mounts the project into the container, exposes port 5173, and stores dependencies in a named volume. For a fresh dependency install after changing package versions, restart/recreate the development container. The project currently has no `package-lock.json` (the provided source archive did not include one); dependency versions therefore resolve within the semver ranges during `npm install`. Run `npm install` once in a networked development environment and commit the generated lockfile to make future builds reproducible, then switch CI/Docker to `npm ci`. Do not use the development image for production.

## Deployment & GitHub Actions

| Workflow | Trigger | Result |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Pull requests, non-main branches | Typecheck, build, smoke tests |
| `.github/workflows/docker-release.yml` | Push to `main`, Git tags `v*`, manual | Test, publish `ghcr.io/desirevolution/zeitspur` for `linux/amd64` and `linux/arm64`; on version tags also publish a GitHub Release with a ready-to-host static ZIP |
| `.github/workflows/pages.yml` | Push to `main`, manual | Build and deploy the PWA to GitHub Pages |

Docker tags: `main` on the main branch; version tags (`0.30.0`, `0.30`), and `latest` on version-tag releases; Git commit SHA tags are also published.

**Initial GitHub setup:** Copy these repository files into a clone of `https://github.com/desirevolution/zeitspur`, commit, and push to `main` (see below). In **Settings → Pages → Build and deployment**, select **GitHub Actions**. Allow GitHub Actions to create packages and releases, and configure workflow write access where your organization requires it. The workflows authenticate to GHCR with `GITHUB_TOKEN`; no registry password is required. **After the first GHCR publication, change package visibility to Public** if end users should pull the image without logging in. For the first GitHub release, synchronize `package.json`'s version and push a tag such as `v0.30.0`.

```bash
git tag v0.30.0
git push origin v0.30.0
```

The Vite build uses **relative paths (`base: './'`)**, the manifest uses relative URLs, and the service worker is registered relative to the deployed app directory. This supports both `/` on your own domain and `/zeitspur/` on GitHub Pages. Each origin has **independent IndexedDB data**; changing between localhost, Pages, and a self-hosted domain does **not** sync data. Transfer sessions by JSON backup/restore. Browsers also need the correct HTTPS context for offline PWA functionality.

## Version 0.30 changes

- Disable **Add break** whenever no positive time slot of at least one full minute remains (also when the work duration is zero or existing breaks cover the entire interval).
- The brand icon in the header opens the [Zeitspur repository](https://github.com/desirevolution/zeitspur) in a new tab, with a keyboard-accessible link and localized accessible label.
- Production/development Dockerfiles and Compose configurations; unprivileged Nginx server.
- CI, multi-arch GHCR image publishing, versioned GitHub releases, and GitHub Pages deployment workflows.
- Browser storage schema and CSV/JSON data formats remain unchanged.

Historical release notes and functional details: [`docs/CHANGELOG-ARCHIVE.md`](docs/CHANGELOG-ARCHIVE.md).

## Storage, privacy, backups

- All sessions, preferences and categories remain local to the user's browser (`IndexedDB`). There is no server-side API, login, server backup or multi-device synchronization.
- Exported CSVs use English snake_case column names, local timestamps without offset and English date-range filenames. JSON backup retains unambiguous time data.
- **Back up before clearing browser data or changing the hosting URL.** Docker volumes do not protect local IndexedDB data.
- No public software license has been selected yet. Add one explicitly before inviting third-party reuse.

## Publishing the prepared repository

If you already created the GitHub repository, preserve its history rather than force-pushing or overwriting it:

```bash
git clone https://github.com/desirevolution/zeitspur.git
# Copy the contents of this source archive into the cloned folder (including .github/).
cd zeitspur
git add -A
git commit -m "Prepare Zeitspur 0.30: Docker, CI, release and Pages"
git push origin main
```

Then enable GitHub Pages with **Source: GitHub Actions**, confirm that the workflows succeed, and create the release tag. No upload has been performed by this source package.
