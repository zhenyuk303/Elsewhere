# Elsewhere

A front-end-only travel authentication Demo with signup/login states, a timed destination carousel, and a liquid airplane-runway transition.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The signup page is the default route.

## Quality checks

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Project scope

- React + TypeScript + Vite
- No backend, database, or real authentication provider
- Signup and login mode changes stay entirely in the left panel
- The destination carousel uses a 2.5-second color reveal, 3-second hold, and 1.2-second horizontal slide
- Valid form submission triggers the liquid runway and airplane transition into a placeholder home view
- Reduced-motion preferences are respected

Travel image entries and location labels are defined in [`src/features/carousel/carouselData.ts`](src/features/carousel/carouselData.ts). Replace the imported local images there to update the carousel.
