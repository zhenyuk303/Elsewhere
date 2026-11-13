# Login-first Startup and Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Always open ELSEWHERE on Login and always return there after Log out, even when backend cleanup fails.

**Architecture:** Keep `App` as the owner of the current view. Remove startup session restoration, initialize the auth mode as `login`, and reset the client view before attempting logout cleanup so network state cannot trap the user on Homepage.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-11-13-login-first-design.md`

## Global Constraints

- No new dependencies.
- Preserve the existing Login/Sign Up forms, transition, and Homepage UI.
- Keep the backend logout request as best-effort cleanup.
- Restore a server session only for a backend-marked successful OAuth return.
- Prevent a new authentication submission until logout cleanup settles.

## Review Focus

- A restorable server user must not bypass Login on a fresh render.
- A failed backend logout must still return to Login.
- A successful backend logout must run exactly once.
- Login submissions must still produce the Login-labeled transition.
- Sign Up must remain reachable from the Login panel.

---

### Task 1: Pin login-first lifecycle behavior

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `logout(): Promise<void>` from `src/features/auth/authApi.ts`
- Produces: `App` startup and logout lifecycle behavior

- [x] **Step 1: Write failing tests**

Add tests proving a restorable user still sees the `Welcome` Login heading and a rejected logout still replaces Homepage with Login.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/App.test.tsx --run`

Expected: failures because startup currently restores Homepage and logout rejection currently leaves Homepage visible.

- [x] **Step 3: Implement the minimal lifecycle change**

In `src/App.tsx`, initialize `authMode` to `login`, remove startup restoration, and reset the client to Login before awaiting best-effort `logout()` cleanup.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/App.test.tsx --run`

Expected: all `App` tests pass.

- [x] **Step 5: Run full verification**

Run: `npm test -- --run`, `npm run typecheck`, and `npm run build`.

Expected: all tests pass and both TypeScript and Vite builds exit successfully.

- [x] **Step 6: Commit**

Commit the spec, plan, tests, and implementation with message `fix: make login the default app entry`.
