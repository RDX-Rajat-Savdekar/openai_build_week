# Stitch Web — React frontend

Proper SaaS UI for Stitch. **`plan/stitch-project-dashboard.html` is the design mockup only** — this folder is the real source.

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 3
- React Router 7
- Lucide React (UI icons)
- Simple Icons CDN (GitHub, Slack, etc.)

## Scripts

```bash
npm run dev      # http://localhost:5173 (proxies /api → :3000)
npm run build    # → dist/
npm run preview  # preview production build
```

Run from repo root:

```bash
npm run dev          # API + frontend together
npm run frontend:build
```

## Structure

See [setup.md](../setup.md) for full architecture and API wiring.
