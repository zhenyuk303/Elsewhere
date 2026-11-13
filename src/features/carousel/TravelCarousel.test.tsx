import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { TravelCarousel } from './TravelCarousel'
import { travelSlides } from './carouselData'

describe('TravelCarousel', () => {
  it('renders location-only travel slides and starts in grayscale reveal', () => {
    const { container } = render(<TravelCarousel paused={false} />)

    const carousel = screen.getByLabelText('Travel destinations')
    const activeSlide = container.querySelector('.travel-slide--current')
    const location = activeSlide?.getAttribute('aria-label')
    const expectedSlide = travelSlides.find(
      (slide) => slide.location === location,
    )
    const calligraphy = activeSlide?.querySelector('.location-calligraphy')

    expect(carousel).toHaveAttribute('data-phase', 'reveal')
    expect(expectedSlide).toBeDefined()
    expect(calligraphy).toHaveAttribute('src', expectedSlide?.labelSrc)
    expect(activeSlide).toHaveAttribute('aria-label', expectedSlide?.location)
    expect(activeSlide?.querySelector('.location-index')).toBeNull()
    expect(activeSlide?.querySelector('.location-fallback')).toBeNull()
    expect(screen.queryByText(/travel package/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/package in/i)).not.toBeInTheDocument()
    expect(container.querySelector('.travel-slide')).not.toHaveClass(
      'has-image-error',
    )
  })

  it('starts from a shuffled destination order and reports the full collection', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    try {
      render(<TravelCarousel paused={false} />)

      const carousel = screen.getByLabelText('Travel destinations')
      expect(carousel).toHaveAttribute('data-slide-count', '34')
      expect(carousel).toHaveAttribute(
        'data-location',
        travelSlides[1].location,
      )
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('keeps the calligraphy in the lower-left safe area outside the color window', () => {
    const { container } = render(<TravelCarousel paused={false} />)
    const lockup = container.querySelector(
      '.travel-slide--current .location-lockup',
    )
    const style = window.getComputedStyle(lockup!)
    const widthPercent = Number.parseFloat(
      style.width.match(/min\(([\d.]+)%/)?.[1] ?? 'NaN',
    )
    const occupiedBottomPercent =
      Number.parseFloat(style.bottom) + Number.parseFloat(style.height)

    expect(widthPercent).toBeLessThanOrEqual(34)
    expect(Number.parseFloat(style.bottom)).toBeGreaterThanOrEqual(2)
    expect(occupiedBottomPercent).toBeLessThanOrEqual(15)
  })

  it('shrinks the rotated color window away from the label on wide layouts', () => {
    let resizeCallback: ResizeObserverCallback | undefined
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    try {
      const { container } = render(<TravelCarousel paused={false} />)
      const carousel = screen.getByLabelText('Travel destinations')

      expect(resizeCallback).toBeDefined()
      act(() => {
        resizeCallback?.(
          [
            {
              contentRect: { width: 880, height: 360 },
            } as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        )
      })

      const windowScale = Number.parseFloat(
        carousel.style.getPropertyValue('--color-window-scale'),
      )
      const label = container.querySelector('.location-lockup')
      const labelStyle = window.getComputedStyle(label!)
      const labelRight =
        Number.parseFloat(labelStyle.left) +
        Math.min(880 * 0.34, 180)
      const labelTop =
        360 *
        (1 -
          (Number.parseFloat(labelStyle.bottom) +
            Number.parseFloat(labelStyle.height)) /
            100)
      const radians = (8 * Math.PI) / 180
      const svgScale = 880 / 1000
      const svgTop = (360 - 880) / 2
      const labelRightInViewBox = labelRight / svgScale
      const rotatedSquareBottomInViewBox =
        500 +
        Math.tan(radians) * (labelRightInViewBox - 500) +
        (350 * windowScale) / Math.cos(radians)
      const rotatedSquareBottom =
        svgTop + rotatedSquareBottomInViewBox * svgScale

      expect(rotatedSquareBottom).toBeLessThan(labelTop)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps the gray image, color reveal, and frame in one coordinate system', () => {
    const { container } = render(<TravelCarousel paused={false} />)
    const activeSlide = container.querySelector('.travel-slide--current')
    const visual = activeSlide?.querySelector('svg.travel-visual')
    const grayImage = visual?.querySelector('.travel-image--gray')
    const colorImage = visual?.querySelector('.travel-image--color')
    const shape = visual?.querySelector('.color-window__shape')
    const border = visual?.querySelector('.color-window__border')

    expect(visual).not.toBeNull()
    expect(grayImage?.getAttribute('href')).toBe(
      colorImage?.getAttribute('href'),
    )
    expect(colorImage).not.toBeNull()
    expect(colorImage?.getAttribute('clip-path')).toContain(
      'travel-window-current-0',
    )
    for (const attribute of ['x', 'y', 'width', 'height', 'rx']) {
      expect(shape?.getAttribute(attribute)).toBe(
        border?.getAttribute(attribute),
      )
    }
  })

  it('finishes the reveal with a clockwise square rotation', () => {
    vi.useFakeTimers()

    try {
      const { container } = render(<TravelCarousel paused={false} />)

      act(() => {
        vi.advanceTimersByTime(2500)
      })

      const carousel = screen.getByLabelText('Travel destinations')
      const shape = container.querySelector(
        '.color-window--hold .color-window__shape',
      )

      expect(carousel).toHaveAttribute('data-phase', 'hold')
      expect(shape).not.toBeNull()
      expect(window.getComputedStyle(shape!).transform).toBe(
        'rotate(8deg) scale(var(--color-window-scale, 1))',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a neutral location card when a travel image fails to load', () => {
    const { container } = render(<TravelCarousel paused={false} />)
    const activeSlide = container.querySelector('.travel-slide--current')
    const grayImage = activeSlide?.querySelector('.travel-image--gray')

    expect(grayImage).not.toBeNull()
    fireEvent.error(grayImage!)

    expect(activeSlide).toHaveClass('has-image-error')
    expect(activeSlide?.querySelector('.location-calligraphy')).not.toBeNull()
  })

  it('falls back to the English location only when a calligraphy label fails', () => {
    const { container } = render(<TravelCarousel paused={false} />)
    const activeSlide = container.querySelector('.travel-slide--current')
    const calligraphy = activeSlide?.querySelector('.location-calligraphy')
    const location = activeSlide?.getAttribute('aria-label')

    expect(calligraphy).not.toBeNull()
    fireEvent.error(calligraphy!)

    expect(activeSlide?.querySelector('.location-calligraphy')).toBeNull()
    expect(activeSlide?.querySelector('.location-fallback')).toHaveTextContent(
      location!,
    )
    expect(activeSlide?.querySelector('.location-index')).toBeNull()
  })
})
