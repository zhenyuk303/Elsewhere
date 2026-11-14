# Elsewhere Homepage and Airplane Reveal Design

## Intent

Turn the existing successful-login airplane transition into a seamless reveal of a prepared Elsewhere homepage. The airplane keeps its current five-stage motion, but its tail wipe becomes the same deep indigo used by the homepage intro. After the wipe completes, a short three-image travel prelude runs, then the final warm-gray editorial homepage rises from the bottom while the central image remains stable.

The supplied `Video Project.mp4` is visual rhythm reference only. No video frame, brand, copy, navigation, instruction, subtitle, metadata instruction, or MP4 background is used in the product.

## Goals

- Keep the login-page background at `#F3F1ED`.
- Keep the current `collapse → dock → stretch → morph → flight` airplane sequence and exact 3000ms completion boundary.
- Fill the airplane tail wipe with `#233068` from 1900–3000ms.
- Pre-mount the homepage only after a login or signup submission succeeds; keep it primed beneath the login page until the airplane completes.
- Preserve the same three image DOM nodes from `primed` through `ready`.
- Run a 2.1-second three-image intro, then an 800–900ms bottom-up warm-gray reveal.
- Preserve authentication, OAuth, form validation, Profile, keyboard navigation, Personal homepage placeholder, logout, and mobile login behavior.
- Add no animation library and do not use CSS Mask.

## Non-goals

- No new router, backend endpoint, account behavior, or completed destination page.
- No video playback, extracted video asset, property copy, or third-party brand imitation.
- No loading of the full province image collection for the homepage intro.
- No rewrite of the airplane SVG or its existing five-stage geometry.

## Chosen Approach

Use three simultaneous visual layers during the airplane transition:

1. A pre-mounted `HomePage` at the bottom, with deep-indigo background and `phase="primed"`.
2. The existing login page in the middle, with warm-gray outer background.
3. The existing `RunwayTransition` on top, whose wipe polygon uses the same deep-indigo CSS variable as the homepage.

This is preferred over CSS Mask because the existing polygon wipe already follows the airplane tail geometry. Matching its fill exactly to the prepared homepage background provides a stable handoff without mask-edge aliasing, white seams, or mobile compositing risk.

## Shared Theme Colors

Define the only product copies of the two page colors in `src/styles/global.css`:

```css
:root {
  --elsewhere-warm: #f3f1ed;
  --elsewhere-indigo: #233068;
}
```

Every warm-gray or deep-indigo background, foreground, wipe, title, and reveal surface references these variables. Other source files must not repeat either hex literal. Remove the static warm-gray `theme-color` meta value from `index.html`, because HTML metadata cannot reference a CSS custom property without creating a second source of truth.

## State Ownership and Atomic Handoff

`App` owns the complete homepage phase:

```ts
export type HomePhase = 'primed' | 'gallery' | 'lifting' | 'ready'
```

The application screen state is represented as one reducer-owned value rather than independent flags. A successful form submission creates a `transitioning` state whose homepage phase is `primed`. `HomePage` receives the phase as a prop and never starts animation merely because it mounted.

At exactly 3000ms, `RunwayTransition.onComplete` dispatches one reducer action. That single update:

- removes the login layer,
- removes the airplane transition layer,
- keeps the already-mounted `HomePage` instance,
- changes its phase from `primed` to `gallery`, or directly to `ready` under reduced motion.

The component identity and image keys do not change across this update. There is therefore no intermediate render with neither the wipe nor the homepage background.

`App` also owns the gallery and lift timers. Normal motion advances `gallery → lifting` after 2100ms and `lifting → ready` after 850ms. Reduced motion skips both timers and enters `ready` when the airplane ends. Timer cleanup happens whenever the phase changes or App unmounts.

OAuth success has no local button geometry and therefore does not run the airplane. After the restored session is confirmed, it enters `gallery` once under normal motion or `ready` under reduced motion.

## Homepage Priming and Accessibility

The homepage is not mounted during an idle login page. It mounts only after `AuthPanel` has completed authentication and calls `onValidSubmit`.

While `phase="primed"`, the homepage root simultaneously has:

- the native `inert` attribute,
- `aria-hidden="true"`,
- `pointer-events: none`.

It is below the login page and cannot receive focus, pointer/touch input, or duplicate screen-reader exposure. During the image-only `gallery` phase, navigation remains non-interactive. When `lifting` begins, `App` removes the interaction lock so navigation and Profile progressively become available while the warm-gray surface rises; users do not wait for decorative animation completion.

## Image Preparation and Node Stability

Use exactly three existing local travel assets, described by a static intro manifest with copy and accurate English alt text. The first image is scheduled for `preload` and `decode()` during an idle login period. The idle callback or fallback timer is cancelled on unmount. A module-level promise cache deduplicates Strict Mode calls.

The remaining two images begin loading when the successfully authenticated transition mounts `HomePage`. Loading and decode errors are ignored for flow control: the indigo background and text continue, and authentication is never delayed.

`HomePage` renders all three `<img>` elements once with stable keys. The elements remain mounted for `primed`, `gallery`, `lifting`, and `ready`; CSS changes only their opacity and transform. The third image remains visible through the warm-gray lift and final page, so it cannot disappear, reload, or jump.

The project uses a bundled system font stack, so there is no remote font request to preload. Base CSS is already part of the Vite entry bundle.

## Visual Timeline

### Airplane: 0–3000ms

- 0–1900ms: preserve collapse, dock, stretch, and morph exactly.
- 1900–3000ms: preserve flight geometry; expand the tail wipe using `--elsewhere-indigo`.
- 3000ms: atomically remove login and transition layers and enter the homepage phase.

### Homepage intro: 0–2100ms after airplane completion

- Show three persistent images in order for about 700ms each.
- Copy order:
  1. `01 / GO WHERE CURIOSITY LEADS`
  2. `02 / COLLECT WHAT STAYS WITH YOU`
  3. `03 / FIND YOUR OWN ELSEWHERE`
- Use white/off-white copy, light vertical motion, and fades over the indigo background.
- Keep the third image visible when the intro ends.

### Final reveal: 2100–2950ms

- Move a warm-gray surface from the bottom to the top over 850ms.
- Keep the central image in a higher stacking layer and fixed in position.
- Fade the final copy and button after approximately 60% of the lift.
- Enable navigation/Profile interaction when `lifting` starts.
- End in `ready` without replaying or remounting the image.

## Final Homepage

- Three-column navigation: `Footprints` left, `ELSEWHERE` exactly centered, `Guides`, `Community`, and the existing Profile control right.
- Oversized single-line `FIND YOUR ELSEWHERE` title behind the image, clipped by the viewport and moving slowly right-to-left.
- Body copy:
  - `Follow the places that move you.`
  - `Keep the moments that stay.`
- Primary button: `BEGIN THE JOURNEY`.
- Footer credit: `ELSEWHERE · 2026`.
- Warm-gray background, indigo typography, restrained spacing, no glass surface or heavy shadow.

## Responsive and Reduced Motion

- Use `100svh`, prevent horizontal overflow, and size the central image to roughly 34–42vw with a reasonable maximum on mobile.
- Keep equal outer grid columns so the brand remains truly centered.
- Compress or hide secondary copy on narrow/short screens while retaining brand, main title, main button, Profile, and logout access.
- In short landscape, reduce spacing and preserve an operable Profile menu.
- Under `prefers-reduced-motion: reduce`, keep the existing 150ms airplane fallback, suppress gallery cycling and marquee movement, then enter `ready` immediately when the airplane completes.

## Lifecycle Guarantees

- The homepage pre-mount is gated by successful authentication.
- Its phase is controlled only by `App`.
- The airplane completion callback remains single-fire.
- App-owned timers, idle work, and HomePage document listeners are cleaned up.
- React Strict Mode cannot create duplicate phase transitions, image decodes, or completion calls.
- Logging out unmounts/reset the homepage so a later successful login may replay once.

## Verification

Tests cover shared colors, airplane wipe color, authenticated pre-mount, primed accessibility/interaction locks, atomic 3000ms handoff, explicit phase timing, stable image nodes, ordered copy, final content, reduced motion, Profile/logout behavior, cleanup, and horizontal overflow. Final verification runs Vitest, TypeScript, the Vite production build, diff checks, and desktop/mobile/short-landscape visual inspection.
