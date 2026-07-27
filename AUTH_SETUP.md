# Auth provider setup — one-time, manual

This part can't be automated — it requires your own GitHub and Google developer accounts. Email magic link already works with no setup (Supabase's built-in SMTP; rate-limited to ~2/hour on the free tier, fine for dev).

Supabase's own callback URL — the **only** URL GitHub/Google ever see — is:

```
https://mwxokedrwjlyrqcwvdur.supabase.co/auth/v1/callback
```

## A. GitHub OAuth App

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. **Application name:** `CoBuild` (or anything — users see it on the consent screen)
3. **Homepage URL:** `http://localhost:3000` (swap for the real domain at launch)
4. **Authorization callback URL:** `https://mwxokedrwjlyrqcwvdur.supabase.co/auth/v1/callback`
5. Leave **Enable Device Flow** unchecked → **Register application**
6. Copy the **Client ID**; click **Generate a new client secret** and copy it immediately (shown once)
7. Supabase Dashboard → **Authentication → Providers → GitHub** → **Enable** → paste Client ID + Client Secret → **Save**

## B. Google OAuth Client ID

1. https://console.cloud.google.com → create/select a project
2. **APIs & Services → OAuth consent screen** → **External** → fill in App name, support email, developer contact → Save. While in "Testing" mode, add yourself under **Test users** or sign-in will fail with `access_denied`.
3. Scopes: the defaults (`userinfo.email`, `userinfo.profile`, `openid`) are enough.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. **Application type:** Web application
6. **Authorized JavaScript origins:** `https://mwxokedrwjlyrqcwvdur.supabase.co`
7. **Authorized redirect URIs:** `https://mwxokedrwjlyrqcwvdur.supabase.co/auth/v1/callback`
8. **Create** → copy Client ID + Client Secret
9. Supabase Dashboard → **Authentication → Providers → Google** → **Enable** → paste both → **Save**

## C. Supabase URL configuration — easy to miss, breaks OAuth silently if skipped

**Authentication → URL Configuration:**
- **Site URL:** `http://localhost:3000` (swap for the production domain at launch)
- **Redirect URLs** (allowlist), add:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`
  - At launch, also add `https://<prod-domain>/auth/callback` and `https://<prod-domain>/**`

If `/auth/callback` isn't allowlisted here, Supabase silently drops the app's `redirectTo` and bounces to the Site URL instead — this is the classic "OAuth completes but always lands on the homepage, never where I wanted" symptom.

## After setup

Just sign in from `/login` — no code changes needed once the three sections above are done. If something's wrong, `/login?error=<code>` will show one of: `provider_denied`, `missing_code`, `invalid_code`, `expired_link`, `wrong_device`, `server_error` — `wrong_device` almost always means a magic link was opened in a different browser than the one that requested it.
