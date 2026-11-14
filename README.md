# All Hours Cafe

All Hours Cafe is a full-stack cafe website where customers can explore the menu, place pickup orders, and request reservations. Staff can manage menu categories, menu items, and incoming orders from an admin dashboard.

## Features

- Responsive home, menu, About, and Contact pages
- Menu search, category selection, and dietary filters
- Customer accounts and sign-in
- Shopping cart and pickup checkout
- Reservation requests and request status page
- Admin dashboard for menu, category, and order management

## Built with

- React, TypeScript, and Vite
- Node.js, Express, and TypeScript
- PostgreSQL, Prisma, and Neon
- Zod for API input validation

## Run locally

You’ll need Node.js 22.12 or newer and a PostgreSQL database.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create `apps/api/.env` from `apps/api/.env.example`. Set `DATABASE_URL` to your PostgreSQL connection string, `SESSION_SECRET` to a random value with at least 32 characters, and `WEB_ORIGIN` to `http://localhost:5173`.

3. Start the app:

   ```sh
   npm run dev
   ```

The web app runs at [http://localhost:5173](http://localhost:5173), and the API runs on port 5001. The API health endpoints are `/api/v1/health` and `/api/v1/health/database`.

The menu is managed through the admin dashboard. An admin account is required to use admin tools.

## Build

```sh
npm run build
npm run typecheck
```
