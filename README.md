# Vernwork

Freelance marketplace built with Angular and FastAPI. SQLAlchemy connects the API to MySQL in production and SQLite during local development.

## Local development

1. Install backend dependencies from `backend/requirements.txt` and frontend dependencies from `frontend` with `npm install`.
2. Configure `backend/.env` using `backend/.env.example`. Set `GOOGLE_CLIENT_ID` to enable Google sign-in. A local access PIN hash can be stored in the ignored `backend/.access-pin-hash` file.
3. Start the API from `backend` with `uvicorn main:app --reload`.
4. Start Angular from `frontend` with `npm start`.

The frontend runs at `http://localhost:4200` and proxies `/api` to the API. If `DATABASE_URL` is unset, the API uses SQLite.

## Deployment

Production uses Nginx to serve the Angular build and proxy `/api` to Uvicorn. Configure the server environment with `DATABASE_URL`, `APP_ACCESS_PIN_HASH`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `CORS_ORIGINS`, and `COOKIE_SECURE=true`. Serve the site over HTTPS and keep MySQL private.

Build from `frontend` with `npm ci` and `npm run build`. Example Nginx and systemd configs are in `deploy/`. Apply the SQL migrations in `backend/migrations` in order when upgrading an existing database.

## Features

- Email/password and Google sign-in
- User profiles and password settings
- Project search, posting, saved listings, and proposals

Saved listings and proposal tracking are stored in the browser. Email verification and password-reset email are not configured.