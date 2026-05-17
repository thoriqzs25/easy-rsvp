# Open questions — Wedding RSVP system

Answer inline under each question (or replace the `_Your answer:_` placeholders).

---

## 1. `/checkin` access control

Should anyone with the URL be able to check guests in, or should check-in require staff login, a shared PIN, an IP allowlist, Firebase custom claims, or something else?

Refer to answer 4. I don't need check-in flow


---

## 2. “Regenerate expired link” behavior

When an editor regenerates an expired invitation link, should we reuse the same Firestore document (new `token`, new `expires_at`, reset `status`, clear `qr_token` / `responded_at` / `checked_in_at`), or create a brand-new invitation? Should existing `rsvp_responses` be kept or deleted?

Since each guest receives a different unique link (id in the query params), if it gets regenerated after expiry, it will renew the expires_at and the status.


---

## 3. Admin override: reopening an `accepted` invitation

When an editor changes an `accepted` invitation back to `pending`, should the old `qr_token` be invalidated immediately? Should a **new** `qr_token` be issued only on the next accept, or should something else happen?

I don't need qr_token anymore, after accepting invitation we would simply say thank you and give the detail of the event.


---

## 4. Undoing check-in

If staff scan the wrong guest or make a mistake, do you need an admin action to **clear `checked_in_at`** (on both invitations and permanent QRs), or is check-in **permanent** once set?

I don't need the check-in flow. I only want to have a system to list down the guests that accepts the invitation.


---

## 5. Repeat check-ins / multi-entry

Is **one successful check-in per QR for the whole event** the correct rule, or do you need **multiple entries** (e.g. different days or re-entry)?

Refer to answer 4. I don't need check-in flow


---

## 6. Editing guest / VIP records after creation

Can editors **edit** `guest_name` / `guest_phone` on invitations and `name` / `phone_number` / `description` on permanent QRs **after** the link or QR has been shared? Any fields that must stay **read-only** after creation?

I don't need QRs because I discarded the check-in flow


---

## 7. First `super_admin` bootstrap

How should the **first** super admin be created (Firebase Console, one-time seed script, manual Firestore write, env-gated first signup, etc.)?

Via normal API but with a one-time passkey "tzs08dzf22"


---

## 8. Dashboard “recent activity”

What events should appear (e.g. new invitation, RSVP confirm, decline, check-in, expiry, admin overrides)? How many rows, sort order, and any filters?

10 rows per page, sort in recent change, filter query by name, kind of activity. It should show the newly generated invitation, accepted/rejected invitation, expired invitation, link accessed (with the device detail).


---

## 9. Language / locale

Should the UI be **Indonesian only**, **English only**, or **bilingual**? Any copy that must use specific wording (besides “ucapan” / wedding wishes)?

Use full english for now, but keep in mind that while generating link invitation, there should be option to choose between ID/EN which would affect the invitation page


---

## 10. Privacy and data retention

After the wedding, should **phones** and **ucapan** be **deleted**, **anonymized**, or **kept indefinitely** in Firestore? Any minimum retention period for ops/audit?

No need.


---

_Add more notes below if needed._

```text
I cancelled the QR code flow for check in. This system will focus mainly on maximizing the number of available guests in the event by giving opportunity to
give them the invitation in a form of link and an invitation page. The real usecase is: I only have slots for 40 friends to invite to an event, but I have over 40 friends that
I sorted based on several things and I want to invite them. If they aren't able to come however (or they did not respond until the expiry date of the invitation), I could
regenerate the expiry date a bit longer OR I could invalidate the invitation and invite someone else through the same method.

```
