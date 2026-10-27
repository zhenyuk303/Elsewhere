# Elsewhere

A travel authentication demo with signup/login, a timed destination carousel, and a liquid airplane-runway transition. A small Spring Boot service now handles real accounts and sessions.

## Run locally

```bash
npm install
npm run dev
```

Start the backend first (see below), then open the URL printed by Vite. The signup page is the default route.

## Backend (IntelliJ IDEA)

Open `backend/pom.xml` as a Maven project in IDEA. Use Java 21 or newer. Run `ElsewhereApplication`, then run the Vite frontend. Vite forwards `/api` to `http://localhost:8080`.

The backend uses a local H2 database file at `backend/data/elsewhere` by default. No external database is needed for the first login/register stage. Set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` if you need a different H2 location. Passwords are stored as BCrypt hashes; the browser receives an HttpOnly session cookie after registration or login. Sessions last seven days and are stored as SHA-256 token hashes in the database.

For a classroom demo, set `ELSEWHERE_DEMO_USERS=true` and `ELSEWHERE_DEMO_PASSWORD` to a password of at least eight characters before starting the backend. This creates four users once: `traveler`, `atlas`, `rivers`, and `skyline`. Demo users are disabled by default.

Run `mvn test` from `backend/` to verify the API. `POST /api/auth/register` expects `{ "username": "traveler", "password": "at least 8 characters", "agreementAccepted": true }`. `POST /api/auth/login` expects username and password. `GET /api/auth/me` checks the session; `POST /api/auth/logout` ends it. The frontend calls these APIs and starts its existing transition only after successful authentication.

## GitHub and Google login

The GitHub and Google buttons use the backend OAuth authorization-code flow. Configure these four environment variables for the **backend process**: `CLIENT_ID_GITHUB`, `CLIENT_SECRET_GITHUB`, `CLIENT_ID_GOOGLE`, and `CLIENT_SECRET_GOOGLE`. Keep secrets out of source files and Vite variables. Restart IDEA after adding system environment variables so its run configuration inherits them.

Register these exact callback URLs in a GitHub OAuth App and a Google OAuth **Web application** client:

| Provider | Local callback URL | Optional override |
| --- | --- | --- |
| GitHub | `http://127.0.0.1:5173/api/auth/oauth/github/callback` | `GITHUB_REDIRECT_URI` |
| Google | `http://127.0.0.1:5173/api/auth/oauth/google/callback` | `GOOGLE_REDIRECT_URI` |

Open the app at `http://127.0.0.1:5173/` when using those defaults. `localhost` and `127.0.0.1` have different browser cookies: if you choose `localhost`, set both redirect URI overrides to the matching `localhost` URL and register those URLs with the providers. Production callbacks must use the site's HTTPS origin, with `/api/` routed to the backend. GitHub's callback registration and Google's authorized redirect URI must match the URLs used by the backend.

The frontend calls `POST /api/auth/oauth/{github|google}/start`, receives a provider authorization URL, then navigates there. The callback at `GET /api/auth/oauth/{github|google}/callback` verifies a one-use browser-bound `state` and PKCE code verifier, exchanges the code on the backend, retrieves the provider's stable user ID, and issues the existing HttpOnly session cookie. The provider access token and client secret are never sent to the frontend or stored in H2. The `oauth_identities` table maps a GitHub user ID or Google `sub` to a local user. It does not automatically merge with an existing password account; that would require a separate account-linking flow with ownership checks.

## Quality checks

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Project scope

- React + TypeScript + Vite
- A small Spring Boot login/register backend with a local H2 database
- Signup and login mode changes stay entirely in the left panel
- The destination carousel uses a 2.5-second color reveal, 3-second hold, and 1.2-second horizontal slide
- Successful server authentication triggers the liquid runway and airplane transition into a placeholder home view
- Reduced-motion preferences are respected

Travel image entries and location labels are defined in [`src/features/carousel/carouselData.ts`](src/features/carousel/carouselData.ts). Replace the imported local images there to update the carousel.
