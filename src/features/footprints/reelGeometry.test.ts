import { highestPhotoBefore, photoGeometry, reelFrame, rightmostPhotoX, wheelTravel } from './reelGeometry'

it('reproduces the reference staircase proportions at a 1280px viewport', () => {
  const floors = Array.from({ length: 5 }, (_, i) => photoGeometry(1280, i * 192))
  expect(floors.map(card => Math.round(card.left))).toEqual([0, 100, 288, 566, 932])
  expect(floors.map(card => Math.round(card.height))).toEqual([101, 183, 264, 346, 427])
  expect(floors[4].left + floors[4].width).toBeGreaterThan(1280)
})

it('docks the selected photo inside the right edge at each viewport size', () => {
  for (const viewport of [390, 767, 768, 991, 992, 1280, 1440, 1441, 1920]) {
    const { left, width } = photoGeometry(viewport, rightmostPhotoX(viewport))
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + width).toBeLessThanOrEqual(viewport)
    expect(left + width).toBeCloseTo(viewport, 2)
  }
})

it('moves according to wheel distance instead of snapping to a slot', () => {
  expect(wheelTravel(4, 120)).toBe(-60)
  expect(wheelTravel(-25, 9)).toBe(12.5)
  expect(wheelTravel(0, 3, 1)).toBe(wheelTravel(0, 120))
  const a = reelFrame(1280, 34, 0)
  const b = reelFrame(1280, 34, -60)
  expect(a.find(card => card.index === 0)?.left).toBe(0)
  expect(b.find(card => card.index === 0)?.left).toBeCloseTo(21.55, 1)
  expect(b).toEqual(reelFrame(1280, 34, -60 + 34 * 192))
})

it('keeps the entering photo visible at the left edge of a short loop', () => {
  const frame = reelFrame(1280, 8, -51.2)
  expect(frame.some(card => card.left < 0 && card.left + card.width > 0)).toBe(true)
})

it('reserves space for the photo details throughout a reel rotation', () => {
  const readingEdge = 510
  for (const viewport of [390, 900, 1335, 1920]) {
    const highest = highestPhotoBefore(viewport, readingEdge)
    for (let x = -viewport; x <= viewport; x += 2) {
      const card = photoGeometry(viewport, x)
      if (card.left <= readingEdge && card.left + card.width >= 0) {
        expect(card.height).toBeLessThanOrEqual(highest)
      }
    }
  }
})

it('preserves the paint order when the left edges of overlapping photos cross', () => {
  const leadingSlots = (position: number) => reelFrame(1280, 34, position).slice(0, 2).map(card => card.index)
  expect(leadingSlots(74)).toEqual([33, 0])
  expect(leadingSlots(80)).toEqual(leadingSlots(74))
})
