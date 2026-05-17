# Easy RSVP

Wedding invitation and RSVP app: unique **share links** per guest, optional **wishes**, **ID/EN** invitation pages, **admin** dashboard with stats and activity (including per-load **page views**). Built from the spec in [`spec/initial-spec.md`](spec/initial-spec.md).

**Stack:** Next.js 14 (App Router) · Tailwind CSS · Firestore · Firebase Auth · Firebase Admin (server-only)

---

## Features

- Public **`/rsvp/[token]`** — confirm / decline, optional wishes, thank-you + global **event details** (`event_config/current`).
- **Statuses:** `pending`, `accepted`, `declined`, `expired`, `revoked` — renew / reopen / revoke from admin (no hard deletes).
- **Roles:** `viewer`, `editor`, `super Admin` — see spec for permissions.
- **Bootstrap** first `super_admin` via `/admin/bootstrap` (disabled once a super admin exists).
- **Cron:** `POST /api/cron/expire` marks overdue pending invitations as `expired`.

---

## Prerequisites

- Node.js 18+
- A [Firebase](https://firebase.google.com/) project with **Authentication** (Email/Password) and **Firestore**

---

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit **`.env.local`:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase **web** app config (client SDK) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Service account JSON as a **single-line** string (Admin SDK on the server) |
| `SUPER_ADMIN_BOOTSTRAP_PASSKEY` | One-time gate for `/admin/bootstrap` until a `super_admin` exists |
| `CRON_SECRET` | Optional. If set, `/api/cron/expire` requires `Authorization: Bearer …` or `x-cron-secret` |

### Firebase Console

1. Enable **Email/Password** sign-in.
2. Create a **Firestore** database.
3. Deploy security rules (this repo includes [`firestore.rules`](firestore.rules) — **deny all** client access; the app uses Admin SDK only).
4. Deploy indexes from [`firestore.indexes.json`](firestore.indexes.json) (Firebase CLI: `firebase deploy --only firestore:indexes`, or create indexes when the console suggests them).

### First admin

1. Start the app: `npm run dev`
2. Open **`/admin/bootstrap`**, submit the passkey and account details.
3. Sign in at **`/admin/login`**.

---

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # production server (after build)
npm run lint     # ESLint
```

---

## Deployment notes

- **Vercel:** [`vercel.json`](vercel.json) schedules an hourly hit to `/api/cron/expire`. Set **`CRON_SECRET`** in Vercel project env so the cron request can send `Authorization: Bearer <CRON_SECRET>` (see Vercel cron + secure cron docs).
- Ensure all **`NEXT_PUBLIC_*`** and **`FIREBASE_SERVICE_ACCOUNT_KEY`** (and optional **`CRON_SECRET`**) are set in the hosting environment.

---

## Project layout (high level)

| Path | Role |
|------|------|
| `app/rsvp/[token]` | Guest invitation UI |
| `app/admin/*` | Admin UI (login, bootstrap, dashboard, invitations, event details, users) |
| `app/api/public/*` | Public invitation fetch, view logging, RSVP |
| `app/api/admin/*` | Authenticated admin APIs (Bearer ID token) |
| `app/api/auth/bootstrap` | First super admin registration |
| `app/api/cron/expire` | Expiry job |

---

## Specification

Product behavior and data model are described in **`spec/initial-spec.md`** (and Q&A files under `spec/` where relevant).
