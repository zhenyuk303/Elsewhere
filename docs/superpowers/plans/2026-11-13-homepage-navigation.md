# Homepage Navigation Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hover underlines and an accessible profile menu whose reserved personal-homepage action is inert and whose logout action returns the app to Login.

**Architecture:** Keep menu state, dismissal listeners, and reserved navigation hooks inside `HomePage`. Pass one async logout callback from `App`, where the existing auth API and view state already live; style the interactions in the existing homepage stylesheet without adding routing or dependencies.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-11-13-homepage-navigation-design.md`

## Global Constraints

- `Footprints`, `Guides`, `Community`, and `Personal homepage` remain reserved hooks and must not navigate.
- `Log out` must use the existing `logout()` API and return to the Login view only after success.
- No router, new backend endpoint, UI library, or homepage entrance animation.
- Existing 10-second background rotation and runway transition behavior must remain unchanged.

## Review Focus

- Repeated profile clicks: exactly one menu toggles without duplicate document listeners.
- Outside click and Escape: the menu closes, with Escape returning focus to the profile button.
- Failed or repeated logout: the homepage stays mounted, the menu remains retryable, and duplicate logout calls are blocked while pending.
- Reserved hooks: none of the four placeholder actions change URL or app view.
- Narrow and short viewports: the open menu remains inside the viewport without obscuring the profile trigger.

---

## File Structure

- Modify `src/features/home/HomePage.tsx`: reserved navigation buttons, profile menu state, dismissal lifecycle, and async logout UI handling.
- Modify `src/features/home/HomePage.test.tsx`: menu, dismissal, reserved-hook, accessibility, pending, and failure coverage.
- Modify `src/features/home/home.css`: underline affordance and responsive profile-menu presentation.
- Modify `src/App.tsx`: restore the existing auth logout API integration and pass it to `HomePage`.
- Modify `src/App.test.tsx`: verify successful logout returns to Login and a failed logout keeps the homepage visible.

### Task 1: Build the homepage navigation and profile menu

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Modify: `src/features/home/home.css`

**Interfaces:**
- Consumes: `onLogout: () => Promise<void>` supplied by `App`.
- Produces: `HomePage({ onLogout }: HomePageProps)` with `.homepage-nav-action`, `.homepage-profile-menu`, and `.homepage-profile-menu-item` hooks.

- [ ] **Step 1: Write failing component tests**

Add tests asserting that the three top-level destinations are buttons rather than links; the profile button exposes `aria-haspopup="menu"` and toggles `aria-expanded`; opening shows exactly `Personal homepage` and `Log out`; Personal homepage closes the menu without navigation; outside pointer interaction and Escape close it; Escape restores profile focus; one pending logout call disables repeated submission; a rejected logout keeps the homepage and menu retryable.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/features/home/HomePage.test.tsx`

Expected: FAIL because `HomePage` has no logout prop, navigation buttons, or profile menu.

- [ ] **Step 3: Implement the interaction state and DOM contract**

Add `HomePageProps { onLogout: () => Promise<void> }`, profile/menu refs, open and pending state, document dismissal listeners active only while open, reserved button hooks, and an error-catching logout handler. Use menu/menuitem semantics and keep the menu open after logout failure.

- [ ] **Step 4: Add the hover and menu presentation**

Style `.homepage-nav-action` as reset text buttons with a white pseudo-element underline on `:hover` and `:focus-visible`. Position the menu below the profile circle, use a restrained translucent dark surface with white text, and keep it within the existing mobile and short-landscape insets.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `npm test -- --run src/features/home/HomePage.test.tsx`

Expected: all homepage tests PASS with no timer or unhandled-rejection warnings.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/HomePage.tsx src/features/home/HomePage.test.tsx src/features/home/home.css
git commit -m "feat: add homepage profile menu"
```

### Task 2: Reconnect logout to the App auth flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `logout(): Promise<void>` from `src/features/auth/authApi.ts` and `HomePage({ onLogout })` from Task 1.
- Produces: `handleLogout(): Promise<void>` that returns the app to `auth` in `login` mode after the API succeeds.

- [ ] **Step 1: Write failing App integration tests**

Mock `currentUser()` to restore a signed-in user, click the profile button and `Log out`, then assert the logout API is called once and the Login heading appears. Add a rejection case asserting the Explore heading remains visible and Login does not appear.

- [ ] **Step 2: Run the App tests and verify RED**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because `App` does not import `logout`, does not pass `onLogout`, and has no logout view-state handler.

- [ ] **Step 3: Implement `handleLogout` and pass it to `HomePage`**

Import `logout`, await it before changing state, clear transition metadata, set `authMode` to `login`, and set `view` to `auth`. Do not catch errors in `App`; `HomePage` owns the retryable menu behavior.

- [ ] **Step 4: Run integration and full verification**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Expected: all tests PASS, TypeScript and Vite exit 0, and diff check reports no errors.

- [ ] **Step 5: Visually inspect the interaction**

Verify desktop and narrow layouts: each navigation label gains only a white underline on hover/focus; the profile menu aligns below the circle; all copy remains readable; Personal homepage is inert; Log out returns to Login; outside click and Escape close the menu.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: reconnect homepage logout"
```
