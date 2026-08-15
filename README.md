# Isfaham

Isfaham is a school-to-family Somali voice messaging app. Authorized staff
record in English, preview Somali text and audio, then send parents a secure
SMS listening link. Personal/two-way translation code remains in the repo
(`mobile/App.legacy.tsx`) but is hidden from the current product surface.

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
7. **RevenueCat, Apple IAP, and Google Play Billing** — native consumable Translation Credits
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
   - `202607260007_consumer_remote_conversations.sql`
   - `202607260008_platform_administrators.sql`
   - `202607300001_production_security_hardening.sql`
2. Insert a school and its approved staff emails into `approved_teachers`.
   Supabase’s Table Editor can import a CSV into this table.
3. In Supabase Authentication, change the email template to include
   `{{ .Token }}` so staff receive a six-digit code.
4. Enable anonymous sign-ins for the device-based 2-minute trial and enable
   manual identity linking so trial users can add an email without losing their
   wallet. Keep email signups enabled for Individual accounts. Staff access
   remains restricted by the approved-teacher table.
5. Set the Confirm signup, Magic Link, and Change Email Address templates to
   display `{{ .Token }}` so every account flow sends a six-digit code.
6. Add the Supabase, Twilio, and `RATE_LIMIT_SECRET` variables from
   `.env.example` to Vercel. Apply the security-hardening migration before
   deploying code that depends on its access-block and rate-limit tables.
7. Keep `REVENUECAT_ALLOW_SANDBOX=false` in production. Set
   `REQUIRE_TRIAL_DEVICE_ID=true` only after updated mobile builds containing
   the secure install identifier have reached users.

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

On iOS and Android, the app fetches localized store prices and purchases the
consumable products `isfaham_1_hour`, `isfaham_5_hours`, and
`isfaham_10_hours` through RevenueCat. Configure
`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and
`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` in `mobile/.env` and EAS. Add this
RevenueCat webhook URL and set its Authorization header to
`Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`:

```text
https://isfaham.org/api/revenuecat/webhook
```

Subscribe it to `NON_RENEWING_PURCHASE` events for the App Store and Google
Play. The server verifies the configured authorization token and grants credits
idempotently by store transaction ID.

New devices receive a two-minute anonymous trial. Trial users can translate on
one shared phone without creating an account. Inviting another phone requires
converting that anonymous session into an Individual account, which preserves
the same wallet. The host shares a private link or QR code; the guest joins
without an account, and all speech from both phones is deducted only from the
host wallet.

Website packages are currently priced at $8 for one hour, $35 for five hours,
and $65 for ten hours. Schools subscribe at $499/month through Stripe Checkout
on the homepage. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_1_HOUR`, `STRIPE_PRICE_5_HOURS`, `STRIPE_PRICE_10_HOURS`, and
`STRIPE_PRICE_SCHOOL_MONTHLY` in Vercel (live-mode values in production). The
Stripe webhook endpoint is:

```text
https://isfaham.org/api/stripe/webhook
```

Subscribe that webhook to `checkout.session.completed`,
`customer.subscription.updated`, and `customer.subscription.deleted`. Personal
credit updates and school provisioning are idempotent and occur only after the
signed Stripe webhook confirms payment. Never place Stripe secret keys in Expo
environment variables. Apply migration
`202608130001_school_stripe_billing.sql` before enabling school checkout.

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

School administrators remain scoped to their own staff directory. To give an
Isfaham operator access to Personal-user management and privacy-safe guest
metrics, add that verified email separately after applying migration 008:

```sql
insert into public.platform_administrators (email, full_name)
values ('owner@isfaham.org', 'Isfaham owner')
on conflict (email) do update set full_name = excluded.full_name;
```

Platform administrators see three separate workspaces:

- `/admin` — staff for the administrator’s school only
- `/admin/personal` — registered Personal users, balances, access, and deletion
- `/admin/guests` — aggregate guest-trial metrics without an individual guest list

Never add a school administrator to `platform_administrators` unless that
person is authorized to manage Isfaham-wide consumer data.

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
