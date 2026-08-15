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
