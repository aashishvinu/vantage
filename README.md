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

Deploy the contents of `dist/` to the server that serves `vantages.live`.

If you are using Nginx for a single-page app, make sure unknown routes fall back
to `index.html`.

Example:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## Environment variables

This app expects Vite environment variables at build time. Make sure they are
available in your shell, CI pipeline, or deploy script before running
`npm run build`.
