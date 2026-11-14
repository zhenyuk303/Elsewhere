import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HOME_GALLERY_MS,
  HOME_LIFT_MS,
  homeIntroSlides,
  preloadHomeImage,
} from './homeIntro'

describe('home intro assets', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prepares a five-scene travel sequence before the page lifts', () => {
    expect(HOME_GALLERY_MS).toBe(2700)
    expect(HOME_LIFT_MS).toBe(1400)
    expect(homeIntroSlides.map((slide) => slide.id)).toEqual([
      'curiosity',
      'road',
      'city',
      'memory',
      'elsewhere',
    ])
    expect(homeIntroSlides).toHaveLength(5)
    expect(new Set(homeIntroSlides.map((slide) => slide.src))).toHaveProperty(
      'size',
      5,
    )
    expect(homeIntroSlides.every((slide) => slide.alt.trim().length > 12)).toBe(
      true,
    )
  })

  it('deduplicates image construction and decode work', async () => {
    const decode = vi.fn().mockResolvedValue(undefined)

    class MockImage {
      static instances = 0
      decoding = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor() {
        MockImage.instances += 1
      }

      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }

      decode = decode
    }

    vi.stubGlobal('Image', MockImage)

    await Promise.all([
      preloadHomeImage('/intro-dedup.jpg'),
      preloadHomeImage('/intro-dedup.jpg'),
    ])

    expect(MockImage.instances).toBe(1)
    expect(decode).toHaveBeenCalledOnce()
  })

  it('treats image loading and decode failures as non-blocking', async () => {
    class RejectingImage {
      decoding = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }

      decode = vi.fn().mockRejectedValue(new Error('decode failed'))
    }

    vi.stubGlobal('Image', RejectingImage)

    await expect(preloadHomeImage('/intro-failure.jpg')).resolves.toBeUndefined()
  })
})
