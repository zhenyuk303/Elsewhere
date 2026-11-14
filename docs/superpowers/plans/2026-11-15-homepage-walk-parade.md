# Homepage Walk Parade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add the seven selected walking cycles to the ready homepage, crossing left to right one at a time with a 5-second empty interval.

**Architecture:** Generate transparent WebP strips from the provided recording and store fixed metadata for the chosen cycles. A small decorative `WalkerParade` component owns the walking/waiting sequence. `HomePage` mounts it only for the ready phase and CSS confines it to the band between the image and copy.

**Tech Stack:** React 19, TypeScript, CSS animations, Vitest, FFmpeg, Python with Pillow and NumPy for offline asset generation.

**Spec:** `docs/superpowers/specs/2026-11-15-homepage-walk-parade-design.md`

## Global Constraints

- Include only 0–2, 2–6, 6–10, 10–14, 14–19, 19–25, and 34–42 seconds, in that order.
- Wait 5,000 ms after full exit before the next figure enters; never overlap figures.
- Keep existing homepage and authentication behavior, and retain current uncommitted navigation edits.
- No MP4 page background and no large animation library.

## Review Focus

- A sprite fails to decode: the page remains usable and the sequence skips it.
- `HomePage` leaves ready or unmounts during the wait: timers do not advance afterward.
- React Strict Mode remount: no duplicate progression or overlapping walkers.
- Short mobile and landscape viewports: the figure stays within its band and does not create horizontal scroll.
- Reduced motion: no continuously moving figure.

---

### Task 1: Reproducible sprite assets

**Files:** Create `scripts/build-walker-sprites.py`, `public/images/walkers/*.webp`, `src/features/home/walkerData.ts`, and `src/features/home/walkerData.test.ts`.

**Interfaces:** `walkerCycles` is an ordered readonly array with `id`, `src`, `frameCount`, and `cycleMs`.

- [x] Write a failing data test for exactly seven ordered cycles and excluded ranges.
- [x] Run the data test and confirm the expected failure.
- [x] Build a script that samples one pose-matched loop per interval at 15 fps, removes the cream background, retains the changing ground line, and emits seven alpha WebP strips.
- [x] Generate assets and inspect representative frames for complete limbs, consistent foot line, and clean edges.
- [x] Run the data test and verify all seven assets exist with transparent pixels.

### Task 2: Single-figure sequence

**Files:** Create `src/features/home/WalkerParade.tsx`, `src/features/home/WalkerParade.test.tsx`, and `src/features/home/walker.css`.

**Interfaces:** `<WalkerParade />` is decorative and owns the `walking → waiting → walking` sequence.

- [x] Write failing tests for one active figure, 5,000 ms empty wait, correct order and wraparound, timer cleanup, and reduced motion.
- [x] Run the component test and confirm failures are for missing behavior.
- [x] Implement the state machine, sprite frame animation, and full-width crossing with the synchronized line contained in each frame.
- [x] Run component tests and the full suite.

### Task 3: Homepage integration and visual verification

**Files:** Modify `src/features/home/HomePage.tsx`, `src/features/home/HomePage.test.tsx`, and `src/features/home/home.css`.

- [x] Write a failing test that the parade is absent before `ready` and present afterward without affecting navigation or profile actions.
- [x] Run the test and confirm expected failure.
- [x] Place the walking band below the image and above copy; adapt mobile and short landscape sizes.
- [x] Verify desktop, mobile, landscape, reduced motion, full test suite, TypeScript/build, and `git diff --check`.
