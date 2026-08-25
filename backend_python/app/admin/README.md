# Admin panel

Plain ES modules and CSS — no build step, no dependencies. It runs from two
places, unchanged:

| Where | URL | API base |
|---|---|---|
| The backend itself | `https://<api-host>/admin/` | relative `/api/v1` |
| Its own Vercel project | `https://<your-admin-domain>/` | the absolute API URL |

`config.js` picks between them at run time from the hostname, because without
a build step there is no bundler to inline an environment variable.

## Deploying it separately

1. **New Vercel project** on this repository.
2. **Root Directory**: `backend_python/app/admin`. Framework preset: *Other*.
   There is no build command and no install step; the directory is the output.
3. **Deploy**, then note the domain Vercel gives you.
4. **Add that domain to the backend's `CORS_ORIGINS`**, comma-separated:

   ```
   CORS_ORIGINS=https://maklersizuy.uz,https://www.maklersizuy.uz,https://<your-admin-domain>
   ```

   Without this the browser refuses every request before it is sent, and the
   panel shows a network error with nothing in the backend log — the request
   never arrived.

5. If your API is not at
   `https://maklersizkvartira-production.up.railway.app`, change the one URL in
   `config.js`.

## Why a separate domain is worth it

The panel reveals user passwords, edits accounts and reads the audit log. On
its own origin it shares no cookies, no `localStorage` and no service worker
with the public site, so a flaw in the public frontend cannot reach an admin
session. `X-Frame-Options: DENY` above stops it being framed by anything.

## Access

Sign in with an admin account. Create the first one from the backend:

```bash
python -m scripts.create_admin --username admin --name "Bosh administrator"
```

If nobody can sign in any more, set `BOOTSTRAP_TOKEN` and
`BOOTSTRAP_ADMIN_PASSWORD` on the backend, POST to
`/api/v1/admin/auth/bootstrap-reset-admin` with an `X-Bootstrap-Token` header,
then unset `BOOTSTRAP_TOKEN` again. It answers 404 while that variable is
empty, which is how it should spend almost all of its life.
