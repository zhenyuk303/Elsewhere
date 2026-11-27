# Homepage Solid Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Homepage province-image rotation with the login page's solid `#f3f1ed` background and remove both footer captions.

**Architecture:** Delete the image-layer state and lifecycle from `HomePage` instead of hiding it, leaving a static editorial page with the existing navigation/profile interactions. Simplify the homepage stylesheet to a light canvas and dark palette while leaving the login carousel and its assets untouched.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-11-13-homepage-solid-background-design.md`

## Global Constraints

- Homepage background is exactly `#f3f1ed`; primary Homepage ink is `#171717`.
- Remove province images, rotation state, timer, crossfade, location text, and `01 / A NEW PERSPECTIVE` from Homepage code and DOM.
- Preserve the editorial layout, responsive behavior, runway handoff, navigation hooks, profile menu, and real logout flow.
- Do not alter the login/register carousel, its data, or its province assets.
- Finish and commit the in-progress navigation logout integration before starting this plan so each commit has one clear responsibility.

## Review Focus

- Network and performance: Homepage mounts no province `<img>` elements and schedules no rotation timer.
- Contrast: all navigation, editorial, divider, profile, underline, and menu states remain legible on `#f3f1ed`.
- Interaction regression: profile menu dismissal, reserved hooks, failed logout retry, and successful logout still behave identically.
- Responsive composition: removing both footer captions leaves no orphan spacing or mobile/short-landscape overflow.
- Scope isolation: the login/register carousel still renders and rotates with its existing province images.

---

## File Structure

- Modify `src/features/home/HomePage.tsx`: remove all province rotation imports, state, effects, handlers, DOM layers, and footer marker.
- Modify `src/features/home/HomePage.test.tsx`: replace rotation tests with static-background, no-timer, no-image, and no-footer assertions while retaining navigation/profile tests.
- Modify `src/features/home/home.css`: remove image/overlay/fade/location/footer rules and apply the light background/dark palette.

### Task 1: Convert Homepage to a static light canvas

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Modify: `src/features/home/home.css`

**Interfaces:**
- Consumes: `HomePage({ onLogout }: HomePageProps)` and the completed navigation/profile interactions.
- Produces: the same `HomePage` prop contract with no background-rotation lifecycle or lower-caption DOM.

- [ ] **Step 1: Write the failing static-background tests**

Replace the superseded rotation tests with tests named `renders a solid login-page background without province media` and `does not schedule background work`. Assert no `.homepage-background`, `.homepage-slide`, `.homepage-location`, Homepage `<img>`, `ANHUI, CHINA`, or `01 / A NEW PERSPECTIVE`; assert `vi.getTimerCount()` is `0`; assert computed Homepage background is `rgb(243, 241, 237)` and primary color is `rgb(23, 23, 23)`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/features/home/HomePage.test.tsx`

Expected: FAIL because the current component still mounts province layers, schedules the 10-second interval, renders both lower captions, and uses the dark background.

- [ ] **Step 3: Remove the rotation implementation and footer DOM**

Delete `travelSlides`, `HOME_ROTATION_MS`, `LayerSlot`, `placeLabel`, layer index/readiness state, the interval effect, transition handler, background section, and section marker. Preserve body scroll lock and all navigation/profile-menu state and handlers.

- [ ] **Step 4: Simplify the Homepage palette and layout CSS**

Set `.homepage` to `background: #f3f1ed` and `color: #171717`; update navigation, copy, profile border, divider, underlines, and profile menu to dark-on-light values. Remove all background layer, overlay, image filter, transition, location, section-marker, and reduced-motion rules plus obsolete responsive selectors.

- [ ] **Step 5: Run focused and full automated verification**

Run:

```bash
npm test -- --run src/features/home/HomePage.test.tsx
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Expected: all tests PASS, TypeScript and Vite exit 0, and diff check reports no errors.

- [ ] **Step 6: Inspect deterministic local screenshots**

Use a temporary, uncommitted Vite QA page and local headless Edge screenshots at desktop, 390×812 portrait, and 568×320 landscape. Verify the exact light background, dark contrast, retained menu placement, and absence of both lower captions; delete all QA files afterward.

- [ ] **Step 7: Commit**

```bash
git add src/features/home/HomePage.tsx src/features/home/HomePage.test.tsx src/features/home/home.css
git commit -m "feat: simplify homepage background"
```
