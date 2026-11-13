# ELSEWHERE Homepage Design

## Intent

Replace the temporary post-authentication placeholder with a full-screen, front-end-only travel homepage. The page appears immediately when the existing airplane wipe transition completes and visually continues the restrained, cinematic tone of the authentication experience.

## Goals

- Match the supplied reference composition without copying unrelated content or adding new product behavior.
- Present a full-viewport documentary-style travel image with low-saturation grading and strong white editorial typography.
- Reuse all 34 existing province-level images in a deterministic order.
- Crossfade to the next image every 10 seconds; no slide, zoom, pan, or homepage entrance animation.
- Fade the bottom-right location label with the corresponding image.
- Keep the navigation, left editorial copy, divider, and lower-left marker fixed throughout rotation.
- Remain readable and balanced from narrow mobile screens through large desktop screens.
- Keep the homepage self-contained and free of backend requests.

## Non-goals

- Navigation, profile, logout, search, routing, analytics, and content management behavior.
- Province calligraphy labels from the authentication carousel.
- Randomized image order or persistence of the active image across reloads.
- Additional entrance animations after the airplane wipe.

## Visual Direction

- Full-bleed imagery with `object-fit: cover`.
- Low saturation, slightly reduced brightness, and restrained contrast to create a documentary-film atmosphere.
- A layered dark treatment: global tint plus a stronger left/bottom gradient for text legibility.
- The existing system-first sans-serif stack from `src/styles/global.css`; no new font dependency.
- White text only, with subtle alpha changes to establish hierarchy.
- Reference-inspired spacing: top navigation, editorial block in the left middle, section marker at lower left, and place label at lower right.

### Reference Composition Targets

The supplied 1640×1052 reference image establishes the desktop proportions:

- Outer horizontal inset is approximately 5% of viewport width; navigation sits approximately 7–9% from the top.
- The wordmark occupies the left edge while the navigation group begins around 63% of viewport width.
- The editorial block begins around 5% from the left and 28% from the top, and occupies roughly the left 35–38% of the viewport.
- The title is visually dominant and spans two lines, with `Explore` around twice the visual weight of `the World`.
- The divider aligns to the editorial block and reaches roughly one-third of the viewport width.
- The lower-left marker and lower-right place label share a common baseline approximately 5% above the bottom edge.
- The desktop profile treatment is a thin white circular outline approximately 68–72 px in diameter with a minimal single-line person glyph.
- The reference uses a cool charcoal-blue overall grade with a stronger translucent dark veil over the left third and a bottom vignette; red or warm accents in the source image may remain visible but subdued.

## Content and Layout

### Navigation

- Top-left wordmark: `ELSEWHERE`.
- Top-right static items in order: `Footprints`, `Guides`, `Community`, then an outlined circular profile icon.
- Use semantic elements and stable class names as future interaction hooks, but attach no click handlers and define no hover animation.

### Editorial Layer

- Kicker: `A WORLD WAITING FOR YOU`.
- Two-line heading: bold `Explore`, light `the World`.
- One horizontal divider.
- Body copy with authored line breaks:
  - `Take the road less traveled.`
  - `Collect moments, leave footprints,`
  - `and find your own elsewhere.`
- Lower-left marker: `01 / A NEW PERSPECTIVE`.
- All editorial content stays fixed while images change.

### Background and Place Label

- Reuse the 34 entries from the existing deterministic `travelSlides` order.
- Use only two mounted background layers to avoid eagerly loading the roughly 97 MB complete image set.
- The active layer is opaque; the prepared next layer is transparent.
- Every 10 seconds, swap active layers and crossfade opacity over approximately 1.2 seconds.
- After a fade completes, replace the now-hidden layer with the following image so it has almost 10 seconds to preload.
- Each layer owns its own place label, ensuring the label and image fade together.
- Format labels as uppercase `<LOCATION>, CHINA`, including multiword names such as `INNER MONGOLIA, CHINA` and `HONG KONG, CHINA`.

## Responsive Behavior

- Desktop preserves the reference composition with generous outer spacing and a large two-line title.
- Tablet reduces navigation gaps and editorial width while keeping all fixed elements visible.
- Mobile keeps the page full-screen, reduces type and padding, permits the navigation group to compress, and keeps the bottom markers clear of safe-area insets.
- The title remains two lines; the body stays left-aligned.
- If viewport height is unusually short, scale typography and vertical gaps rather than enabling document scrolling.

## Transition Integration

- Replace `HomePlaceholder` with a dedicated `HomePage` component in the existing `view === 'home'` branch.
- The homepage root has no mount animation or transition.
- The existing `RunwayTransition` remains solely responsible for revealing the page.
- Homepage image crossfading begins from the first 10-second interval after mount.
- Existing authentication/session code may continue to decide when `view` becomes `home`, but the homepage component itself receives no data and calls no backend APIs.

## Accessibility and Motion

- Treat scenic images as decorative because the visible place label supplies the relevant text.
- Give the page a meaningful main heading and navigation landmark.
- Give the profile hook an accessible label.
- Under `prefers-reduced-motion`, replace the 1.2-second fade with a near-instant opacity change while retaining the 10-second rotation cadence.

## Testing

- Component tests verify exact static navigation and editorial copy.
- Tests verify only two background layers are mounted, the first label is correct, and the active image/label advances after 10 seconds.
- Tests verify content stays mounted while the active layer changes.
- Tests verify body scroll locking is added and cleaned up.
- App integration tests continue to verify that the homepage appears only after the airplane transition completes, updated for the new heading.
- Full Vitest, typecheck, and production build verification are required.

## Approaches Considered

### Selected: two persistent crossfade layers over all 34 images

This preserves every province-level asset while loading only the visible image and its prepared successor. It provides a real opacity crossfade and keeps the place label synchronized with its image.

### Rejected: mount all 34 image layers

This would make opacity state simple, but it could eagerly load roughly 97 MB of imagery and is inappropriate for a homepage.

### Rejected: curated 6–10 image subset

This offers tighter art direction but omits much of the existing provincial collection and conflicts with the selected all-images approach.

## Builder Decisions

- The exact fade duration may be tuned between 1.0 and 1.5 seconds during visual QA.
- CSS breakpoints, font clamp values, gradients, and image focal positioning may be adjusted to match the reference at desktop and remain legible on mobile.
- Keep the existing image files unchanged; no bitmap editing or new generated assets are required.
