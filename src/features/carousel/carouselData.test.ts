import { describe, expect, it } from 'vitest'
import { shuffleTravelSlides, travelSlides } from './carouselData'

describe('carouselData', () => {
  it('loads all 34 destination images from the supplied image collection', () => {
    expect(travelSlides).toHaveLength(34)
    expect(new Set(travelSlides.map((slide) => slide.src)).size).toBe(34)
    expect(new Set(travelSlides.map((slide) => slide.location)).size).toBe(34)
  })

  it('shuffles a complete cycle without losing or repeating a destination', () => {
    const slides = [
      { src: '/anhui.jpg', location: 'Anhui' },
      { src: '/beijing.jpg', location: 'Beijing' },
      { src: '/shanghai.jpg', location: 'Shanghai' },
    ]

    const shuffled = shuffleTravelSlides(slides, () => 0)

    expect(shuffled.map((slide) => slide.location)).toEqual([
      'Beijing',
      'Shanghai',
      'Anhui',
    ])
    expect(shuffled).toHaveLength(slides.length)
    expect(new Set(shuffled)).toEqual(new Set(slides))
    expect(slides.map((slide) => slide.location)).toEqual([
      'Anhui',
      'Beijing',
      'Shanghai',
    ])
  })
})
