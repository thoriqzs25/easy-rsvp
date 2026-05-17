# Wedding RSVP System — Implementation Summary

> Stack: **Next.js 14 (App Router)** · **Firestore** · **Firebase Auth** (for admin JWT)  
> Every invitation implicitly includes a **+1**. The app **does not** enforce seat caps; it **shows counts** (e.g. how many `accepted`) so you can manage capacity yourself.

---

## Product goals

- Send each guest a **unique invitation URL** (`/rsvp/:token`) via WhatsApp/SMS.
- Guests **accept** (optional **wishes**), **decline**, or do nothing until **expiry**.
- **No QR codes**, **no venue check-in**, **no permanent-guest QR** feature.
- After **accept**, show **thank you + global event details** (date, time, venue, etc. — fields TBD).
- **Renew** invitations that are `expired`, `declined`, or `revoked`, or **manually revoke** to free your own mental “slot” — **documents are never hard-deleted** so you keep history.
- **Real-world use case:** you have more people to invite than you can host; when someone declines, expires without answering, or you revoke an invite, you **renew** or re-use the workflow for the next person while keeping records.

---

## Core concepts

- **Admin** creates invitations with guest name, optional phone, **invitation page language** (`id` or `en`), and **expiry** (default **now + 7 days**, overridable with a **date/time picker**).
- **Guest** opens the link; the **public invitation page** copy follows the invitation’s **locale**; **global event detail** text on the thank-you screen is **global** but can differ **by locale** (ID vs EN) from a single event config.
- **Admin app UI** is **English** for now (dashboard, lists, forms).
- **`wishes`** live **on the invitation document** only (no `rsvp_responses` collection).
- **`invitation_page_view`** (or equivalent) is logged **on every** load of the public invitation page so you can see whether someone **opened** the link; **device detail** = parsed **browser / OS** from User-Agent (no IP required unless you add it later).

---

## Invitation states

| Status | Meaning | Guest can act? |
|--------|---------|----------------|
| `pending` | Link active, awaiting response | Yes (if `now < expires_at`) |
| `accepted` | Guest confirmed | No (admin can override / renew flow) |
| `declined` | Guest declined | No |
| `expired` | `expires_at` passed while still `pending` (hourly job) | No |
| `revoked` | You manually invalidated the invite | No |

**Guest-facing `/rsvp/[token]`:** use the **same page layout** for terminal states (`expired`, `revoked`, `declined`, `accepted`, etc.) with **different copy** per status (especially **revoked** vs **expired**).

**State transitions**

- `pending` → `accepted`: guest confirms (optional `wishes`, `responded_at` set).
- `pending` → `declined`: guest declines.
- `pending` → `expired`: scheduled job when `expires_at < now()`.
- `expired` \| `declined` \| `revoked` → `pending`: editor **renews** — set `expires_at` via **admin picker**, clear `responded_at`, clear **`wishes`**, increment/normalize `updated_at`.
- `accepted` → `pending`: editor **reopens** (override) — clear `responded_at` and **`wishes`** so the next cycle is clean (same rules as renew for clearing message fields).
- `pending` \| `accepted` \| `declined` \| `expired` → `revoked`: editor **revokes** (invalidates link; doc retained).

Do **not** hard-delete invitation documents.

---

## Firestore collections

### `invitations`

```
id             string   auto (doc ID)
token          string   unique random, URL-safe → /rsvp/:token
guest_name     string   required
guest_phone    string   optional
locale         string   "id" | "en" — public invitation + thank-you copy for this link
wishes         string   optional — set when guest accepts with text; cleared on renew/reopen
status         string   "pending" | "accepted" | "declined" | "expired" | "revoked"
expires_at     timestamp  default on create: now + 7 days; overridable at create & on renew
responded_at   timestamp  null until guest accepts or declines
created_by     string   admin UID
created_at     timestamp
updated_at     timestamp
```

### `event_config` (singleton)

One document (e.g. `event_config/current`) for **global** event information shown after accept: date, time, venue, map link, dress code, etc. **Structure TBD**; support **localized fields** for **ID** and **EN** (either nested maps or suffixed keys) so the thank-you page matches the invitation’s `locale`.

### `admins`

```
id         string   Firebase Auth UID
email      string
name       string
role       string   "super_admin" | "editor" | "viewer"
created_at timestamp
```

### `activity_events` (dashboard feed + auditing)

Append-only style log (exact name up to you). Used for **Recent activity** with **10 rows per page**, **newest first**, **filter by guest name** and **kind**; **separate filter** (or kind bucket) for **invitation access** vs **other** events.

Suggested fields:

```
id              string   auto
kind            string   e.g. invitation_created | rsvp_accepted | rsvp_declined |
                         invitation_expired | invitation_revoked | invitation_renewed |
                         invitation_reopened | invitation_page_view
invitation_id   string   optional
guest_name      string   denormalized for search/filter
actor_admin_id  string   optional (admin-triggered actions)
metadata        object   e.g. { browser, os } for invitation_page_view; optional extras
created_at      timestamp
```

**`invitation_page_view`:** write **one event per page load** of `/rsvp/[token]` (client → API or server component logging), scoped to `invitation_id`, with **browser/OS** derived from User-Agent.

Other kinds are emitted when the underlying invitation state changes or when admins create/renew/revoke (implementation may batch job expiries per run with one summary row or one row per invitation — pick one and document in code).

---

## Token rules

- **`token`:** `crypto.randomBytes(32).toString('base64url')` in Node.js; **ensure uniqueness** in `invitations` before write.
- Reveal **shareable URL** to editors after create (`/rsvp/:token`).

---

## User flows

### Guest confirms

1. Open `/rsvp/:token`.
2. Load invitation by token; if not found → not-found UI.
3. If `revoked` / `expired` / `declined` / `accepted` → same shell, **status-specific** copy (thank-you + event block only when `accepted`).
4. If `pending` and `now >= expires_at` → treat as expired (or rely on job; UI should still block actions and show expired copy).
5. If `pending` and valid → show Confirm + Decline; optional **wishes** textarea on confirm path.
6. Submit accept → `status: accepted`, `wishes` (optional), `responded_at`, **log** `rsvp_accepted`.
7. Transition **in-page** to thank-you + **global event details** (from `event_config`, keyed by invitation `locale`).

### Guest declines

Confirm in UI → `declined`, `responded_at`, **log** `rsvp_declined`.

### Admin creates invitation

1. `/admin/invitations/new` (Editor+).
2. **English** form: name (required), phone (optional), **locale** `id` \| `en`, **`expires_at`** default **now + 7 days** with **picker** to override.
3. Create doc + **log** `invitation_created`.
4. Show shareable link with copy.

### Admin renews invitation

For `expired`, `declined`, or `revoked` (and optionally after **reopen** from `accepted`):

1. Set `status: pending`.
2. Set `expires_at` via **picker** (not auto +7 in this flow unless you add a shortcut).
3. Clear `responded_at`, clear **`wishes`**.
4. **Log** `invitation_renewed` or `invitation_reopened` as appropriate.

### Admin revokes invitation

1. Set `status: revoked` (document retained, same `token`; guest sees **revoked** message).
2. **Log** `invitation_revoked`.

### First super admin (bootstrap)

1. **Passkey** stored only in an **environment variable** (e.g. `SUPER_ADMIN_BOOTSTRAP_PASSKEY`); **never** commit real values to the repo.
2. **Normal signup/API** accepts the passkey **only while** there is **zero** `super_admin` in `admins` (or zero admins at all — pick one rule; recommend: gate until no `super_admin` exists).
3. After the **first** `super_admin` exists, the passkey route **disables itself** automatically.

---

## Pages

### Public (no auth)

| Route | Description |
|--------|-------------|
| `/rsvp/[token]` | Invitation + thank-you; logs **invitation_page_view** each load |

No `/checkin` route.

### Admin (protected)

| Route | Role | Description |
|--------|------|-------------|
| `/admin/login` | Public | Firebase email/password |
| `/admin` | Any | Stats + **Recent activity** (paginated, filtered) |
| `/admin/invitations` | Any | List: filters/search; show **accepted count** prominently or on dashboard |
| `/admin/invitations/new` | Editor+ | Create invitation |
| `/admin/invitations/[id]` | Any | Detail: wishes, status, activity, **renew** / **revoke** / reopen actions |
| `/admin/settings/event` | Editor+ (or Super only) | **Optional** route for editing `event_config` — placement TBD |
| `/admin/users` | Super Admin | Manage admins & roles |

Remove all **`/admin/permanent-qrs/*`** routes.

---

## Expiry job

Firebase Cloud Function + Cloud Scheduler **hourly**:

```
Query invitations WHERE status == "pending" AND expires_at < now()
→ batch update status = "expired"
→ emit invitation_expired activity (per doc or summary — implementation choice)
```

Do **not** flip `revoked` or `accepted` with this job.

---

## Dashboard metrics

Show at least: **Total invitations**, **Accepted**, **Pending**, **Declined**, **Expired**, **Revoked**.  
**Do not** include permanent-QR or check-in metrics.

---

## Key UI details

- Invitation page: guest name, **+1** note, **locale**-aware strings.
- `/admin` UI: **English**.
- Confirmation: optional **wishes** field (“Wedding wishes or message” or localized on public page).
- **Recent activity:** 10 per page, newest first; filters: **name**, **event kind**, toggle/filter **access-only** vs **non-access** events.
- Event details content: **global `event_config`**, presentation respects invitation **`locale`**.

---

## Error codes (API / client)

| Code | Meaning |
|------|---------|
| `INVITATION_EXPIRED` | Past `expires_at` while still treated as pending, or job marked expired |
| `INVITATION_NOT_FOUND` | Unknown token |
| `INVITATION_REVOKED` | Admin revoked this link |
| `ALREADY_RESPONDED` | Guest already accepted or declined for this cycle |

Remove check-in / QR-specific errors from product scope (`ALREADY_CHECKED_IN`, `QR_NOT_FOUND`, etc.).

---

## Admin roles & permissions

| Action | Viewer | Editor | Super Admin |
|--------|:------:|:------:|:-----------:|
| Dashboard, lists, detail | ✅ | ✅ | ✅ |
| Create / renew / revoke / reopen invitations | ❌ | ✅ | ✅ |
| Edit `event_config` | ❌ | ✅ | ✅ |
| Manage admin users | ❌ | ❌ | ✅ |

**Hard-delete** invitations is **out of scope**; use **`revoked`** and **renew** instead.

---

## Privacy / retention

No mandated post-event deletion or anonymization in v1 (per Q&A). Implement according to your own compliance needs later.

---

## Suggested libraries

| Purpose | Library |
|---------|---------|
| Firebase SDK | `firebase` (v9+ modular) |
| Auth | Firebase Authentication (email/password) |
| Styling | Tailwind CSS |
| Admin auth | Next.js middleware + Firebase ID token verification |

**Do not** add QR generation or scanning libraries for this product scope.
