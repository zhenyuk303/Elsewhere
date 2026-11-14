# Homepage Walk Parade Design

The ready homepage shows one walking figure at a time in the open band below the central photo and above the final copy. The figure enters from beyond the left edge, crosses the full viewport, and exits beyond the right edge. The band stays empty for 5 seconds after exit before the next style starts. The sequence repeats in the user's order.

Use one seamless gait cycle from each of these source recording intervals: 0–2, 2–6, 6–10, 10–14, 14–19, 19–25, and 34–42 seconds. Exclude 25–34 seconds. Preserve the recorded black and outlined figure and its changing ground line while removing the cream recording background. The line stays synchronized with the feet and changes length with the source frames. Use extracted transparent frame strips, not the MP4 as a page background. Keep the existing homepage, navigation, intro, authentication, and profile behavior.

The parade starts only in the `ready` phase. It is decorative, hidden from assistive technology, and does not intercept input. One sprite node displays the active style. Leaving the page cleans up the 5-second wait. Reduced motion omits the moving figure. The figure scales to the available band on mobile and short landscape screens without horizontal scrolling or covering the copy or profile menu.

## Approach

Preprocess the user-supplied recording into seven transparent WebP sprite strips. Each strip contains one pose-matched loop, sampled at 15 fps. A React state machine advances only after the CSS crossing animation completes and a 5-second timer expires. CSS moves the sprite across the viewport; a stepped strip animation cycles the gait. This keeps page assets small, preserves the supplied motion, and avoids a continuously decoded video.
