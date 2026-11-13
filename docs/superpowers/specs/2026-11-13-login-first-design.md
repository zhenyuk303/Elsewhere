# Login-first startup and logout design

## Intent

ELSEWHERE must always open on the Login experience. Reaching the Homepage remains possible only after a successful Login or Sign Up transition during the current app run.

## Behavior

- Initialize the authentication panel in `login` mode.
- Do not restore the Homepage from an existing server session during startup.
- When `Log out` is selected, immediately reset the client to the Login experience.
- Attempt the backend logout as best-effort cleanup; a network or backend failure must not keep the user on the Homepage.
- Preserve the existing authentication forms, airplane transition, Homepage layout, and profile-menu behavior.

## Approaches

- Chosen: login-first client lifecycle. This matches the requirement that every software launch begins at Login and keeps the demo usable if the backend is offline.
- Rejected: restore a valid session and only default anonymous users to Login. This can bypass Login on startup.
- Rejected: require successful backend logout before leaving Homepage. This reproduces the current no-response behavior when the backend is unavailable.

## Constraints

- No new dependencies.
- The server-side logout endpoint remains in use when reachable.
- Tests must cover startup with a restorable user and logout failure.
