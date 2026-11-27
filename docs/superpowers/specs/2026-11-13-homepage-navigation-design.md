# Homepage Navigation Interaction Design

## Intent

Add lightweight navigation affordances to the existing ELSEWHERE homepage without building the destination pages yet. The interactions should preserve the restrained cinematic presentation and reuse the project's existing authentication flow.

## Goals

- Show a white underline when the pointer hovers over `Footprints`, `Guides`, or `Community`.
- Keep those three items as non-navigating interaction hooks for future pages.
- Toggle a compact menu from the circular profile button with `Personal homepage` and `Log out` actions.
- Keep `Personal homepage` as a non-navigating hook.
- Make `Log out` call the existing logout API and return the user to the Login view.
- Close the menu when the profile button is clicked again, the user clicks outside it, or presses Escape.
- Preserve keyboard access, responsive layout, and the existing homepage rotation and runway transition.

## Non-goals

- No Footprints, Guides, Community, or personal homepage screens.
- No routing system or new backend endpoints.
- No hover motion beyond the requested underline.

## Approach

Use the existing React/CSS structure rather than adding a component library. Render the reserved navigation hooks as accessible buttons styled like text, with a CSS pseudo-element underline on hover and keyboard focus. Keep the profile menu state inside `HomePage`, expose the reserved actions as no-op callbacks, and pass the existing App logout handler into `HomePage` so only `Log out` changes application state.

An alternative was to introduce routes for all four reserved destinations, but that would create unfinished screens outside the requested scope. Another alternative was to make every menu entry static text, but that would not preserve useful interaction hooks or keyboard semantics.

## Error behavior

If logout fails, keep the homepage and profile menu available instead of falsely returning to Login. The menu remains usable so the user can retry.

## Verification

- Component tests cover hover/focus hooks, menu toggle and dismissal, reserved action behavior, and logout invocation.
- App integration tests verify successful logout returns to Login.
- Existing homepage timing, transition, typecheck, and production build checks remain green.
