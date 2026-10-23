import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { TravelCarousel } from './TravelCarousel'
import { travelSlides } from './carouselData'

describe('TravelCarousel', () => {
  it('renders location-only travel slides and starts in grayscale reveal', () => {
    const { container } = render(<TravelCarousel paused={false} />)

    const carousel = screen.getByLabelText('Travel destinations')
    expect(carousel).toHaveAttribute('data-phase', 'reveal')
    expect(
      container.querySelector('.travel-slide--current .location-lockup h2'),
    ).toHaveTextContent(/\S+/)
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
        'rotate(8deg) scale(1)',
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
    expect(
      activeSlide?.querySelector('.location-lockup h2'),
    ).toHaveTextContent(/\S+/)
  })
})
