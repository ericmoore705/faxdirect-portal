# FaxDirect Portal — Epic EMS

Send and receive faxes via SignalWire, with zero Base44 integration credits.

## Architecture

- **Next.js 15** on Vercel
- **Google OAuth** restricted to `@epicems.com`
- **SignalWire API** — direct REST calls for send/receive/status
- **Vercel Postgres** — fax history, contacts, users
- **Vercel Blob** — PDF storage (uploaded docs, cover sheets, received faxes)
- **Webhooks** — SignalWire status callbacks + inbound fax receive (no polling)

## Quick Start

### 1. Create GitHub repo

```bash
git init
git remote add origin git@github.com:ericmoore705/faxdirect-portal.git
git add .
git commit -m "Initial commit - FaxDirect portal"
git push -u origin main
```

### 2. Create Vercel project

- Import the GitHub repo in Vercel dashboard
- Add a **Vercel Postgres** database (Storage → Create → Postgres)
- Add a **Vercel Blob** store (Storage → Create → Blob)

### 3. Set environment variables in Vercel

Copy values from `.env.example`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Auto-set by Vercel Postgres |
| `DIRECT_DATABASE_URL` | Auto-set by Vercel Postgres |
| `BLOB_READ_WRITE_TOKEN` | Auto-set by Vercel Blob |
| `NEXTAUTH_URL` | Your deployment URL (e.g. `https://faxdirect.epicems.com`) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 credentials |
| `GOOGLE_CLIENT_SECRET` | Same |
| `SIGNALWIRE_SPACE_URL` | Your SignalWire space (e.g. `yourspace.signalwire.com`) |
| `SIGNALWIRE_PROJECT_ID` | SignalWire dashboard → API Credentials |
| `SIGNALWIRE_API_TOKEN` | SignalWire dashboard → API Credentials |
| `SIGNALWIRE_FAX_NUMBER` | `+18882789949` |

### 4. Push the database schema

```bash
npx prisma db push
```

### 5. Configure SignalWire webhooks

In your SignalWire dashboard, update the phone number `+18882789949`:

- **Incoming Fax URL**: `https://your-domain.vercel.app/api/fax/receive` (POST)
- Fax status callbacks are set per-send in the API

### 6. Migrate data from Base44

```bash
BASE44_TOKEN=your-token npx tsx prisma/seed.ts
```

This pulls all existing users, saved contacts, and fax history from the Base44 FaxDirect app.

## What this eliminates

Every one of these was burning Base44 integration credits:

- ❌ Send fax (Base44 → SignalWire) → ✅ Direct API call
- ❌ Status poll (Base44 → SignalWire) → ✅ Webhook callback
- ❌ Receive fax (SignalWire → Base44) → ✅ Webhook to Vercel
- ❌ Store PDF (Base44 files) → ✅ Vercel Blob
- ❌ Read/write contacts (Base44 entities) → ✅ Postgres

**You only pay:** SignalWire per-page fax rate + Vercel hosting (likely free tier).

## Project Structure

```
src/
  app/
    api/
      auth/[...nextauth]/  — Google OAuth
      fax/send/             — Send fax via SignalWire
      fax/status/           — Status callback webhook
      fax/receive/          — Inbound fax webhook
      fax/history/          — Paginated fax history
      contacts/             — Address book CRUD
      upload/               — PDF upload to Vercel Blob
    dashboard/              — Activity overview
    send/                   — Send fax form
    sent/                   — Sent fax history
    received/               — Received fax history
    contacts/               — Address book
  lib/
    auth.ts                 — NextAuth config
    db.ts                   — Prisma client
    signalwire.ts           — SignalWire API client
    coversheet.ts           — PDF cover sheet generator
```
