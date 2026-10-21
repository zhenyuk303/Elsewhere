# Elsewhere Login and Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a front-end-only Elsewhere registration and login Demo with an uninterrupted travel carousel and a liquid-button-to-airplane-runway transition into a placeholder home page.

**Architecture:** A React state machine keeps the auth mode independent from the persistent carousel, while focused feature components own form validation, carousel timing, and the transition sequence. CSS handles presentation and motion, SVG provides the rotating color clip, gooey filter, and airplane silhouette, and React timers only advance explicit animation phases.

**Tech Stack:** React, TypeScript, Vite, CSS, inline SVG, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-10-21-login-signup-design.md`

## Global Constraints

- The Demo is front-end only: no backend, database, or real authentication calls.
- Default view is signup; signup and login contain only Username and Password fields.
- The right carousel remains mounted and keeps its state when the bottom Login / Sign up link changes the left panel.
- Carousel timing is exactly 2500 ms reveal, 3000 ms hold, and 1200 ms horizontal slide; no crossfade.
- The main Login button is the only trigger for the runway transition.
- The animation stack is CSS plus inline SVG; do not add a general animation library, Canvas, or WebGL.
- The home page remains a placeholder and exposes a clean component boundary for later replacement.
- Respect `prefers-reduced-motion` and retain keyboard-visible focus states.

## Review Focus

- Empty or whitespace-only credentials must show validation errors and must not start the runway transition; Task 2 pins this behavior.
- An unchecked signup agreement must block submission, while login must not require the agreement; Task 2 pins both paths.
- Repeated Login clicks during a valid transition must start only one transition; Task 5 pins the lock.
- Switching auth modes during any carousel phase must preserve the active slide and phase; Task 5 pins component persistence.
- Pausing during a carousel timer must not advance or burst through queued phases; Task 3 pins pause/resume behavior.

---

### Task 1: Vite React foundation and application shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/global.css`

**Interfaces:**
- Produces: `App(): JSX.Element`, the Vite entry point, and a jsdom test harness used by all later tasks.

- [ ] **Step 1: Add the project and test configuration**

Create Vite/TypeScript configuration and npm scripts `dev`, `build`, `test`, and `typecheck`. Add React runtime dependencies and Vite, TypeScript, Vitest, jsdom, and Testing Library development dependencies. Configure Vitest to load `src/test/setup.ts`.

- [ ] **Step 2: Write the failing application smoke test**

In `src/App.test.tsx`, render `<App />` and assert that `ELSEWHERE` and `Create your account` are visible while `A wonderful journey begins now.` is absent.

- [ ] **Step 3: Run the smoke test and verify failure**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because `App` or the expected signup content does not exist.

- [ ] **Step 4: Implement the minimal shell**

Implement `main.tsx`, `App.tsx`, and base CSS with the default signup copy needed by the test. Set page metadata and load a system-first sans-serif font stack.

- [ ] **Step 5: Verify the foundation**

Run: `npm test -- --run src/App.test.tsx && npm run typecheck && npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig*.json vite.config.ts index.html src
git commit -m "chore: scaffold Elsewhere frontend"
```

### Task 2: Accessible auth form and validation

**Files:**
- Create: `src/features/auth/types.ts`
- Create: `src/features/auth/AuthPanel.tsx`
- Create: `src/features/auth/AuthPanel.test.tsx`
- Create: `src/features/auth/auth.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `type AuthMode = 'signup' | 'login'`.
- Produces: `type TransitionOrigin = { left: number; top: number; width: number; height: number }`.
- Produces: `AuthPanel(props: { mode: AuthMode; disabled: boolean; onModeChange(mode: AuthMode): void; onValidSubmit(origin: TransitionOrigin): void }): JSX.Element`.

- [ ] **Step 1: Write failing form behavior tests**

Test exact signup/login headings and copy, absence of Email, password visibility toggling, QQ/微信 signup buttons, and mode-link callbacks. Assert whitespace-only Username/Password errors, unchecked signup agreement failure, successful signup origin capture, and successful login without an agreement checkbox.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- --run src/features/auth/AuthPanel.test.tsx`

Expected: FAIL because `AuthPanel` is missing.

- [ ] **Step 3: Implement `AuthPanel`**

Use a semantic form with controlled Username, Password, password visibility, agreement, and field errors. Trim credentials for validation, preserve the exact required copy, provide accessible labels and focus styles, and call `onValidSubmit` with the main button's `getBoundingClientRect()` values only after validation passes.

- [ ] **Step 4: Connect the panel to `App` without the transition**

Keep `authMode` in `App`, pass `disabled={false}`, and let `onModeChange` update only the left-panel mode. Temporarily store valid submit origin without navigating.

- [ ] **Step 5: Verify the auth feature**

Run: `npm test -- --run src/features/auth/AuthPanel.test.tsx src/App.test.tsx && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth src/App.tsx src/App.test.tsx
git commit -m "feat: add registration and login forms"
```

### Task 3: Persistent timed travel carousel

**Files:**
- Create: `src/features/carousel/carouselData.ts`
- Create: `src/features/carousel/useCarousel.ts`
- Create: `src/features/carousel/useCarousel.test.tsx`
- Create: `src/features/carousel/TravelCarousel.tsx`
- Create: `src/features/carousel/TravelCarousel.test.tsx`
- Create: `src/features/carousel/carousel.css`
- Create: `src/assets/travel/barcelona.jpg`
- Create: `src/assets/travel/kyoto.jpg`
- Create: `src/assets/travel/santorini.jpg`

**Interfaces:**
- Produces: `type CarouselPhase = 'reveal' | 'hold' | 'slide'`.
- Produces: constants `REVEAL_MS = 2500`, `HOLD_MS = 3000`, and `SLIDE_MS = 1200`.
- Produces: `useCarousel(itemCount: number, paused: boolean): { currentIndex: number; nextIndex: number; phase: CarouselPhase }`.
- Produces: `TravelCarousel(props: { paused: boolean }): JSX.Element`.

- [ ] **Step 1: Add three local travel assets and typed slide data**

Create original landscape images for Barcelona, Kyoto, and Santorini, store them locally, and export a typed array containing only `{ src, location }`. No package descriptions or secondary captions are allowed.

- [ ] **Step 2: Write failing timer and rendering tests**

With fake timers, assert `reveal → hold` at 2500 ms, `hold → slide` after another 3000 ms, and the next slide's `reveal` after another 1200 ms. Assert pause prevents advancement and resume schedules one next phase. Render `TravelCarousel` and assert that only location labels are present and no travel-package copy exists.

- [ ] **Step 3: Run the carousel tests and verify failure**

Run: `npm test -- --run src/features/carousel`

Expected: FAIL because the hook and component are missing.

- [ ] **Step 4: Implement the timer state machine**

Implement `useCarousel` with one timeout per phase and cleanup on phase, pause, or unmount changes. Sliding completion increments the index modulo `itemCount` and returns to `reveal`; paused state cancels the active timeout without queuing phase changes.

- [ ] **Step 5: Implement the visual carousel**

Render current and next slides in a horizontal track. For each active slide, render a grayscale base plus a full-color SVG image clipped by a rotating rounded `<rect>` that expands to about 70% of panel width, with a synchronized 5px white outline. Slide with transform only for 1200 ms and never animate opacity.

- [ ] **Step 6: Verify carousel behavior**

Run: `npm test -- --run src/features/carousel && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/carousel src/assets/travel
git commit -m "feat: add timed travel carousel"
```

### Task 4: Liquid runway and airplane transition

**Files:**
- Create: `src/features/transition/transitionTypes.ts`
- Create: `src/features/transition/RunwayTransition.tsx`
- Create: `src/features/transition/RunwayTransition.test.tsx`
- Create: `src/features/transition/transition.css`

**Interfaces:**
- Consumes: `TransitionOrigin` from Task 2.
- Produces: `const TRANSITION_MS = 3200`.
- Produces: `RunwayTransition(props: { origin: TransitionOrigin; onComplete(): void }): JSX.Element`.

- [ ] **Step 1: Write failing transition lifecycle tests**

Assert that the overlay exposes the origin as CSS custom properties, contains an accessible-hidden airplane SVG and gooey filter, starts in the liquid stage, advances through runway and flight stages, and calls `onComplete` exactly once at 3200 ms. Add a reduced-motion test that completes on the shortened path.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/features/transition/RunwayTransition.test.tsx`

Expected: FAIL because `RunwayTransition` is missing.

- [ ] **Step 3: Implement the transition stage controller**

Use local stages `liquid`, `runway`, and `flight`, one-shot timers, complete cleanup, and a ref guard around `onComplete`. Read `prefers-reduced-motion` to select the short completion path.

- [ ] **Step 4: Implement the SVG/CSS animation layer**

Position the initial black shape from `TransitionOrigin`, dissolve the Login label, and use an SVG blur/color-matrix gooey filter while the shape stretches toward the layout divider. Form a black perspective runway, reveal a white inline airplane silhouette at its front, accelerate the airplane downward along the divider, and expose CSS stage classes for the page-shell exit animation.

- [ ] **Step 5: Verify transition behavior**

Run: `npm test -- --run src/features/transition && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/transition
git commit -m "feat: add liquid runway transition"
```

### Task 5: Application state integration and home target

**Files:**
- Create: `src/features/home/HomePlaceholder.tsx`
- Create: `src/features/home/home.css`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `AuthPanel`, `TravelCarousel`, `RunwayTransition`, and `TransitionOrigin` from Tasks 2–4.
- Produces: application view state `type ViewState = 'auth' | 'transitioning' | 'home'` and the final integrated `App`.

- [ ] **Step 1: Write failing integration tests**

Assert that toggling signup/login preserves the carousel DOM node, current slide index, and phase. Assert valid submission pauses the carousel, mounts exactly one transition despite repeated clicks, adds the shell-exit state, and mounts `HomePlaceholder` only after transition completion.

- [ ] **Step 2: Run the application tests and verify failure**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because the components are not integrated.

- [ ] **Step 3: Implement the view state machine**

Keep `TravelCarousel` outside the keyed left-panel content. On valid submit, save the origin, set `view='transitioning'`, disable the form, and pass `paused={true}`. Ignore later submissions until `RunwayTransition` calls completion, then set `view='home'` and unmount the auth shell.

- [ ] **Step 4: Implement `HomePlaceholder`**

Render a semantic main container with `ELSEWHERE`, a short journey-start message, and no business controls or mock data.

- [ ] **Step 5: Verify integrated behavior**

Run: `npm test -- --run && npm run typecheck && npm run build`

Expected: all tests pass and both checks exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/features/home src/styles/global.css
git commit -m "feat: integrate auth journey transition"
```

### Task 6: Responsive polish and final acceptance

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/features/auth/auth.css`
- Modify: `src/features/carousel/carousel.css`
- Modify: `src/features/transition/transition.css`
- Modify: `src/features/home/home.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete application from Task 5.
- Produces: production-ready responsive styling and documented local commands.

- [ ] **Step 1: Add desktop and narrow-screen layout rules**

Finish the white minimal card, consistent radii and spacing, two-column desktop layout, vertical divider, and stacked mobile layout. Keep the form first and shorten the image panel on narrow screens while preserving the transition axis.

- [ ] **Step 2: Add interaction and fallback states**

Add hover, pressed, disabled, validation, focus-visible, image fallback, and `prefers-reduced-motion` rules. Confirm no mode-link rule targets or restarts the carousel.

- [ ] **Step 3: Document the Demo**

Update `README.md` with setup, `npm run dev`, tests, build, the front-end-only scope, and the replaceable carousel data location.

- [ ] **Step 4: Run the automated release checks**

Run: `npm test -- --run && npm run typecheck && npm run build`

Expected: all tests pass, TypeScript exits 0, and Vite creates `dist/` successfully.

- [ ] **Step 5: Inspect in a desktop browser**

Run the Vite dev server and verify the 16 acceptance criteria at approximately 1440×900. Observe at least one complete 6.7-second carousel cycle and both auth-mode switches. Trigger the valid transition and confirm the liquid merge, runway alignment, airplane flight, shell exit, and home mount.

- [ ] **Step 6: Inspect in a mobile browser**

Verify at approximately 390×844 that the form remains usable without horizontal overflow, the carousel is legible, focus remains visible, and reduced-motion mode reaches the same final state.

- [ ] **Step 7: Commit**

```bash
git add src README.md
git commit -m "style: polish responsive Elsewhere demo"
```
