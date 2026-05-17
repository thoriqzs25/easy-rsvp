# Follow-up questions — Wedding RSVP system (post–open-questions)

Answer under each question (replace `_Your answer:_` or write below it).

---

## 1. Permanent QR feature

You removed check-in and QRs. Should the **`permanent_qrs` collection**, **`/admin/permanent-qrs/*` routes**, and any QR-related libraries be **removed from the product entirely**? Or is there still a non–check-in use (e.g. printable cards without scanning)?

Yes


---

## 2. Firestore fields after removing QRs / check-in

Confirm what to **remove** from the data model:

- `invitations.qr_token`
- `invitations.checked_in_at`
- Entire **`permanent_qrs`** collection

Should anything else be dropped or renamed? (e.g. keep `responded_at`, `rsvp_responses`, `ucapan` as-is)

Rename "ucapan" to "wishes"


---

## 3. “Invalidate and invite someone else” — exact behavior

When you invalidate an invitation to free capacity for another person, what should happen?

- New status values (e.g. `cancelled` / `revoked`) and the old link shows a message?
- **Hard-delete** the document?
- **Reuse the same document** with a **new `token`** and reset guest fields?

Also: should the old URL return **404**, **“no longer valid”**, or something else?

Use new status "revoked" if I manually revoke it, "expired" if it is pass the expiry date. Don't hard delete the document, I want to know the list of invitations that I had made


---

## 4. Regenerate after expiry — exact state machine

When an editor **renews** an expired (or otherwise eligible) invitation:

- New **`status`**: always back to **`pending`**?
- New **`expires_at`**: from “now + 7 days” again, or a custom duration / manual date?
- Clear **`responded_at`**?
- What happens to **`rsvp_responses`** — **keep**, **delete**, or **archive** (new doc)?
- Can **`declined`** invitations be renewed the same way as **`expired`**, or only **`expired`**?

Status changes back to pending, "expires_at" increases to manual date selection. Clear up "responded_at". Archive the "rsvp_responses". Declined invitations can be renewed the same way
as expired, revoked invitations.


---

## 5. Event details after accept (thank-you screen)

What must the guest see after they confirm? (e.g. date, time, venue, map link, dress code, contact WhatsApp, agenda.)

Is this content **one global “event config”** for the whole wedding, or **different per invitation**?

It should be global for the current event. It can be different in terms of i18n (ID/EN). I'll provide the date, time, venue, etc. (we'll focus it later)


---

## 6. Capacity (“40 slots”) in the app

Should the app **enforce** a maximum number of **accepted** guests (block or warn), or is capacity **managed outside** the app with only lists/filters for your own tracking?

If enforced: what’s the source of the limit (fixed number in env, super-admin setting in Firestore, etc.)?

No, the system doesn't have to care about the slots. It just need to show how many accepted the rsvps so the admin knows if it's enough or not.


---

## 7. “Link accessed” activity + device detail

- Log **every** page load, **first visit only**, or **first visit per device/session**?
- What counts as **device detail**? (e.g. parsed **User-Agent** summary, browser/OS, **no IP**, optional IP, etc.)
- Should **access** events live in the **same** “recent activity” feed as RSVP/expiry/admin actions?

Log everything for each invitation, I want to know if they had seen the invitation or not. Device details could be like the browser/OS.
I think we can have a filter in the recent activity so we can have the access events and the other events.


---

## 8. Super-admin passkey bootstrap

- Store passkey in **environment variable** only (never in git) — confirm you’ll use that approach.
- After the **first** super admin exists, should the passkey gate **disable automatically**, or stay available until you remove it manually?

I'll store in env variables in pipeline. After super admin exists, passkey gate should be disabled.


---

_Add more notes below if needed._

```text

```
