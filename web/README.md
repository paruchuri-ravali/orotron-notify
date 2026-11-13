# Orotron Notify — Web dashboard

React 19 · Vite 7 · TypeScript (strict) · Tailwind v4 · shadcn/ui (Radix) · TanStack Router + Query · Recharts

## Run locally (demo data, no backend)
    npm install
    npm run dev          # http://localhost:5173  (uses the in-browser mock, see .env.development)

## Scripts
    npm run typecheck    # tsc
    npm run build        # type-check + production bundle in dist/
    npm run preview      # serve dist/ locally

## Structure
    src/
      components/ui/     shadcn/ui primitives (generated; add more with `npx shadcn@latest add <name>`)
      components/ui.tsx  app-level wrappers over shadcn (Button, Card, Select, Modal, useConfirm…)
      components/        Shell, CommandPalette, charts, template preview…
      pages/             one file per route (lazy-loaded)
      lib/               api client, hooks, types, theme, session, email branding
      mock/              dev-only in-browser API (excluded from prod via VITE_USE_MOCK=false)
      router.tsx         route tree (code-split, hover preload)

## Deploy
Static SPA. Build with the real API URL, serve `dist/` from any static host / CDN with SPA fallback to `index.html`.

    docker build --build-arg VITE_API_URL=https://api.yourdomain.com -t orotron-notify-web .
    docker run -p 8080:80 orotron-notify-web

Or S3 + CloudFront (rewrite 403/404 → /index.html), Vercel, Netlify, etc.

## Before production
- The backend does not exist yet; `VITE_USE_MOCK=false` builds will show "backend not reachable" until it does.
- Role-based UI hiding is a convenience only; the backend must enforce RBAC and project isolation.
- Set CORS on the API for the dashboard origin.
