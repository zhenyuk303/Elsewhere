# Elsewhere stage-test replay

Baseline: `3da9628c822eea917f298d397558db54d508a7ee`. The stage tests only change test files.

## Automated tests

1. At the checkout root, run `npm ci` and `npm test -- --run --reporter=verbose`. Look for `L01`–`L04`, `P01`–`P04`, and `I01` in the result.
2. Prepare a dedicated, local MySQL 8.4 instance with two empty schemas: `elsewhere_stage_auth` and `elsewhere_stage_i02`. Use utf8mb4 and `utf8mb4_0900_ai_ci`. Give each schema its own account with the schema permissions described in the repository README. Never use a development or shared database: the test cleans its synthetic accounts and expects clean fixtures. Let Spring initialize the tables.
3. Set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` for `elsewhere_stage_auth`; set `TEST_DB_URL`, `TEST_DB_USERNAME`, and `TEST_DB_PASSWORD` for `elsewhere_stage_i02`. Use loopback TCP addresses in both JDBC URLs, and keep credentials out of logs and version control.
4. In `backend/`, run `mvn -Dtest=StageAuthHttpTest test` (E01 is ordered first), then `mvn -Dtest=FootprintFlowTest test`. Check that both logs report the MySQL connector, not H2.

JDBC URL example: `jdbc:mysql://127.0.0.1:13386/elsewhere_stage_auth?characterEncoding=UTF-8&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true`. For the second schema replace only the database name; use its separate credentials. The app accepts Java 21 or newer; this run used Java 25 with a Java 21 compilation target.

## Browser flow I03

Start the backend from `backend/` with `mvn spring-boot:run`, `SERVER_ADDRESS=127.0.0.1`, `PORT=18087`, `ELSEWHERE_DEMO_USERS=false`, and the isolated `DB_*` above. Start Vite in the root with `BACKEND_URL=http://127.0.0.1:18087` and `npm run dev -- --host 127.0.0.1 --port 5187 --strictPort`.

Use a fresh synthetic user: sign up, log out, and password-login. In Footprints, add `.stage/fixture.png` (the 1-by-1 PNG from the existing backend fixture), select Anhui, enter Hefei and the note `春游`, then save. Log out, log in, filter Anhui, and open the new photo. The upload is intentionally a solid white pixel, not the existing Anhui landscape; look for the matching server image and the city and note. Edit, delete only the synthetic upload, and refresh. This baseline returns to Login after reload: log back in and check that the upload is gone while the bundled Anhui photo remains. Save evidence without any auth form values or session credentials. Shut down the isolated services after replay.
