# Isfaham

Isfaham is a turn-based Somali and English voice translation app for schools
and families.

This repository contains:

- `src/` — the [isfaham.org](https://isfaham.org) Next.js website and secure API
- `mobile/` — the Expo app for iOS and Android

## External services

The first working release needs:

1. **Azure AI Speech** — Somali/English transcription and spoken translations
2. **Azure AI Translator** — Somali ↔ English text translation
3. **Resend** — school pilot form notifications from `hello@isfaham.org`
4. **Supabase** — accounts and usage data (optional until authentication ships)
5. **Vercel** — website and secure API hosting
6. **Expo EAS** — iOS/Android cloud builds and store submission
7. **RevenueCat and Apple IAP** — iOS consumable Translation Credits
8. **Stripe** — website credit checkout, school billing, and payment webhooks

Never expose Azure or Resend secret keys in the Expo app. They belong in Vercel
environment variables only.

## Website and API

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure the variables
listed in `.env.example` locally and in Vercel.

The `/api/translate` route accepts one short audio turn, transcribes it,
translates it, and returns the translated voice. Audio is not written to a
database or storage.

## Staff and parent flow

1. Apply the Supabase migrations in filename order:
   - `202607260001_initial_school_conversations.sql`
   - `202607260002_usage_analytics.sql`
   - `202607260003_school_admin_portal.sql`
   - `202607260004_secure_trigger_functions.sql`
   - `202607260005_translation_credits.sql`
   - `202607260006_revenuecat_credits.sql`
2. Insert a school and its approved staff emails into `approved_teachers`.
   Supabase’s Table Editor can import a CSV into this table.
3. In Supabase Authentication, change the email template to include
   `{{ .Token }}` so staff receive a six-digit code.
4. Keep email signups enabled for Individual accounts. Staff access remains
   restricted by the approved-teacher table.
5. Add the Supabase and Twilio variables from `.env.example` to Vercel.

Staff sign in at `/teacher/login`. They enter their approved email and verify
the six-digit Supabase code. From `/teacher`, they create a conversation and
enter the teacher and parent 10-digit US phone numbers.

Twilio Proxy creates a 60-minute message-only session, masks both numbers, and
sends the parent a random conversation link. The parent opens that link on a
phone browser without installing an app or creating an account. The teacher
starts the room, and both participants hold the microphone to take turns.

Only translated text is stored for the active session. Raw recordings and
generated speech are processed in memory and are not saved to Supabase. Links
expire after 60 minutes, and ending a room closes its Twilio Proxy session.

The second migration tracks privacy-safe operational totals: conversations,
session length, turns, measured Azure speech duration, invitation and join
counts, translation failures, and estimated provider cost. It does not store
audio, transcripts in analytics, student names, or full phone numbers. Staff
see their own usage summary in the workspace. The `school_usage_daily` view is
reserved for server-side school reporting.

Cost values are estimates based on the rates in `.env.example`. Keep those
rates synchronized with the actual Azure invoice before making pricing
decisions.

### Consumer Translation Credits

The fifth migration creates a server-controlled wallet and immutable credit
ledger. New consumers receive 2 trial minutes. In-person translations reserve
up to one minute, then refund the unused seconds after Azure reports the actual
speech duration. School staff usage is funded by the school and bypasses the
personal wallet.

On iOS, the app fetches localized prices from Apple and purchases the consumable
products `isfaham_1_hour`, `isfaham_5_hours`, and `isfaham_10_hours` through
RevenueCat. Configure `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` in `mobile/.env` and
EAS. Add this RevenueCat webhook URL and set its Authorization header to
`Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`:

```text
https://isfaham.org/api/revenuecat/webhook
```

Subscribe it to `NON_RENEWING_PURCHASE` events for the App Store. The server
verifies the configured authorization token and grants credits idempotently by
Apple transaction ID.

Website packages are currently priced at $8 for one hour, $35 for five hours,
and $65 for ten hours. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
and the permanent Stripe Price IDs listed in `.env.example` in Vercel. The
Stripe webhook endpoint is:

```text
https://isfaham.org/api/stripe/webhook
```

Subscribe that webhook to `checkout.session.completed`. Credit updates are
idempotent and occur only after the signed Stripe webhook confirms payment.
Never place Stripe secret keys in Expo environment variables.

### School administrator portal

After applying the third migration, promote the first administrator once in
the Supabase SQL Editor:

```sql
update public.approved_teachers
set is_admin = true
where email = 'your-email@school.org';

update public.profiles
set is_admin = true
where email = 'your-email@school.org';
```

The second statement is only necessary if that administrator has already
signed in. Administrators can then open `/admin` to add, search, deactivate, and
reactivate approved staff emails for their own school. Administrator accounts
cannot be deactivated through the portal.

## Mobile app

```bash
cd mobile
npm install
copy .env.example .env
npm start
```

Use the deployed Vercel domain for `EXPO_PUBLIC_API_URL` when testing on a
physical device. The iOS bundle identifier and Android package are both
`com.isfaham.app`.

Connect this local Expo app to the existing EAS project before the first build:

```bash
npx eas-cli@latest init
npx eas-cli@latest build --platform all --profile preview
```

## Checks

```bash
npm run lint
npm run build
cd mobile
npx tsc --noEmit
npx expo-doctor
```

## Deployment

Import `askar2022/isfaham` into Vercel and connect `isfaham.org`. Every push to
the production branch deploys the website and backend. Add the final App Store
and Google Play URLs to Vercel after both listings are public; the website then
turns its “Coming soon” badges into download links.
