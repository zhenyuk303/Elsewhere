export const mobileBreakpoint = 767
const wrap = (number: number, length: number) => ((number % length) + length) % length

export function reelStride(viewport: number) {
  return viewport <= mobileBreakpoint ? Math.max(226, viewport * .68) + 8 : viewport * .15
}

export function wheelTravel(dx: number, dy: number, mode = 0, pageHeight = 720) {
  const units = mode === 1 ? 40 : mode === 2 ? pageHeight : 1
  return -.5 * units * (Math.abs(dx) > Math.abs(dy) ? dx : dy)
}

export function photoSize(viewport: number) {
  if (viewport <= mobileBreakpoint) {
    const width = reelStride(viewport) - 8
    return { width, height: width * .98 }
  }
  return { width: viewport * .30, height: viewport * .275 }
}

export function photoGeometry(viewport: number, x: number) {
  const { width, height } = photoSize(viewport)
  if (viewport <= mobileBreakpoint) return { left: x, width, height, scale: 1 }

  // Measure each card from its bottom-left anchor. The horizontal translation
  // is scaled with the card, which produces the accelerating staircase.
  const min = viewport <= 991 ? .35 : .055
  const max = viewport <= 991 ? 1.4 : viewport <= 1440 ? 1.6 : 2.1
  const progress = Math.max(0, Math.min(1, (x + width / 2) / viewport))
  const scale = min + progress * (max - min)
  return { left: x * scale, width: width * scale, height: height * scale, scale }
}

export function highestPhotoBefore(viewport: number, rightEdge: number) {
  if (viewport <= mobileBreakpoint) return photoSize(viewport).height

  // Use the tallest card that can reach the reading column at any scroll position.
  let before = 0
  let after = viewport
  while (after - before > .5) {
    const x = (before + after) / 2
    if (photoGeometry(viewport, x).left <= rightEdge) before = x
    else after = x
  }
  return photoGeometry(viewport, after).height
}

export function reelFrame(viewport: number, count: number, position: number, openingScale = 1) {
  const stride = reelStride(viewport)
  const length = stride * count
  if (!length) return []
  const offset = wrap(position, length)
  // The desktop scaling curve leaves photos visible before x = 0.
  const center = viewport * (viewport <= mobileBreakpoint ? .5 : .25)
  const frame = Array.from({ length: count }, (_, index) => {
    const base = index * stride - offset
    const x = base + Math.round((center - base) / length) * length
    const { left, width, height, scale } = photoGeometry(viewport, x)
    return { index, x, left: left * openingScale, width: width * openingScale, height: height * openingScale, scale: scale * openingScale }
  }).filter(card => card.left < viewport && card.left + card.width > 0)
  const first = frame.find(card => Math.abs(card.x) < .01)
  return frame.filter(card => !first || card.x >= -.01 || card.left + card.width > first.width)
    .sort((a, b) => a.x - b.x)
}

export function rightmostPhotoX(viewport: number) {
  if (viewport <= mobileBreakpoint) return viewport - photoSize(viewport).width

  // The card grows as it moves right, so find the anchor using its scaled edge.
  let inside = 0
  let outside = viewport
  while (outside - inside > .001) {
    const x = (inside + outside) / 2
    const { left, width } = photoGeometry(viewport, x)
    if (left + width <= viewport) inside = x
    else outside = x
  }
  return inside
}

export function trailingPhotoOffset(viewport: number, selectedX: number) {
  const dock = rightmostPhotoX(viewport)
  const stride = reelStride(viewport)
  const proximity = Math.max(0, 1 - Math.abs(selectedX - dock) / stride)
  const nextLeftAtDock = photoGeometry(viewport, dock + stride).left
  // As the selected photo docks, slide its taller neighbor past the same edge.
  return Math.max(0, viewport - nextLeftAtDock) * proximity
}

export function reelSlideDistance(viewport: number, outgoing: { x: number }[], incoming: { x: number }[]) {
  const stride = reelStride(viewport)
  const first = Math.min(0, ...outgoing.map(card => card.x))
  const last = Math.max(0, ...incoming.map(card => card.x))
  let distance = last + stride
  // Clear the viewport in logical slots so the two sets move in one pass.
  while (outgoing.length && photoGeometry(viewport, first + distance).left < viewport) distance += stride
  return distance
}

export function shiftReelCard<Card extends { x: number; left: number }>(viewport: number, card: Card, distance: number) {
  const x = card.x + distance
  return viewport <= mobileBreakpoint
    ? { ...card, x, left: card.left + distance }
    : { ...card, x, ...photoGeometry(viewport, x) }
}
