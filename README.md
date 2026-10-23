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
