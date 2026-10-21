import { render, screen } from '@testing-library/react'
import { TravelCarousel } from './TravelCarousel'

describe('TravelCarousel', () => {
  it('renders location-only travel slides and starts in grayscale reveal', () => {
    render(<TravelCarousel paused={false} />)

    const carousel = screen.getByLabelText('Travel destinations')
    expect(carousel).toHaveAttribute('data-phase', 'reveal')
    expect(screen.getByText('Beijing')).toBeInTheDocument()
    expect(screen.queryByText(/travel package/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/package in/i)).not.toBeInTheDocument()
  })
})
