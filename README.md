# Vernwork

Vernwork is an Angular marketplace frontend with a FastAPI and SQLAlchemy API.

## Run locally

1. Install `backend/requirements.txt` in the backend virtual environment.
2. Set `DATABASE_URL` to your MySQL URL for the real database, plus `APP_ACCESS_PIN_HASH`, `SESSION_SECRET`, and `GOOGLE_CLIENT_ID`. `APP_ACCESS_PIN_HASH` must be the bcrypt hash of the shared PIN you will give to people who should access the site.
3. From `backend`, start the API with `uvicorn main:app --host 127.0.0.1 --port 8000 --reload`.
4. From `frontend`, run `npm install` and `npm start`.
5. Angular proxies `/api` to `http://localhost:8000`. SQLite is only the development fallback when `DATABASE_URL` is unset; `VERNWORK_ENV=production` refuses to start without an explicit database URL.

For this checkout's preview, the access PIN hash is stored in the ignored `backend/.access-pin-hash` file. On Ubuntu set `APP_ACCESS_PIN_HASH` in the protected server environment file. Give the shared PIN only to people who should enter the site. Without the correct PIN, visitors cannot reach registration, sign-in, or API routes. Do not put the PIN itself in Angular source, HTML, or a committed environment file. Production should use a long random `SESSION_SECRET`; without the same secret after restarts, signed sessions become invalid. The shared PIN is the first access gate; individual accounts still control private profile updates and posting permissions.

## Ubuntu VM deployment

The browser must never connect directly to MySQL. Requests should follow this path:

`Browser -> HTTPS/Nginx -> FastAPI -> MySQL`

SQLAlchemy and the PyMySQL driver were already in this project and remain the production database layer. The browser does not talk to MySQL: Nginx sends `/api/` to FastAPI, and FastAPI uses the `DATABASE_URL` from its server environment to connect to MySQL. Set it on the API VM, for example:

```text
mysql+pymysql://vernwork_app:URL_ENCODED_PASSWORD@10.0.0.20:3306/vernwork?charset=utf8mb4
```

Use the database VM's private address. Create a dedicated database and least-privilege application user, then allow inbound TCP 3306 only from the API VM's private address in both the database firewall and host firewall. Do not expose MySQL publicly. If one Ubuntu VM runs both Nginx and FastAPI, expose 80/443 publicly, bind FastAPI to `127.0.0.1:8000`, and allow the API VM's private address through the database VM firewall. Never point the browser or Nginx directly at port 3306.

Set `CORS_ORIGINS` to exact browser origins, comma-separated: scheme plus hostname and optional port, with no path or trailing slash, e.g. `https://vernwork.example.com,https://www.vernwork.example.com`. If Angular and `/api` are served through the same domain by Nginx, browser requests are same-origin and CORS is not involved; keeping the exact origins configured is useful if you later host the frontend separately. Keep secrets in the API VM environment or a server-side `.env` that is not committed.

For Google login, the Google Cloud OAuth web client must list every browser origin in **Authorized JavaScript origins**. The supplied console screenshot has `http://localhost:4200`, so open the preview as `http://localhost:4200` (not `http://127.0.0.1:4200`) or add the latter origin in Google Cloud as well. For deployment, add the exact HTTPS site origin, without a path. The client ID shown in the console is configured in the Angular `google-client-id` meta tag and should be the value of the backend `GOOGLE_CLIENT_ID` environment variable. The frontend sends Google's signed ID token; FastAPI verifies its signature, audience, expiry, and verified email before creating/signing in a user. The previous code only decoded a token in the browser and never verified it, which is why its result could not be trusted.

`backend/.env.example` shows server settings. For an existing MySQL database, apply migrations 0002, 0003, and 0004 in order to add profile columns and the persistent projects table. SQLAlchemy `create_all()` creates missing tables but does not change existing tables. For a new empty database, SQLAlchemy creates the current schema at API startup.

### Public Ubuntu VM deployment

These commands assume your domain's DNS `A` record points to the VM's public IP, inbound ports 80/443 reach that VM, and MySQL is already installed on the VM or reachable by its private address. If this is a home computer, reserve a stable public IP or use dynamic DNS, configure router port forwarding to the Ubuntu VM, and ensure the VM uses bridged networking; a sleeping/shut-down computer makes the site unavailable.

1. Create the production database and least-privilege MySQL user. Bind MySQL to localhost if it is on the same VM; if on another VM, allow port 3306 only from the API VM's private IP. Never open 3306 publicly.
2. Copy the repository to `/var/www/vernwork`, create `/etc/vernwork/vernwork.env` using `backend/.env.example`, and set real values for `DATABASE_URL`, the bcrypt hash in `APP_ACCESS_PIN_HASH`, a long random `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `CORS_ORIGINS`, and `COOKIE_SECURE=true`. Generate the PIN hash on the VM without echoing the PIN:

	```bash
	cd /var/www/vernwork/backend
	venv/bin/python -c 'import bcrypt, getpass; print(bcrypt.hashpw(getpass.getpass("Shared site PIN: ").encode(), bcrypt.gensalt()).decode())'
	```

	Put the printed hash in `APP_ACCESS_PIN_HASH`; give the original PIN only to people allowed to enter the site. Keep the PIN hash set so the PIN screen stays in front of the site. Protect the environment file with `chown root:vernwork /etc/vernwork/vernwork.env` and `chmod 640 /etc/vernwork/vernwork.env`.
3. For an existing database, apply `0002_auth_and_location.mysql.sql`, then `0003_google_profile.mysql.sql`, then `0004_jobs.mysql.sql` once each. For a fresh database, let the API create the current tables. Back up the database before schema changes.
4. Create the `vernwork` Linux service account, create the Python venv in `backend/venv`, install `backend/requirements.txt`, and build the Angular frontend with `npm ci` then `npm run build` from `frontend`. Confirm the build directory is `frontend/dist/frontend/browser`.
5. Install `deploy/systemd/vernwork-api.service` as `/etc/systemd/system/vernwork-api.service`, ensure `/var/www/vernwork` is readable by `vernwork` and the build directory is readable by Nginx, then run `systemctl daemon-reload`, `systemctl enable --now vernwork-api`, and check `systemctl status vernwork-api` / `journalctl -u vernwork-api`.
6. Copy `deploy/nginx/vernwork.conf` to `/etc/nginx/sites-available/vernwork`, replace both example hostnames and set `root /var/www/vernwork/frontend/dist/frontend/browser;`, enable it with a symlink in `sites-enabled`, then run `nginx -t` and `systemctl reload nginx`.
7. Install Certbot's Nginx plugin and run `certbot --nginx -d your-domain.example.com -d www.your-domain.example.com`. Verify auto-renewal with `certbot renew --dry-run`. On the VM firewall and router, expose only 80/443; keep API port 8000 bound to localhost and MySQL 3306 private.
8. In Google Cloud's OAuth client, add the exact production origin (for example `https://your-domain.example.com`) under **Authorized JavaScript origins**. Then test account creation, Google sign-in, profile update, project posting, page reload, and a second browser/device.

Use `https://your-domain.example.com` as the public URL. `localhost` only works on the same computer and is not a public link.

## Current marketplace scope

Passwords are bcrypt-hashed with a fresh salt per account. People can sign in with their username or email and password. Google login verifies the signed ID token on the API, links by its verified email, and stores Google's stable subject, name, and profile photo URL; an already existing account with that email is linked rather than duplicated. Google-only accounts can set a password in Settings and later sign in with username/password. Login, registration, Google verification, and PIN unlock have per-IP rate limits. The PIN and user sessions are signed server-side and use an HttpOnly cookie; public profiles omit email, and only the signed-in user can update `/api/users/me`. `slowapi` rate limits are process-local; use a shared Redis-backed limiter before running multiple API workers or instances.

The marketplace includes search, category filters, saved projects, proposal submission, and project posting. Newly posted projects are stored in the database and include their real owner identity/profile link; the six demonstration listings are sample data. Saved-job and proposal submission tracking are still browser-local. Email-based verification/reset codes require an SMTP or transactional email provider, which this repository is not configured with; Google OAuth is the verified Gmail sign-in path.