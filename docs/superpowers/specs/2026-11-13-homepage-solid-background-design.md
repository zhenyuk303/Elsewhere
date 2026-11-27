# Homepage Solid Background Design

## Intent

Replace the province-image homepage with the same quiet light background used around the login experience, while preserving the established editorial layout and the new navigation interactions.

## Goals

- Use the exact login page background color `#f3f1ed` across the full Homepage viewport.
- Remove all province images, preload layers, location labels, rotation state, timers, and fade transitions from Homepage.
- Remove both lower captions: `01 / A NEW PERSPECTIVE` and the province location text.
- Change Homepage navigation, editorial copy, divider, profile icon, underline, and menu styling to a readable `#171717`-based dark palette.
- Preserve the existing layout, responsive behavior, runway handoff, navigation hooks, profile menu, and real logout flow.

## Non-goals

- No replacement photography, texture, gradient, animation, or new footer copy.
- No changes to the login/register carousel or its province assets.
- No new destination or personal-homepage screens.

## Approach

Selected: remove the rotation implementation and its DOM entirely, then simplify `home.css` around a solid `#f3f1ed` canvas. This avoids loading unused images and removes dead timer logic.

Rejected: covering the existing image layers with an opaque background. Although easier to reverse, it would still download province images and run an invisible timer, contradicting the request to remove them completely.

## Visual treatment

The page remains full-screen and compositionally unchanged above the removed footer labels. Primary text and icons use `#171717`; secondary strokes and dividers use translucent dark values. The profile menu uses a light translucent surface with dark text so it remains legible against the light canvas.

## Verification

- Homepage tests assert there are no background image layers, location labels, timer, or lower captions.
- Existing navigation-menu and logout integration tests remain green.
- Desktop, portrait mobile, and short-landscape layouts are visually checked for contrast and spacing.
