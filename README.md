# DIP Enterprise

Next.js enterprise ops platform (sales, purchases, inventory, expenses, CCTV/fleet).

## Quick start

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Demo logins after seed:
- `admin@dipenterprise.com` / `Admin@123`
- `staff@dipenterprise.com` / `Staff@123`

## Scripts

- `npm run build` — Prisma generate + Next.js production build
- `npm run start` — production server
- `npm run db:seed` — seed demo data

## Automation

GitHub Actions (on every push to `main`):

- **CI Build** — install, Prisma, production build
- **Upload Latest Code Artifact** — packs source into a downloadable artifact

Manual push helper:

```bash
export GITHUB_TOKEN=...   # Contents: Read and write
./scripts/push-latest.sh
```

Workflow runs: https://github.com/dipenterprisebongaonde/Dip-Enterprise-website-design/actions
