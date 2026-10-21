import { fireEvent, render, screen } from '@testing-library/react'
import { TravelCarousel } from './TravelCarousel'

describe('TravelCarousel', () => {
  it('renders location-only travel slides and starts in grayscale reveal', () => {
    const { container } = render(<TravelCarousel paused={false} />)

    const carousel = screen.getByLabelText('Travel destinations')
    expect(carousel).toHaveAttribute('data-phase', 'reveal')
    expect(screen.getByText('Beijing')).toBeInTheDocument()
    expect(screen.queryByText(/travel package/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/package in/i)).not.toBeInTheDocument()
    expect(container.querySelector('.travel-slide')).not.toHaveClass(
      'has-image-error',
    )
  })

  it('reveals color from the same fitted image inside the animated frame', () => {
    const { container } = render(<TravelCarousel paused={false} />)
    const activeSlide = container.querySelector('.travel-slide--current')
    const grayImage = activeSlide?.querySelector<HTMLImageElement>(
      '.travel-image--gray',
    )
    const colorImage = activeSlide?.querySelector<HTMLImageElement>(
      '.travel-image--color',
    )

    expect(colorImage).not.toBeNull()
    expect(colorImage?.src).toBe(grayImage?.src)
    expect(colorImage?.style.clipPath).toContain('travel-window-current-0')
  })

  it('keeps a neutral location card when a travel image fails to load', () => {
    const { container } = render(<TravelCarousel paused={false} />)
    const activeSlide = container.querySelector('.travel-slide--current')
    const grayImage = activeSlide?.querySelector('.travel-image--gray')

    expect(grayImage).not.toBeNull()
    fireEvent.error(grayImage!)

    expect(activeSlide).toHaveClass('has-image-error')
    expect(screen.getByText('Beijing')).toBeInTheDocument()
  })
})
