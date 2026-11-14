# All Hours Cafe: technology audit and migration blueprint

## Executive summary

This repository is a server-rendered ASP.NET Core MVC application targeting .NET 8. The README is stale: it says .NET 6, while the project targets `net8.0`. It is not currently a conventional MERN project. The API project also owns the Razor web app, static assets, authentication, business logic, EF Core migrations, and payment callbacks.

Recommended target: **React + TypeScript + Vite**, **Node.js + TypeScript + Express**, **Prisma**, and **Neon PostgreSQL**. This maps well to a MERN developer and PostgreSQL preference. The original MySQL/EF Core app stays a separate legacy system during migration; data transfer becomes an explicit MySQL-to-PostgreSQL migration. Use REST under `/api/v1`; use secure HttpOnly cookie sessions for browser auth rather than localStorage JWTs.

## Existing stack

| Area | Current implementation | Migration consequence |
|---|---|---|
| Runtime/web | ASP.NET Core MVC, .NET 8 | Replace MVC/Razor with Express API and React SPA |
| Persistence | EF Core 8, Pomelo MySQL provider, MySQL 8 | Existing source remains on MySQL; migrate data and schema into Neon PostgreSQL explicitly |
| Views | Razor `.cshtml`; customer, admin, auth, checkout, reservations | Rebuild each page/flow as typed React routes |
| Browser behavior | HTML/CSS/JS, Bootstrap, jQuery validation | Reuse visual assets selectively; replace imperative JS with React |
| Auth | Cookie authentication plus JWT bearer selector; BCrypt and legacy SHA-256 verification | Standardize on server-side cookie session, BCrypt verification/rehash, role middleware |
| Email | MailKit SMTP password-reset service | Node mail adapter; externalize credentials |
| Payments | PayU form/hash service, checkout and reservation return routes | Server-owned PayU initiation, signature/callback validation, idempotent status transitions |
| Upload/import | EPPlus Excel bulk menu upload; local image paths | Validate spreadsheet and image uploads; use object storage in production |
| API docs | Swagger/Swashbuckle; a few JSON routes | OpenAPI for the complete REST surface |

## Functionality inventory

### Customer-facing

- Home/landing page with featured items/highlights, cafe information, About and Contact pages.
- Menu categories and items; category filtering, search, item details, dietary labels (vegetarian/vegan/gluten-free), spice level, prep time, calories, images, active/inactive state.
- Cart: add/update quantities, retrieve/save/clear cart. Current cart data is session-backed and includes client-supplied price/name; target must resolve prices from the database at checkout.
- Account: signup, login, logout, profile fields, role assignment defaulting to User, active account status, password reset email and reset token expiry.
- Saved addresses: list/read/create/update/delete, mark default, capture from order/form; account association and current email-based guest-related paths need explicit authorization review.
- Checkout: delivery or pickup; customer/contact/address/special instructions, schedule time, subtotal/delivery fee/tax/total, order + line items, payment selection and success/failure/confirmation pages.
- PayU order payment: initiation form/hash, callback/success/failure state changes, and several alternate/debug payment routes/views.
- Reservations: date/time/party size (1–20), contact details/special requests, confirmation, fixed payment amount, PayU workflow and payment status.
- Contact: submit name/email/subject/message; admin sees/read-marks/deletes submissions.
- Responsive layouts, animation, navbar, image fallbacks and client-side validation.

### Admin and privileged operations

- Dashboard summaries for orders, reservations and users.
- Menu item create/read/update/delete, multiple overlapping create pages, image URL editing, bulk Excel import.
- Category create/read/update/delete; category deletion blocked when items remain.
- Menu highlight CRUD with section, display order, custom title/description/image, active state.
- Reservations list/detail/delete; orders list/detail; contacts list/detail/read/delete.
- User list/detail; role changes; enable/disable; Admin vs SuperAdmin restrictions. SuperAdmin cannot change own role; only SuperAdmin can assign Admin/manage roles and disable accounts; SuperAdmin inherits Admin capabilities.
- Seeded categories, DB seeding and a default SuperAdmin creation path.

## Data model carried into target

Core tables/entities: `User`, `Category`, `MenuItem`, `MenuHighlight`, `Reservation`, `Order`, `OrderItem`, `Contact`, `SavedAddress`. Cart is currently transient session JSON rather than a durable relational table. Important relations: Category 1—many MenuItems; Order 1—many OrderItems; User 1—many SavedAddresses; MenuHighlight references MenuItem. Preserve IDs and monetary precision when migrating.

The repository contains EF migrations dating from April 2025 that must be compared with the *live* MySQL schema before Prisma is pointed at production. EF migration history is not automatically a Prisma migration history. Generate an introspected Prisma schema, verify all column names/types/indexes/foreign keys, and take a tested backup before any schema/data operation.

## Target architecture

```text
React SPA (Vite, TypeScript, React Router, TanStack Query, React Hook Form + Zod)
             │ same-site HTTPS, JSON REST, HttpOnly session cookie
Express API (TypeScript, Zod validation, service layer, role middleware, OpenAPI)
   ├── Prisma 7 + Neon adapter → Neon PostgreSQL
   ├── SMTP adapter → email provider
   ├── PayU adapter → hosted payment form/callback verification
   └── object storage adapter → menu/highlight images (local in development)
```

Organize code by domain (`auth`, `menu`, `cart`, `orders`, `reservations`, `addresses`, `contacts`, `admin`) with routes → validation → services → Prisma. Keep payment secrets and all payment hash generation server-side. Use database transactions when creating orders and line items; calculate prices/taxes server-side; make gateway callbacks idempotent. Apply CSRF protection to cookie-authenticated mutations, secure/sameSite cookies, rate limits to auth/contact/payment endpoints, and explicit CORS origins.

Suggested workspace:

```text
apps/web/                 React pages, layouts, shared UI, typed API client
apps/api/src/domains/     Express routers, schemas, services, auth/payment adapters
apps/api/prisma/          introspected schema + reviewed migrations
packages/contracts/       shared request/response types and Zod schemas
```

## Migration sequence

1. **Inventory and freeze contracts:** document each current route, form fields, validation, side effects, role requirements, and payment callback behavior. Identify duplicate/obsolete payment paths and choose one supported PayU flow.
2. **Secure configuration:** move DB, SMTP, JWT/session, and PayU credentials out of tracked config; rotate credentials that have been committed. Configure target environment through secret management.
3. **Schema/data compatibility:** the reviewed initial schema migration is applied to Neon. Before transferring records, back up MySQL and Neon, then map existing MySQL rows into PostgreSQL and validate row counts, IDs, indexes, nullable fields, decimal precision, date/time semantics and foreign keys. Never run further schema changes against production until reviewed.
4. **Build API first:** health/config, auth/roles, public menu, addresses, cart/checkout/order, reservations, contacts, admin CRUD/import/highlights. Publish OpenAPI and typed contracts. Preserve existing password verification during transition, then rehash to BCrypt and retire weak legacy hashes.
5. **Build React in slices:** public shell/home/menu; account/auth; cart/checkout; reservations/contact; admin dashboard and management. Match current workflows and retain responsive assets/styles where useful.
6. **Verify parity:** exercise public pages, validation, role boundaries, email reset, address ownership, stock/price recalculation, payment success/failure/replay, and data reconciliation against a staging database.
7. **Cut over gradually:** deploy API and UI alongside MVC, route a small cohort or staging domain, reconcile orders/payments, then retire MVC only after rollback window and operational checks.

## Risks / issues found during inspection

- `appsettings.json` contains credentials and payment configuration in source. Treat those values as exposed: rotate DB, SMTP/app-password and PayU credentials, remove secrets from source/history, and use environment secrets. They are intentionally not reproduced here.
- README says .NET 6 although code targets .NET 8; setup instructions and stated repository-pattern claim do not accurately describe the implementation (the controllers directly use `ApplicationDbContext`).
- API config enables `AllowAnyOrigin` CORS and has a fallback JWT secret. A separate React origin plus cookie auth requires a strict origin allowlist and CSRF defenses.
- Auth supports a legacy SHA-256 password check alongside BCrypt. Do not migrate this to a simple JWT-only implementation; use a controlled password rehash/migration path.
- Cart accepts price/name from browser payload; checkout must re-fetch authoritative menu data and compute totals server-side.
- Payment routes/views have several variants and success routes that directly mutate order/reservation status. Verify gateway signatures and idempotency before recreating; a browser redirect alone is not proof of payment.
- Reservation/order timestamps mix `UtcNow` and local `Now`; define timezone and store UTC instants plus explicit local booking date/time semantics.
- Menu image and Excel upload paths are local filesystem paths; deployment persistence and validation need a target storage design.
- Development seeding creates administrative access. Never carry a known default credential into a deployed environment.

## Source implementation review (2026-11-14)

The controller and entity review confirms the feature list above and adds these implementation details for the port:

| Domain | Current behavior to preserve or deliberately change |
|---|---|
| Authentication | Signup, login, logout, forgot/reset password. Login accepts BCrypt and legacy Base64 SHA-256 hashes and upgrades a verified legacy hash to BCrypt. Account `IsActive` is checked at login. Password reset stores a token and UTC expiry and returns a generic response for unknown emails. Signup binds the role from the posted view model, so the replacement must hard-set `User` server-side. The old app issues both an auth cookie and a JWT cookie; replacement should have one browser session mechanism. |
| Public menu | Home loads active highlights whose linked menu item is active. Menu exposes active categories, category items, all active items, and text search. Item fields include dietary flags, spice, prep time, calories and image URL. |
| Cart | `CartController` stores serialized cart lines in ASP.NET session; cart lines include client-provided name/price/image. There is no persisted cart table in the EF context. The new service may retain a guest/session cart, but checkout must reprice every item from `MenuItem`. |
| Checkout/orders | Checkout collects customer/contact/delivery fields and delivery-vs-pickup, optional requested time, instructions, and price components. `Order` stores a snapshot of address, line-item name/price/quantity/total, payment method/status/details, and order status. Existing `OrderItem.MenuItemId` is a scalar, not an EF relationship; `OrderItems.OrderId` is a cascade FK. No `UserId` is stored on Order. |
| Reservations | Public create validates guest count 1–20 and collects name/email/phone/date/time/requests. A fixed payment amount and PayU status/transaction fields are stored. Success/failure/PayU routes exist in multiple variants and must be consolidated only after callback behavior is checked end-to-end. |
| Saved addresses | Authenticated list/create/update/delete/default/from-order operations are provided. A separate anonymous `FromForm` endpoint also exists. Persisted addresses belong to `User`; EF migration configures cascade delete. Ownership must be enforced by the session user on every ID-based operation. |
| Contact | Public contact submission validates name, email, subject and message. Admin can list/detail, mark read and delete. |
| Admin | Admin/SuperAdmin can manage menu items, categories, orders, reservations, contacts, users, and highlights. SuperAdmin-only actions change roles and account status; a SuperAdmin cannot demote their own account. Bulk spreadsheet import is decorated Admin-only. SuperAdmin receives effective Admin access. Category deletion checks for linked menu items. |
| Media/import | Menu item image URLs are stored as strings; highlights can upload an image and bulk menu import accepts an Excel file. Current filesystem storage is deployment-dependent and needs a storage adapter in the rebuild. |

### Prisma draft review before migration

The initial Prisma schema covers the nine persisted EF entities (`User`, `Category`, `MenuItem`, `MenuHighlight`, `Reservation`, `Order`, `OrderItem`, `Contact`, `SavedAddress`). Cart is intentionally absent because it is session data in the source. The reviewed initial migration is applied to Neon. These are the schema decisions represented in it:

1. **Chosen:** use PostgreSQL lowercase snake_case tables/columns. The migration/ETL maps legacy PascalCase source columns to the target names explicitly; all primary keys use lowercase `id`.
2. **Chosen:** preserve the EF cascade rules for `Category -> MenuItem`, `MenuItem -> MenuHighlight`, `Order -> OrderItem`, and `User -> SavedAddress`. Catalog items used by historical orders remain independent of line items, and catalog deactivation is preferred over deleting items that appear in orders.
3. **Chosen:** keep `OrderItem.MenuItemId` as a scalar without a menu-item FK; order line name, price, quantity and total are historical snapshots.
4. **Chosen:** add nullable `Order.UserId` to support account order history while retaining guest checkout. Deleting a user sets this reference to null and preserves the order.
5. The draft stores `password_reset_token_hash` plus expiry so the API can validate reset tokens without persisting the raw token. Store roles and payment/order states as validated values in application contracts; database enums can wait until their allowed transitions are confirmed.
6. Preserve `Decimal(18,2)` for menu/order/payment money. The old initial order-item migration used a much wider decimal precision; migration/import must explicitly check and normalize values to two decimal places.
7. **Still to settle during reservation API implementation:** define reservation date/time semantics and cafe timezone before changing the current timestamp-shaped fields to PostgreSQL `date`/`time`. The source stores both as `DateTime` and mixes local/UTC timestamp conventions elsewhere.

### Proposed initial database scope

The initial reviewed schema should include: users and role/account status; categories and menu items; menu highlights; reservations with payment reference/status; orders with address and amount snapshots; order items with historical name/price snapshots; contacts; and user-owned saved addresses. It should exclude carts, email delivery logs, image binary data, PayU secrets, and computed dashboard totals. Indexes should cover unique normalized email, menu category/active filtering, reservation and order creation/status lookup, contacts' read/created state, and saved-address owner/default lookup. Payment attempts may warrant a separate table once the single supported PayU callback flow is chosen.

### Schema migration and data migration plan

1. The generated SQL in `apps/api/prisma/migrations/20261113100000_init/migration.sql` was reviewed and applied. Prisma reports no pending migrations; `public` contains the nine application tables plus `_prisma_migrations`.
2. Build feature slices against that schema. For data transfer, back up MySQL first and run a separate, repeatable ETL with row counts, ID/FK checks, decimal comparisons, and password-hash compatibility checks.

## Rebuild progress

- Neon schema: the reviewed initial migration is applied; no customer or catalog records have been seeded or migrated.
- Signup/signin slice: React pages reuse the legacy auth form styles and logo. Express provides signup, login, logout, and current-user endpoints with normalized email, server-assigned `User` role, scrypt password hashing, a signed HttpOnly SameSite=Lax cookie, origin checking on auth mutations, and account-active checks.
- Homepage slice: React renders the original hero, feature cards, menu-highlight sections, story/about block, reservation call-to-action, and footer using copied legacy CSS and images. `GET /api/v1/home` loads active database highlights; when the new database has no highlights yet, the page uses the same sample breakfast/beverage content as the original view.
- Fresh user start: legacy password-hash compatibility is not needed because user accounts are intentionally not migrated. Existing customers will need to create new accounts.
- Still pending in auth: forgot/reset password email flow and rate limiting; production deployment also needs broader session/CSRF hardening.
- Menu slice: React `/menu` loads active categories and menu items from Prisma-backed Express endpoints, and supports category selection, case-insensitive name/description/category search, and vegetarian/vegan/gluten-free filters. Item cards preserve price, image, descriptions, and dietary/spice badges. Add-to-cart saves an item snapshot in browser local storage and updates the shared header count. Neon is currently empty of catalog records, so the menu correctly shows its empty state until items are created.
- Cart/order slice: React `/cart` supports quantity changes and removal; `/checkout` requires sign-in, collects delivery or pickup information, and shows an order estimate; `/orders/:id` shows the saved confirmation. `POST /api/v1/orders` validates the session and submitted item IDs, fetches current active prices from Neon, recalculates the 5% tax and ₹30 delivery fee, and creates the order plus historical item snapshots together. Payment is not processed yet; these orders use `Pay at cafe` with pending payment status. Order lookup is scoped to the signed-in owner. No order was submitted during implementation.
- Reservation slice: public `/reservations` information/policy page plus authenticated `/reservations/create` request form and `/reservations/:id` status view. The API validates future local date/time, guest count and input lengths, takes the email from the signed-in account, and stores requests with `IsConfirmed=false` and payment pending. The original requires a ₹500 PayU fee before confirmation; PayU has not been ported, so the new UI clearly states requests remain unconfirmed and no payment is collected. Confirmation lookup is restricted to the account email. No reservation was submitted during implementation.
- Contact slice: React `/contact` retains the cafe's contact details and public message form. `POST /api/v1/contacts` trims and validates name, email, subject, and message length, normalizes email, and saves a new unread message in Neon. The original controller also only stores and logs the submission; this port does not send email. Rate limiting/spam protection and email notifications remain future work. No message was submitted during implementation.
- Admin dashboard/catalog/orders slice: React `/admin`, `/admin/menu-items`, `/admin/categories`, and `/admin/orders` provide overview metrics, recent reservations/messages, catalog create/edit, order list/status filters, and order details with fulfillment status updates. Express `/api/v1/admin/*` checks the signed-in account's active status and Admin/SuperAdmin role on every request. Catalog records can be hidden by marking them inactive; there is no hard-delete flow. Order status accepts Pending, Confirmed, Preparing, Ready, Delivered, Completed, or Cancelled. Payment status remains read-only until a payment integration exists. Image fields accept URLs; upload storage is not implemented. The remaining admin workflows (reservation management, contact read status, users/roles, highlights, bulk import) are pending. New signups receive the `User` role, so the initial administrator role must be granted through an explicitly controlled database/admin setup process.

## First-pass page/API mapping

| Current area | Target React route | Target API domain |
|---|---|---|
| Home/About/Contact | `/`, `/about`, `/contact` | `GET /home`, `POST /contacts` |
| Menu | `/menu` | `GET /api/v1/menu/categories`, `GET /api/v1/menu/items` with `categoryId`, `search`, `vegetarian`, `vegan`, and `glutenFree` query filters |
| Auth/password reset | `/login`, `/signup`, `/forgot-password`, `/reset-password` | `/auth/*`, `/users/me` |
| Cart/checkout/payment | `/cart`, `/checkout`, `/orders/:id` | `GET/POST /api/v1/orders`; PayU endpoints are pending |
| Reservation | `/reservations`, `/reservations/create`, `/reservations/:id` | `POST/GET /api/v1/reservations`; PayU endpoints are pending |
| Saved addresses | `/account/addresses` | `/addresses/*` |
| Admin | `/admin/*` | `/admin/dashboard`, `/admin/menu-items`, `/admin/categories`, `/admin/orders`, `/admin/reservations`, `/admin/users`, `/admin/contacts`, `/admin/highlights` |

This document is a source-code audit and migration blueprint. The admin dashboard and catalog slice above is now implemented in the replacement; other listed admin workflows are still pending.
