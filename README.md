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

## Teacher and parent flow

1. Apply the Supabase migrations in filename order:
   - `202607260001_initial_school_conversations.sql`
   - `202607260002_usage_analytics.sql`
2. Insert a school and its approved teacher emails into `approved_teachers`.
   Supabase’s Table Editor can import a CSV into this table.
3. In Supabase Authentication, change the email template to include
   `{{ .Token }}` so teachers receive a six-digit code.
4. Disable open user signups. The server creates Auth users only after checking
   the approved-teacher table.
5. Add the Supabase and Twilio variables from `.env.example` to Vercel.

Teachers sign in at `/teacher/login`. They enter their approved email and verify
the six-digit Supabase code. From `/teacher`, they create a conversation and
enter the teacher and parent phone numbers in international format.

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
audio, transcripts in analytics, student names, or full phone numbers. Teachers
see their own usage summary in the workspace. The `school_usage_daily` view is
reserved for server-side school reporting.

Cost values are estimates based on the rates in `.env.example`. Keep those
rates synchronized with the actual Azure invoice before making pricing
decisions.

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
