import { describe, expect, it } from 'vitest'
import { shuffleTravelSlides, travelSlides } from './carouselData'

describe('carouselData', () => {
  it('loads all 34 destination images from the supplied image collection', () => {
    expect(travelSlides).toHaveLength(34)
    expect(new Set(travelSlides.map((slide) => slide.src)).size).toBe(34)
    expect(
      travelSlides.every((slide) =>
        slide.src.startsWith('/images/carousel/') && slide.src.endsWith('.webp'),
      ),
    ).toBe(true)
    expect(
      travelSlides.every((slide) =>
        slide.labelSrc.startsWith('/images/province-labels/'),
      ),
    ).toBe(true)
    expect(new Set(travelSlides.map((slide) => slide.labelSrc)).size).toBe(34)
    expect(new Set(travelSlides.map((slide) => slide.location)).size).toBe(34)

    expect(
      Object.fromEntries(
        travelSlides
          .filter((slide) =>
            ['Yunnan', 'Inner Mongolia', 'Hong Kong', 'Macau'].includes(
              slide.location,
            ),
          )
          .map((slide) => [slide.location, slide.labelSrc]),
      ),
    ).toEqual({
      Yunnan: '/images/province-labels/%E4%BA%91%E5%8D%97.png',
      'Inner Mongolia':
        '/images/province-labels/%E5%86%85%E8%92%99%E5%8F%A4.png',
      'Hong Kong': '/images/province-labels/%E9%A6%99%E6%B8%AF.png',
      Macau: '/images/province-labels/%E6%BE%B3%E9%97%A8.png',
    })
  })

  it('shuffles a complete cycle without losing or repeating a destination', () => {
    const slides = [
      {
        src: '/anhui.jpg',
        labelSrc: '/province-labels/anhui.png',
        location: 'Anhui',
      },
      {
        src: '/beijing.jpg',
        labelSrc: '/province-labels/beijing.png',
        location: 'Beijing',
      },
      {
        src: '/shanghai.jpg',
        labelSrc: '/province-labels/shanghai.png',
        location: 'Shanghai',
      },
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
