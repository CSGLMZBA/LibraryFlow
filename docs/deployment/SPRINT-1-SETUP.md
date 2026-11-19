# Sprint 1 Functional MVP — Local and Cloud Setup

Owner: Carlos Gabriel Martinez Bazaldua

## 1. Run locally

Requirements:

- Node.js 20 or newer
- npm
- A modern browser with IndexedDB

From the repository root:

```bash
npm install
npm run build
npm run dev:frontend
npm run dev:backend
```

Open `http://localhost:5173`. The backend health endpoint is
`http://localhost:3000/health`.

Use separate reader and publisher registrations to exercise role flows.
To create the seeded local moderator:

1. Enter a valid password in the password field.
2. Select **Create / reset local test moderator**.
3. Sign in with `moderator@libraryflow.local` and the chosen password.

The moderator control is visible only in Vite development mode.

## 2. Demo flow

1. Register a publisher and submit an EPUB or PDF no larger than 20 MB.
2. Sign out and sign in as the local moderator.
3. Approve or reject the submission with a valid reason.
4. Sign out and browse/register as a reader.
5. Search or filter the approved catalog.
6. Download an approved book and read or save the completed copy offline.
7. Post a reader comment, sign in as the publisher, and view the comments.
8. Sign in as the moderator and remove a violating comment with an audit reason.

## 3. Firebase Authentication

Create a Firebase project and enable Email/Password authentication.

Firebase service variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`

Create a service account with least-available privileges for Firebase
Authentication and Firestore. Store the private key only in the Render secret
environment. Do not paste it into Git or `netlify.toml`.

For the backend:

```text
APP_MODE=cloud
PORT=3000
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_CLIENT_EMAIL=<service-account-email>
FIREBASE_PRIVATE_KEY=<private-key-with-\n-escaped-newlines>
FIREBASE_WEB_API_KEY=<web-api-key>
CORS_ORIGIN=http://localhost:5173,https://<your-netlify-site>.netlify.app
```

Set custom claims through the backend registration/login flow. Public
registration accepts only `reader` and `publisher`; `moderator` cannot be
requested through the public API.

Create an initial moderator explicitly in Firebase Console or Admin SDK, set
the custom claim `role: "moderator"`, and disable public reset/admin actions in
production.

### Provision a moderator account

First create or register the account through Firebase Authentication. It must
already exist in the Firebase project before it can receive the moderator role.

Set `MODERATOR_EMAIL` in the local `.env` file:

```text
MODERATOR_EMAIL=admin@example.com
```

The Firebase service-account variables in the same `.env` file must also be
configured. Then run:

```bash
npm run admin:moderator
```

You can override the environment value for a one-time assignment:

```bash
npm run admin:moderator -- admin@example.com
```

The script verifies that the Firebase account exists, assigns the
`role: "moderator"` custom claim, and revokes existing refresh tokens. The
account must sign out and sign in again to obtain a fresh token.

Keep `.env` and service-account credentials out of Git. Do not add a public
endpoint for setting moderator roles.

## 4. Firestore

Enable Firestore Native mode in the same Firebase project. Add least-privilege
server rules: browser clients must not be authoritative for authentication,
ownership, lifecycle, or moderation.

The Sprint 1 backend uses Firestore for display-name reservation and is prepared
for server-side verification. Production book/comment synchronization remains
governed by the backend API and stable IDs/revisions.

Recommended collections:

- `users`
- `auth-display-name-reservations`
- `books`
- `classifications`
- `genres`
- `comments`
- `notifications`
- `moderation-audit`

Do not enable public write access to these collections.

## 5. Supabase storage

Create a Supabase project and private bucket.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`

Keep the service-role key only on Render. Never expose it in Vite variables.
The bucket should accept only EPUB/PDF MIME types and enforce a 20 MB maximum
object size where the platform supports it. The backend and bucket policies
must also enforce the limit.

Pending and rejected files must not be publicly readable. Rejected files are
eligible for deletion 24 hours after rejection; deletion must be idempotent
and retryable.

## 6. Render

The repository includes `render.yaml`. In Render:

1. Create a Blueprint from the repository.
2. Set `CORS_ORIGIN` to the final Netlify URL.
3. Set all Firebase variables.
4. Set all Supabase variables.
5. Deploy and verify `https://<render-service>/health`.

Render build command:

```bash
npm install && npm run build --workspace @library-flow/shared && npm run build --workspace @library-flow/backend
```

Render start command:

```bash
npm run start --workspace @library-flow/backend
```

## 7. Netlify

The repository includes `netlify.toml` for a Vite build.

In Netlify site environment variables:

```text
VITE_AUTH_MODE=cloud
VITE_API_BASE_URL=https://<render-service>.onrender.com
```

`VITE_AUTH_MODE` and `VITE_API_BASE_URL` are intentionally public browser
configuration. `netlify.toml` excludes those variable names from Netlify secret
scanning. Configure them in the Netlify dashboard or build environment, never
add Firebase private keys or Supabase service-role secrets to `VITE_*` variables.

Deploy from the repository. Netlify redirects all frontend routes to
`index.html`. The browser sends API calls to the Render URL configured by
`VITE_API_BASE_URL`.

After deployment:

1. Update Render `CORS_ORIGIN` to the Netlify origin.
2. Open the Netlify site and register a reader/publisher.
3. Verify the `/health` endpoint and protected API routes.
4. Do not mark cloud acceptance passed until credentials, UI login, reload,
   and moderation evidence have been recorded.

## 8. Verification

```bash
npm test
npm run typecheck
npm run build
curl https://<render-service>.onrender.com/health
```

Run the browser MVP flow in both local and cloud modes. Record test evidence and
external configuration dates in `docs/testing/S1-ACCEPTANCE-REGISTER.md`.
