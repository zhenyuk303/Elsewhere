# Circular Airplane Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old liquid/runway transition with the approved five-stage circular stretch, upward airplane flight, and page-wipe transition.

**Architecture:** Preserve the existing App/AuthPanel boundary, but expand the submit-time geometry snapshot so the overlay can align with the real card divider and height. `RunwayTransition` becomes a tested five-stage React timer state machine, while CSS animates a small set of DOM/SVG layers without moving the underlying auth page.

**Tech Stack:** React 19, TypeScript, CSS animations, inline SVG, Vitest, Testing Library, Vite

**Spec:** `docs/superpowers/specs/2026-10-21-circular-airplane-transition-design.md`

## Global Constraints

- Keep the current signup/login copy, form fields, agreement visibility, social actions, and bottom-link behavior unchanged.
- Keep the carousel at 2.5s reveal, 3s hold, and 1.2s horizontal slide with a 5px white mask border.
- The five normal-motion stages start at 0ms, 450ms, 1000ms, 1700ms, and 1900ms; completion is 3000ms.
- The black overlay bar is 44px wide and spans the measured card height.
- The underlying auth card must not translate, rotate, fade, or resize during the transition.
- Use only frontend state, CSS, and inline SVG; add no runtime dependency or network asset.
- Bottom Login/Sign up links must not start the transition or reset the carousel.

## Review Focus

- A card positioned away from the viewport center must still provide its actual divider and top/bottom geometry; pinned by Task 1 App geometry test.
- Repeated submit clicks during transition must mount one overlay and invoke completion once; pinned by Task 3 integration test.
- Timer cleanup on unmount must prevent a late completion callback; pinned by Task 2 cleanup test.
- Reduced-motion users must get the same stage order and final state without long motion; pinned by Task 2 reduced-motion test.
- Mobile stacked layout must use the card horizontal center instead of a missing vertical divider; pinned by Task 1 fallback geometry test.

---

### Task 1: Capture Transition Geometry at Submit Time

**Files:**
- Modify: `src/features/auth/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `AuthPanel.onValidSubmit(origin: ButtonRect)` with existing button `left`, `top`, `width`, and `height` values.
- Produces: `TransitionOrigin` containing `left`, `top`, `width`, `height`, `dividerX`, `cardTop`, and `cardHeight` numbers for `RunwayTransition`.

- [ ] **Step 1: Write failing App geometry tests**

Add tests that mock distinct `getBoundingClientRect()` values for `.journey-card`, `.travel-carousel`, and the submit button, submit a valid signup form, and assert the mounted overlay receives CSS variables for the actual button rectangle, `dividerX`, `cardTop`, and `cardHeight`. Add a second test where `matchMedia('(max-width: 880px)')` matches and assert `dividerX === card.left + card.width / 2`.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because the additional geometry variables are absent.

- [ ] **Step 3: Expand the geometry contracts**

In `src/features/auth/types.ts`, introduce `ButtonRect` for the existing four button fields and expand `TransitionOrigin` with `dividerX`, `cardTop`, and `cardHeight`. Update `AuthPanelProps.onValidSubmit` to consume `ButtonRect`.

- [ ] **Step 4: Capture card and divider geometry in App**

Add a `useRef<HTMLDivElement>` to `.journey-card`. In `handleValidSubmit(buttonOrigin: ButtonRect)`, read the card rectangle and carousel rectangle once. Use carousel `left` on desktop and card horizontal center when `(max-width: 880px)` matches; then store the complete `TransitionOrigin` snapshot before entering `transitioning`.

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- --run src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the geometry contract**

```bash
git add src/features/auth/types.ts src/App.tsx src/App.test.tsx
git commit -m "feat: capture transition layout geometry"
```

### Task 2: Implement the Five-Stage Transition State Machine

**Files:**
- Modify: `src/features/transition/transitionTypes.ts`
- Modify: `src/features/transition/RunwayTransition.tsx`
- Modify: `src/features/transition/RunwayTransition.test.tsx`

**Interfaces:**
- Consumes: `TransitionOrigin` from Task 1 and `onComplete(): void`.
- Produces: `TransitionStage = 'collapse' | 'dock' | 'stretch' | 'morph' | 'flight'`, exported `TRANSITION_MS = 3000`, and `REDUCED_TRANSITION_MS = 150`.

- [ ] **Step 1: Replace the old stage test with exact timing tests**

Assert initial `data-stage="collapse"`; advance fake timers to 450ms, 1000ms, 1700ms, and 1900ms and assert `dock`, `stretch`, `morph`, and `flight`. At 3000ms assert `onComplete` was called once, and further timer advancement does not call it again.

- [ ] **Step 2: Add structure and geometry assertions**

Assert the overlay writes `--origin-*`, `--divider-x`, `--card-top`, and `--card-height`; assert it contains test IDs for `transition-shape`, `transition-dot`, `transition-airplane`, `page-wipe`, `wing-guide-left`, and `wing-guide-right`; assert the obsolete goo filter and liquid drops are absent.

- [ ] **Step 3: Add cleanup and reduced-motion tests**

Unmount before 3000ms and assert advancing timers does not call `onComplete`. For reduced motion, assert the same ordered stages occur within 150ms and completion fires once.

- [ ] **Step 4: Run the transition tests and confirm failure**

Run: `npm test -- --run src/features/transition/RunwayTransition.test.tsx`

Expected: FAIL on the old three-stage state machine and DOM structure.

- [ ] **Step 5: Implement the timer state machine and semantic layers**

Replace `TransitionStage` with the five approved values. In `RunwayTransition`, schedule each stage from mount, clean up every timer on unmount, guard completion with the existing ref, and render only the shape, dot, upward inline-SVG airplane, two wing guides, and page-wipe layers.

- [ ] **Step 6: Run the focused tests**

Run: `npm test -- --run src/features/transition/RunwayTransition.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the state machine**

```bash
git add src/features/transition/transitionTypes.ts src/features/transition/RunwayTransition.tsx src/features/transition/RunwayTransition.test.tsx
git commit -m "feat: add circular airplane transition stages"
```

### Task 3: Animate the Overlay Without Moving the Auth Page

**Files:**
- Modify: `src/features/transition/transition.css`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: Task 2 class names and CSS geometry variables.
- Produces: the finished visual transition and a stationary underlying `.journey-card`.

- [ ] **Step 1: Add integration regression assertions**

Extend the App transition test to submit twice and assert one overlay, paused carousel, unchanged auth/card DOM, and home mounting only at 3000ms. Assert the old `auth-panel-depart` and `carousel-depart` animation classes/keyframe behavior are no longer required by the transitioning card.

- [ ] **Step 2: Run the App test and confirm failure**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because the current test waits 3200ms and global CSS still animates both panels away.

- [ ] **Step 3: Implement collapse, dock, and symmetric stretch CSS**

Use the runtime geometry variables to place `transition-shape` over the button, shrink it to a circle, translate only on X during `dock`, and then expand from the dock point so its top and bottom simultaneously reach the measured card bounds. Move `transition-dot` to the card bottom during `stretch`.

- [ ] **Step 4: Implement airplane morph, guides, and wipe CSS**

Fade/scale the dot into the upward-facing plane during `morph`. During `flight`, accelerate the plane above the viewport, reveal the two wing-aligned guide lines, and expand `page-wipe` in the page background color behind the plane until it covers the viewport.

- [ ] **Step 5: Remove old page-depart motion and add reduced-motion styles**

Delete the auth/carousel translate, rotate, and fade keyframes from `global.css`; keep only the primary button hidden while the overlay occupies its original location. Add 150ms reduced-motion behavior that preserves final page replacement without large movement.

- [ ] **Step 6: Run transition and App tests**

Run: `npm test -- --run src/features/transition/RunwayTransition.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the finished visual transition**

```bash
git add src/features/transition/transition.css src/styles/global.css src/App.test.tsx
git commit -m "feat: animate upward airplane page wipe"
```

### Task 4: Full Verification and Visual QA

**Files:**
- Modify only if verification reveals a defect in files owned by Tasks 1–3.

**Interfaces:**
- Consumes: completed feature from Tasks 1–3.
- Produces: verified branch ready for user review.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript and production build checks**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and Vite emits `dist` assets.

- [ ] **Step 3: Inspect the running desktop demo**

At `http://127.0.0.1:5173/`, verify the shape starts at the Login button, docks exactly on the divider without vertical drift, stretches to both card edges at the same time, forms an upward plane at the bottom, and wipes the full old page without moving either panel.

- [ ] **Step 4: Inspect the mobile fallback and reduced motion**

At a viewport narrower than 880px, verify the path uses the card horizontal center. With reduced motion enabled, verify the page changes promptly without prolonged motion.

- [ ] **Step 5: Commit any verification fixes**

If fixes were needed, commit only those files with a focused message. If no fixes were needed, do not create an empty commit.

