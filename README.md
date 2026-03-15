# Vantage

Vantage is a React + TypeScript + Vite frontend.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The production files are generated in `dist/`.

## VPS / Nginx deployment

This project is set up to run in Docker on the VPS, with Nginx reverse proxying
requests to the container on `127.0.0.1:8000`.

## Environment variables

This app expects Vite environment variables at build time. On the VPS, those
values are read from `docker.env` during `docker compose --env-file docker.env up -d --build`.

## GitHub Actions deployment

This repository includes a workflow that syncs the project to your VPS and runs
`docker compose up -d --build` whenever you push to `main` or `dev`.

Add these GitHub repository secrets before using it:

- `VPS_HOST`: your server IP or hostname
- `VPS_USER`: the SSH user GitHub Actions should log in as
- `VPS_SSH_KEY`: the private SSH key for that user
- `VPS_PORT`: optional SSH port, usually `22`
- `VPS_APP_DIR`: the app directory on the server, for example `/home/aashishvinu/vantage`

Typical `VPS_APP_DIR` example:

- `/home/aashishvinu/vantage`

Your `docker.env` file should stay on the VPS inside that directory and include:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_RADAR_PUBLISHABLE_KEY`

If you only want production deploys from one branch, update
`.github/workflows/deploy.yml` and keep only that branch under `on.push.branches`.
