# Elsewhere Homepage and Airplane Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seamlessly reveal a prepared deep-indigo Elsewhere homepage through the existing airplane tail wipe, run one controlled three-image intro, and lift the final warm-gray editorial homepage into view without breaking authentication or Profile behavior.

**Architecture:** `App` owns one reducer-based screen state and every homepage phase. A successfully authenticated transition mounts one persistent `HomePage` beneath the login layer in `primed`; the existing airplane overlay wipes with the same shared indigo color, then a single reducer action swaps the visible layers and starts `gallery`. Three stable image nodes survive through `lifting` and `ready`; CSS provides motion while React exposes explicit, testable stages.

**Tech Stack:** React 19, TypeScript, CSS custom properties and keyframes, SVG, Vitest, Testing Library, Vite 8

**Spec:** `docs/superpowers/specs/2026-11-14-homepage-airplane-reveal-design.md`

## Global Constraints

- Use `#F3F1ED` for the login/final warm surface and `#233068` for the wipe/intro, with both hex values defined only in `src/styles/global.css` and referenced elsewhere through CSS variables.
- Do not use CSS Mask, the MP4, a large animation dependency, or more than three homepage images.
- Preserve the airplane's existing `collapse → dock → stretch → morph → flight` stages and 3000ms completion boundary.
- Mount `HomePage` only after successful login/signup submission; an idle login page may preload/decode only the first image.
- `App` exclusively controls `primed → gallery → lifting → ready`; mounting `HomePage` cannot start animation.
- The 3000ms transition completion is one reducer update that removes login and airplane layers and enters `gallery` (or `ready` under reduced motion).
- Preserve the same three image DOM nodes and keys from `primed` through `ready`; only opacity and transform may change.
- `primed` must combine `inert`, `aria-hidden="true"`, and `pointer-events: none`.
- Enable navigation/Profile interaction when `lifting` begins, before all decoration finishes.
- Preserve authentication, OAuth, validation, Profile, Personal homepage, keyboard navigation, logout, and current mobile login behavior.

## Review Focus

- Slow or failed image decode: the 3000ms handoff and every later phase still advance on time with indigo fallback and copy visible.
- React Strict Mode: idle preload, phase timers, and `onComplete` remain deduplicated and leave no stale callbacks after cleanup.
- Exact-boundary rendering: at 2999ms login and airplane remain above a primed home; at 3000ms only active gallery/ready home remains, with no empty intermediate layer.
- Narrow and short viewports: centered brand, Profile/logout access, stable image, and no horizontal scroll remain intact.
- Logout during/after reveal and OAuth restoration: logout resets the entry lifecycle; OAuth plays one homepage intro without inventing airplane geometry.

---

## File Structure

- Modify `index.html`: remove the duplicated hard-coded warm `theme-color` value.
- Modify `src/styles/global.css`: define shared warm/indigo variables and use the warm variable for the login-page root.
- Create `src/features/home/homeIntro.ts`: `HomePhase`, three intro records, timing constants, alt text, and cached preload/decode helpers.
- Create `src/features/home/homeIntro.test.ts`: asset order, cache deduplication, and decode-failure behavior.
- Modify `src/App.tsx`: reducer-owned screen/home phases, idle first-image preparation, transition layering, atomic airplane completion, gallery/lift timers, and logout reset.
- Modify `src/App.test.tsx`: authenticated-only pre-mount, primed locks, atomic boundary, explicit phases, stable home node, reduced motion, cleanup, OAuth, and preserved auth/logout integration.
- Modify `src/features/transition/transition.css`: replace the warm wipe token with the shared indigo variable while preserving geometry and timing.
- Modify `src/features/transition/RunwayTransition.test.tsx`: assert the shared wipe result and unchanged five-stage boundaries/single completion.
- Modify `src/features/home/HomePage.tsx`: controlled phase prop, persistent three-image DOM, intro/final markup, staged accessibility, and unchanged Profile behavior.
- Modify `src/features/home/home.css`: indigo intro, gallery switching, bottom-up warm lift, stable image layering, editorial final layout, responsive behavior, reduced motion, and overflow containment.
- Modify `src/features/home/HomePage.test.tsx`: ordered copy, persistent nodes, interaction unlocking, final content, Profile/keyboard/logout regressions, listener cleanup, and reduced motion presentation.

### Task 1: Establish shared theme tokens and cached intro assets

**Files:**
- Modify: `index.html`
- Modify: `src/styles/global.css`
- Create: `src/features/home/homeIntro.ts`
- Create: `src/features/home/homeIntro.test.ts`

**Interfaces:**
- Produces: `type HomePhase = 'primed' | 'gallery' | 'lifting' | 'ready'`.
- Produces: `HOME_GALLERY_MS = 2100`, `HOME_LIFT_MS = 850`, and `homeIntroSlides` with exactly three `{ id, src, copy, alt }` records.
- Produces: `preloadHomeImage(src: string): Promise<void>` with module-level promise deduplication and failure-safe resolution.
- Produces: CSS variables `--elsewhere-warm` and `--elsewhere-indigo`.

- [ ] **Step 1: Write failing asset/preload tests**

Add tests asserting the three copies are in the exact requested order; the manifest contains exactly three existing local travel URLs with non-empty English alt text; two calls to `preloadHomeImage()` for one URL construct/decode one `Image`; a rejected load or `decode()` resolves without throwing.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/features/home/homeIntro.test.ts`

Expected: FAIL because the manifest and cached preload helper do not exist.

- [ ] **Step 3: Implement the manifest, timing constants, and cached preload helper**

Import only three files from `src/assets/travel`. Define `HomePhase`, exact copy, meaningful alt text, and a `Map<string, Promise<void>>` cache. Set `Image.decoding = 'async'`; resolve both success and failure paths so authentication never waits on assets.

- [ ] **Step 4: Define the shared CSS variables and remove the HTML duplicate**

Add `--elsewhere-warm: #f3f1ed` and `--elsewhere-indigo: #233068` to `:root`, replace the root background literal with `var(--elsewhere-warm)`, and remove the hard-coded warm `theme-color` meta tag from `index.html`.

- [ ] **Step 5: Run focused tests and source-token verification**

Run:

```bash
npm test -- --run src/features/home/homeIntro.test.ts
rg -n "#f3f1ed|#233068" index.html src
```

Expected: test PASS; the two hex literals appear only in `src/styles/global.css`.

- [ ] **Step 6: Commit**

```bash
git add index.html src/styles/global.css src/features/home/homeIntro.ts src/features/home/homeIntro.test.ts
git commit -m "feat: define homepage intro assets"
```

### Task 2: Make App own the layered lifecycle and atomic handoff

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `HomePhase`, `HOME_GALLERY_MS`, `HOME_LIFT_MS`, `homeIntroSlides`, and `preloadHomeImage` from Task 1.
- Produces: one reducer-owned app state with `auth`, `transitioning`, and `home` modes; `transitioning` carries `homePhase: 'primed'` and immutable transition geometry.
- Produces: `HomePage({ phase, onLogout })` integration consumed by Task 4.

- [ ] **Step 1: Write failing tests for authenticated-only priming**

Assert an idle Login render contains no homepage DOM; the idle preparation calls `preloadHomeImage` only for `homeIntroSlides[0].src`; a rejected authentication still contains no homepage; successful submission renders HomePage beneath the auth layer with `data-home-phase="primed"`.

- [ ] **Step 2: Write failing tests for the exact 3000ms atomic boundary**

At 2999ms assert auth, runway, and the same primed HomePage node all exist. Advance 1ms in one `act()` and assert auth and runway are absent, the same HomePage node remains, and `data-home-phase` is `gallery`. Assert no second gallery start occurs after advancing additional transition time.

- [ ] **Step 3: Write failing tests for App-owned later phases and cleanup**

Advance `HOME_GALLERY_MS` and assert `lifting`; advance `HOME_LIFT_MS` and assert `ready`. Unmount during each phase and assert fake timer count returns to zero. Repeat with reduced motion and assert 150ms airplane completion enters `ready` directly with no gallery/lift timers.

- [ ] **Step 4: Run App tests and verify RED**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because App currently early-returns HomePage only after the airplane and has no reducer-owned phase.

- [ ] **Step 5: Implement one reducer-owned screen state**

Replace independent view/transition metadata updates with discriminated reducer actions for successful transition start, airplane completion, gallery completion, lift completion, OAuth restoration, and logout reset. The airplane-complete action returns one state that omits auth/transition layers and sets the active HomePhase in the same reducer update.

- [ ] **Step 6: Add idle first-image preparation and phase timers**

Schedule only the first manifest image during idle login time, with a cancellable `requestIdleCallback` and cancellable zero-delay fallback. In App effects, schedule gallery/lift timers from the current reducer phase and clear them in cleanup. Do not await any image promise before dispatching.

- [ ] **Step 7: Render the stable three-layer composition**

Render HomePage only in `transitioning` or `home`, outside the auth/transition conditional so its React identity is stable across airplane completion. Keep the current auth card/carousel as the middle layer and `RunwayTransition` as the top layer.

- [ ] **Step 8: Run App tests and verify GREEN**

Run: `npm test -- --run src/App.test.tsx`

Expected: all App tests PASS, including authentication, OAuth, logout, exact timing, and cleanup.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: prime homepage beneath airplane transition"
```

### Task 3: Change only the airplane wipe color contract

**Files:**
- Modify: `src/features/transition/transition.css`
- Modify: `src/features/transition/RunwayTransition.test.tsx`

**Interfaces:**
- Consumes: global `--elsewhere-indigo` from Task 1.
- Preserves: `TRANSITION_MS = 3000`, `REDUCED_TRANSITION_MS = 150`, all five `TransitionStage` boundaries, airplane SVG, guide geometry, and single-fire `onComplete`.
- Produces: `.page-wipe` whose computed fill resolves to `rgb(35, 48, 104)`.

- [ ] **Step 1: Write the failing wipe-color regression test**

Import the global CSS token in the test environment, render `RunwayTransition`, advance to `flight`, and assert `getComputedStyle(pageWipe).backgroundColor === 'rgb(35, 48, 104)'`. Retain the exact-boundary and single-completion assertions.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/features/transition/RunwayTransition.test.tsx`

Expected: FAIL because the wipe currently resolves to warm gray.

- [ ] **Step 3: Point the existing wipe at the shared indigo variable**

Remove `--page-background`; set `.page-wipe` to `background: var(--elsewhere-indigo)`. Do not alter clip-path points, z-index, easing, flight duration, reduced-motion duration, SVG, or guide transforms.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run src/features/transition/RunwayTransition.test.tsx`

Expected: all transition tests PASS with unchanged stage order and one completion callback.

- [ ] **Step 5: Commit**

```bash
git add src/features/transition/transition.css src/features/transition/RunwayTransition.test.tsx
git commit -m "feat: reveal indigo beneath airplane tail"
```

### Task 4: Build the controlled intro and final editorial homepage

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/features/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `HomePhase` and `homeIntroSlides` from Task 1.
- Consumes: `phase: HomePhase` and existing `onLogout: () => Promise<void>` from App.
- Produces: one `.homepage` root with `data-home-phase`, three persistent `.homepage-intro-image` nodes, exact intro copy, final H1/body/button/footer, and the unchanged Profile menu contract.

- [ ] **Step 1: Write failing markup and stable-node tests**

Render `phase="primed"`; assert exactly three image nodes, exact copy order, meaningful alt values, and no image recreation when rerendering through `gallery`, `lifting`, and `ready` (compare element identity). Assert the final H1 is `FIND YOUR ELSEWHERE`, body lines and `BEGIN THE JOURNEY` exist, and the final image remains the same node.

- [ ] **Step 2: Write failing accessibility and interaction-stage tests**

In `primed`, assert root `inert`, `aria-hidden="true"`, and computed `pointer-events: none`; Profile cannot be activated. In `gallery`, keep navigation interaction locked. In `lifting`, assert root is no longer inert/hidden, pointer events are enabled, and Profile opens while the reveal is still in progress.

- [ ] **Step 3: Preserve Profile, keyboard, logout, and listener tests**

Run the existing toggle, Personal homepage, outside pointer, Escape focus restoration, ArrowUp/ArrowDown loop, duplicate logout, failed logout, and body-scroll cleanup cases against `phase="ready"`. Spy on `document.addEventListener`/`removeEventListener` and assert each installed Profile listener is removed on close or unmount.

- [ ] **Step 4: Run HomePage tests and verify RED**

Run: `npm test -- --run src/features/home/HomePage.test.tsx`

Expected: FAIL because HomePage has no controlled phase, images, intro copy, final design, or staged interaction lock.

- [ ] **Step 5: Implement controlled persistent markup**

Add `phase` to `HomePageProps`; render all three intro images once from the manifest; expose phase only through class/data attributes; retain current Profile state and handlers. Apply `inert`, `aria-hidden`, and pointer lock according to phase, with interaction enabled at `lifting`.

- [ ] **Step 6: Implement the visual stack in CSS**

Use shared variables for every warm/indigo surface and indigo title. Define the image stack above the intro/reveal backgrounds, gallery copy at bottom center, warm panel transform for `lifting`, content fade after 60%, three-column navigation, slow clipped marquee behind the image, final body/button/footer, and no horizontal overflow. Never use opacity as the warm-surface reveal.

- [ ] **Step 7: Add responsive and short-landscape rules**

Use `100svh`; size the image at 34–42vw on mobile with a maximum; preserve equal nav outer columns; prevent brand/right-menu overlap; retain Profile/logout access; trim secondary copy on narrow or short screens without removing brand, H1, main button, or Profile.

- [ ] **Step 8: Add CSS reduced-motion behavior**

Disable gallery image animations and marquee movement under `prefers-reduced-motion: reduce`. Ensure `ready` has complete final content even though App skips gallery/lifting.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run: `npm test -- --run src/features/home/HomePage.test.tsx`

Expected: all HomePage tests PASS with Profile/logout behavior unchanged and no timer/listener leaks.

- [ ] **Step 10: Commit**

```bash
git add src/features/home/HomePage.tsx src/features/home/home.css src/features/home/HomePage.test.tsx
git commit -m "feat: add controlled Elsewhere homepage intro"
```

### Task 5: Integrate, verify, and visually inspect every required mode

**Files:**
- Modify if needed: tests and CSS from Tasks 1–4 only

**Interfaces:**
- Consumes: the completed App reducer, shared tokens, transition wipe, and controlled HomePage.
- Produces: a verified end-to-end login-to-home experience without new dependencies or unrelated behavior changes.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Expected: every Vitest file passes; TypeScript and Vite exit 0; diff check is silent.

- [ ] **Step 2: Verify the color source of truth**

Run: `rg -n "#f3f1ed|#233068" index.html src`

Expected: only the two declarations in `src/styles/global.css` are returned.

- [ ] **Step 3: Inspect normal-motion desktop behavior**

Verify login background stays warm; HomePage appears in DOM only after successful authentication and remains hidden/inert below it; airplane stages remain aligned; the indigo wipe begins at flight; the 3000ms handoff has no flash; copies appear in order; the third image stays stable; warm surface lifts behind it; navigation becomes usable during lift; final Profile and logout work.

- [ ] **Step 4: Inspect reduced motion**

Emulate reduced motion. Verify the existing short airplane runs, the handoff enters `ready` directly, no image sequence or marquee runs, and all final content/Profile/logout behavior remains available.

- [ ] **Step 5: Inspect responsive layouts**

Check representative desktop, mobile portrait, and short landscape viewports. Confirm exact brand centering, stable image scale, clipped marquee without horizontal scroll, available main button, and reachable Profile/Log out.

- [ ] **Step 6: Inspect failure and replay paths**

Verify failed image loads do not delay phases; logout returns to warm Login; a new successful login replays once; OAuth success plays one homepage intro without the airplane; internal Profile/menu interactions do not replay the intro.

- [ ] **Step 7: Commit any integration-only corrections**

```bash
git add src index.html
git commit -m "test: verify homepage airplane reveal"
```

Do not create this commit when no integration correction was necessary.
