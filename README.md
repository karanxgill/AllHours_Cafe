# All Hours Cafe

All Hours Cafe is a cafe ordering and reservation app being rebuilt from the original ASP.NET MVC project. The replacement uses React and TypeScript for the customer and admin interface, Express and TypeScript for the API, Prisma for data access, and Neon PostgreSQL for persistence.

## Stack

- React, TypeScript, Vite
- Node.js, Express, TypeScript
- PostgreSQL, Prisma 7, Neon
- Zod request validation
- Signed, HTTP-only session cookies

## Run locally

Use Node.js 22.12 or newer. Install dependencies from this directory:

```sh
npm install
```

Create `apps/api/.env` using `apps/api/.env.example` as a template. Set `DATABASE_URL` to the Neon pooled connection URL, `SESSION_SECRET` to a random secret of at least 32 characters, and `WEB_ORIGIN` to the local web origin. Keep real credentials in the ignored `.env` file; never commit them.

Start the web app and API together:

```sh
npm run dev
```

Vite runs on port 5173 and proxies `/api` requests to the API on port 5001. Check `/api/v1/health` for API availability and `/api/v1/health/database` for the database connection.

## Current functionality

- Public home, About, Contact, and menu pages
- Menu search, category selection, dietary filters, and browser-local cart
- Signup, signin, signout, and current-user lookup
- Pickup checkout and server-priced order creation; online payment is not connected
- Reservation requests and owner-scoped reservation status
- Role-protected admin dashboard, menu/category management, and order status updates
- Prisma schema and initial PostgreSQL migration

The database starts without catalog data. Add categories and menu items through the admin pages. New signups receive the `User` role; an administrator must be provisioned deliberately before admin pages can be used.

## Build

```sh
npm run build
npm run typecheck
```

## Readiness work remaining

The app is not yet deployed or ready to describe as a production service. Before launch, complete and verify these items:

1. Add automated API and browser-flow checks for signup/signin, menu filtering, cart and pickup orders, reservations, contact submission, and admin access.
2. Add rate limiting and spam controls to public endpoints, plus password reset and email delivery.
3. Complete the reservation and order payment decision and implement a provider flow with verified, idempotent callbacks before collecting online payments.
4. Finish admin reservation/contact workflows and define a safe administrator provisioning procedure.
5. Seed reviewed demo menu content and images, then confirm the deployed database has the expected schema and migrations.
6. Deploy the web app and API over HTTPS, configure production secrets and origins, and verify the full flows against Neon.
7. Add screenshots, a hosted demo link, and a concise architecture/features section when the deployment is stable.

The original application remains in the sibling `../AllHoursCafe/` directory as the behavior reference. The new app intentionally starts with fresh user and catalog data rather than migrating records.
