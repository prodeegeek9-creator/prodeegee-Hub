# Prodeegee Hub — Setup Guide
## hub.prodeegee.com

---

## Step 1 — Supabase Project

1. Go to supabase.com → New Project
2. Name it `prodeegee-hub`
3. Copy your **Project URL** and **anon public key** from Settings → API
4. Go to SQL Editor → paste and run `supabase-schema.sql`
5. Go to Database → Replication → enable realtime for:
   - `messages`
   - `notifications`

---

## Step 2 — Google OAuth + Gmail API

### 2a. Google Cloud Console
1. Go to console.cloud.google.com → New Project: `Prodeegee Hub`
2. APIs & Services → Enable these:
   - **Gmail API**
   - **Google+ API** (or People API)
3. OAuth consent screen:
   - App name: `Prodeegee Hub`
   - User type: External (or Internal if G Suite)
   - Scopes: add `gmail.readonly`, `gmail.send`
4. Credentials → Create OAuth Client ID:
   - Type: Web application
   - Authorized JS origins: `https://hub.prodeegee.com`
   - Authorized redirect URIs: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**

### 2b. Supabase Auth
1. Supabase → Authentication → Providers → Google → Enable
2. Paste your Google **Client ID** and **Client Secret**
3. Copy the Supabase callback URL and add it back to Google Console if needed

---

## Step 3 — Fill in Constants in index.html

Open `index.html` and update these three lines at the top of the script:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
const GOOGLE_CLIENT_ID = '123456-abc.apps.googleusercontent.com';
```

---

## Step 4 — Deploy to Cloudflare Pages

1. Go to Cloudflare Pages → Create Project → Direct Upload
2. Upload the `index.html` file
3. Project name: `prodeegee-hub`
4. Go to Custom Domains → add `hub.prodeegee.com`
5. Cloudflare adds the DNS record automatically (since your domain is already on Cloudflare)

---

## Step 5 — Staff Onboarding

For each staff member:
1. Add Cloudflare Email Routing: `firstname@prodeegee.com` → their Gmail
2. Share hub.prodeegee.com with them
3. They click **Sign in with Google** → approve Gmail access
4. Done — their `@prodeegee.com` inbox loads automatically

---

## How Email Works

| Action | How |
|--------|-----|
| Staff receives email | Cloudflare routes `firstname@prodeegee.com` → their Gmail |
| Hub shows inbox | Gmail API filters for `to:@prodeegee.com` emails only |
| Staff sends email | Gmail API sends from `firstname@prodeegee.com` using OAuth token |
| Recipient sees | `John Doe <john@prodeegee.com>` |
| Sent log | Stored in Supabase `sent_emails` table |

---

## Feature Summary

| Feature | Stack |
|---------|-------|
| Auth | Supabase Auth (Google OAuth) |
| Real-time messages | Supabase Realtime |
| Inbox | Gmail API (readonly) |
| Send email | Gmail API (send scope) |
| Sent log | Supabase `sent_emails` |
| Tasks/Kanban | Supabase `tasks` |
| Notifications | Supabase `notifications` + Realtime |
| Threads | Supabase `messages` (parent_id) |
| Hosting | Cloudflare Pages |
