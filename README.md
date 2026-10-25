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

## QQ and WeChat website login

The QQ and WeChat buttons now start a real server-side authorization flow. Until platform credentials are configured, clicking a button displays a clear message and keeps the user on the login form. Username/password login still works.

1. Apply for a **website application** in [QQ Connect](https://connect.qq.com/) and a **website application** in the [WeChat Open Platform](https://open.weixin.qq.com/). Approval and a public HTTPS callback domain are required before a live sign-in can be tested. Register callback URLs that match the values below exactly.
2. Set these environment variables on the backend server (for example in the IDEA run configuration). Keep secrets out of Git and the Vite frontend:

   | Provider | Environment variables | Example callback URL |
   | --- | --- | --- |
   | QQ | `QQ_APP_ID`, `QQ_APP_SECRET`, `QQ_REDIRECT_URI` | `https://your-domain.example/api/auth/oauth/qq/callback` |
   | WeChat | `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, `WECHAT_REDIRECT_URI` | `https://your-domain.example/api/auth/oauth/wechat/callback` |

3. Serve the built frontend and proxy `/api/` to the Spring Boot backend on the **same public origin**. The browser must visit that HTTPS origin for the login button and callback. Vite's `localhost:5173` proxy is useful for local UI work, but it does not replace an approved public callback domain.

The frontend calls `POST /api/auth/oauth/{qq|wechat}/start`. The backend creates a 10-minute, one-use `state`, stores only its hash, and sends the browser to the provider. The callback at `GET /api/auth/oauth/{qq|wechat}/callback` checks the state and exchanges the code on the backend. It maps the provider's OpenID to a local user, issues the existing HttpOnly session cookie, and returns to the app. The provider token and AppSecret are never sent to the browser or stored in the database. A social account gets its own local user record; automatic linking to an existing username/password account is deliberately absent to avoid joining accounts without ownership verification.

The new `oauth_identities` table holds the provider, AppID, provider user ID, and local user ID. The `oauth_login_states` table holds the temporary state hash and expiry. Existing H2 files receive these tables through `schema.sql` at startup. Before a production launch, provide real Terms/Privacy pages and review the consent text for social signup.

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
