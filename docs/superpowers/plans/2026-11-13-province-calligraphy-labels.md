# Province Calligraphy Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace each carousel slide's English location and sequence number with the matching white, transparent calligraphy-and-pinyin label.

**Architecture:** A deterministic Node script invokes the installed FFmpeg CLI to split the 17 paired source images into 34 preprocessed transparent PNG assets. Carousel data owns the province-to-label mapping, while `TravelSlide` renders the asset and falls back to the existing English name only when that asset fails.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 5, Node.js, FFmpeg

**Spec:** `docs/superpowers/specs/2026-11-13-province-calligraphy-labels-design.md`

## Global Constraints

- Work only on branch `login_refine`.
- Preserve the original brush lettering and pinyin; do not redraw or use generative image editing.
- Remove the pink grid, borders, black divider, English visual label, and two-digit sequence number.
- Keep the existing carousel photos, shuffle behavior, animation timing, data attributes, and accessible English location name.
- Keep the right-side carousel counter unchanged.
- Do not add a runtime Canvas pipeline or a production dependency.

## Review Focus

- All 17 input images must be exactly `3072x4107`; the generator must fail with a clear filename if dimensions differ.
- Pair order must remain filename-first = upper panel and filename-second = lower panel; unit tests pin this mapping.
- Pale grid pixels must become transparent without erasing thin pinyin strokes; generated assets are visually sampled after generation.
- Every one of the 34 carousel entries must have one unique label asset; the data test checks count, uniqueness, and Chinese filename mapping.
- A missing or broken label asset must show the English location without exposing the removed sequence number; the component test exercises the error event.

---

### Task 1: Deterministic label asset generator

**Files:**
- Create: `scripts/generate-province-labels.mjs`
- Create: `scripts/generate-province-labels.test.mjs`
- Create: `public/images/province-labels/*.png`
- Modify: `package.json`

**Interfaces:**
- Consumes: source files from `../province/*.png`, named `<upper>_<lower>.png`.
- Produces: `parsePairName(fileName: string): [string, string]`, `buildFfmpegArgs(inputPath: string, outputPath: string, panel: "upper" | "lower"): string[]`, and 34 files named `<省份>.png` in `public/images/province-labels/`.

- [ ] **Step 1: Write the failing generator unit tests**

Use `node:test` assertions to verify `parsePairName("云南_台湾.png")` returns `["云南", "台湾"]`, invalid names throw, upper/lower crop arguments use the correct fixed panels, and output filter arguments create a white RGBA image from a luminance-derived alpha mask.

- [ ] **Step 2: Run the generator tests and verify they fail**

Run: `node --test scripts/generate-province-labels.test.mjs`

Expected: FAIL because `generate-province-labels.mjs` does not exist.

- [ ] **Step 3: Implement the generator**

Implement the exported interfaces with Node built-ins only. Validate every input with `ffprobe`; require `3072x4107`. Use fixed panel bounds `{ left: 88, width: 2896, height: 1728, upperTop: 174, lowerTop: 2110 }`. Invoke FFmpeg to convert dark lettering and pinyin into white RGB with a smooth luminance alpha ramp, making pixels at or above luma `185` transparent and pixels at or below `110` opaque. Fail when source count is not 17, output names are duplicated, FFmpeg fails, or final output count is not 34.

- [ ] **Step 4: Add the asset command**

Add `"assets:province-labels": "node scripts/generate-province-labels.mjs"` to `package.json`.

- [ ] **Step 5: Run unit tests and generate the assets**

Run: `node --test scripts/generate-province-labels.test.mjs`

Expected: PASS.

Run: `npm run assets:province-labels`

Expected: reports 17 sources and 34 generated transparent PNGs.

- [ ] **Step 6: Validate generated files**

Run a read-only PowerShell/FFprobe check that asserts 34 unique PNG filenames, non-zero sizes, RGBA pixel format, and no missing province names from `carouselData.ts`.

- [ ] **Step 7: Commit the generator and assets**

```bash
git add package.json scripts/generate-province-labels.mjs scripts/generate-province-labels.test.mjs public/images/province-labels
git commit -m "feat: generate province calligraphy labels"
```

### Task 2: Map every slide to its calligraphy asset

**Files:**
- Modify: `src/features/carousel/carouselData.ts`
- Modify: `src/features/carousel/carouselData.test.ts`

**Interfaces:**
- Consumes: `public/images/province-labels/<中文省份>.png` from Task 1.
- Produces: `TravelSlide` with `{ src: string; labelSrc: string; location: string }` for all 34 entries.

- [ ] **Step 1: Write the failing carousel data test**

Extend `loads all 34 destination images...` to assert every `labelSrc` starts with the Vite base URL plus `images/province-labels/`, all 34 label paths are unique, and representative mappings include `云南.png`, `内蒙古.png`, `香港.png`, and `澳门.png` after URL encoding.

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `npm test -- --run src/features/carousel/carouselData.test.ts`

Expected: FAIL because `labelSrc` is undefined.

- [ ] **Step 3: Implement the data mapping**

Add `labelSrc` to `TravelSlide`. Build it from each existing Chinese key with `${import.meta.env.BASE_URL}images/province-labels/${encodeURIComponent(fileName)}.png`; keep `src` and English `location` unchanged.

- [ ] **Step 4: Run the targeted test and verify it passes**

Run: `npm test -- --run src/features/carousel/carouselData.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the mapping**

```bash
git add src/features/carousel/carouselData.ts src/features/carousel/carouselData.test.ts
git commit -m "feat: map carousel slides to calligraphy labels"
```

### Task 3: Render only the calligraphy label in the lower-left corner

**Files:**
- Modify: `src/features/carousel/TravelCarousel.tsx`
- Modify: `src/features/carousel/TravelCarousel.test.tsx`
- Modify: `src/features/carousel/carousel.css`

**Interfaces:**
- Consumes: `TravelSlide.labelSrc` from Task 2.
- Produces: `.location-calligraphy` image for normal rendering and `.location-fallback` English text only after a label image error.

- [ ] **Step 1: Write failing component tests**

Replace the existing location-heading assertions with checks that the current slide renders one `.location-calligraphy` whose `src` equals `slide.labelSrc`, renders no `.location-index` and no visible English heading, and still exposes the English location through the article's `aria-label`. Add an error test that fires `error` on `.location-calligraphy` and then expects `.location-fallback` to contain the English location while `.location-index` remains absent.

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm test -- --run src/features/carousel/TravelCarousel.test.tsx`

Expected: FAIL because the component still renders `.location-index` and `<h2>`.

- [ ] **Step 3: Implement calligraphy rendering and fallback**

Track `labelError` per slide. In `.location-lockup`, render `<img className="location-calligraphy" src={slide.labelSrc} alt="" aria-hidden="true">`; on error switch to `<h2 className="location-fallback">{slide.location}</h2>`. Remove the sequence-number markup entirely.

- [ ] **Step 4: Implement responsive label styling**

Delete `.location-index` styling. Give `.location-lockup` a constrained width that stays clear of `.carousel-counter`; style `.location-calligraphy` with block layout, `max-width: 100%`, bounded height, `object-fit: contain`, and left/bottom alignment. Add a smaller width/height rule inside the existing `max-width: 880px` media query. Keep `.location-fallback` visually compatible with the former English heading.

- [ ] **Step 5: Run targeted tests and verify they pass**

Run: `npm test -- --run src/features/carousel/TravelCarousel.test.tsx src/features/carousel/carouselData.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the component change**

```bash
git add src/features/carousel/TravelCarousel.tsx src/features/carousel/TravelCarousel.test.tsx src/features/carousel/carousel.css
git commit -m "feat: show calligraphy labels on carousel"
```

### Task 4: Full verification and visual QA

**Files:**
- Modify only if verification reveals a scoped defect in files already listed above.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: verified `login_refine` branch ready for review.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test -- --run`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 2: Verify runtime behavior**

Start Vite with `npm run dev -- --config vite.config.ts --host 127.0.0.1`, open the login/signup screen, and confirm multiple carousel slides show the correct white calligraphy and pinyin with no English label or sequence number.

- [ ] **Step 3: Verify responsive behavior**

Inspect desktop and a viewport below `880px`; confirm the label stays lower-left, does not clip, and does not overlap the right-side counter.

- [ ] **Step 4: Verify fallback behavior**

Use the component test plus one deliberate local broken `labelSrc` check to confirm the English fallback appears without a sequence number; restore the valid mapping immediately after the check.

- [ ] **Step 5: Commit any verification-only correction**

If no correction was required, do not create an empty commit. Otherwise commit only the scoped correction with its matching test.
