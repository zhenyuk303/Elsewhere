import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the fixed navigation and editorial content', () => {
    render(<HomePage />)

    const navigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    })
    expect(within(navigation).getByText('ELSEWHERE')).toBeInTheDocument()
    expect(within(navigation).getByText('Footprints')).toBeInTheDocument()
    expect(within(navigation).getByText('Guides')).toBeInTheDocument()
    expect(within(navigation).getByText('Community')).toBeInTheDocument()
    expect(
      screen.getByText('A WORLD WAITING FOR YOU'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Explore the World' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Take the road less traveled.')).toBeInTheDocument()
    expect(
      screen.getByText('Collect moments, leave footprints,'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('and find your own elsewhere.'),
    ).toBeInTheDocument()
    expect(screen.getByText('01 / A NEW PERSPECTIVE')).toBeInTheDocument()
  })

  it('mounts only the current and prepared background layers', () => {
    const { container } = render(<HomePage />)

    const layers = container.querySelectorAll('.homepage-slide')
    expect(layers).toHaveLength(2)
    expect(container.querySelectorAll('.homepage-slide.is-active')).toHaveLength(1)
    expect(
      container.querySelector('.homepage-slide.is-active .homepage-location'),
    ).toHaveTextContent('ANHUI, CHINA')
  })

  it('keeps profile and navigation hooks static', () => {
    render(<HomePage />)

    expect(screen.getByRole('button', { name: 'User profile' })).toHaveAttribute(
      'type',
      'button',
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('crossfades to the prepared slide at exact ten-second boundaries', () => {
    const { container } = render(<HomePage />)

    act(() => vi.advanceTimersByTime(9_999))
    expect(
      container.querySelector('.homepage-slide.is-active .homepage-location'),
    ).toHaveTextContent('ANHUI, CHINA')

    act(() => vi.advanceTimersByTime(1))
    const secondLayer = container.querySelector('.homepage-slide.is-active')
    expect(secondLayer?.querySelector('.homepage-location')).toHaveTextContent(
      'MACAU, CHINA',
    )

    fireEvent.transitionEnd(secondLayer!, { propertyName: 'opacity' })
    expect(
      container.querySelector(
        '.homepage-slide:not(.is-active) .homepage-location',
      ),
    ).toHaveTextContent('BEIJING, CHINA')

    act(() => vi.advanceTimersByTime(10_000))
    expect(
      container.querySelector('.homepage-slide.is-active .homepage-location'),
    ).toHaveTextContent('BEIJING, CHINA')
  })

  it('keeps the editorial layer mounted while the background rotates', () => {
    const { container } = render(<HomePage />)
    const editorial = container.querySelector('.homepage-copy')

    act(() => vi.advanceTimersByTime(10_000))

    expect(container.querySelector('.homepage-copy')).toBe(editorial)
  })

  it('clears its rotation timer when it unmounts', () => {
    const { unmount } = render(<HomePage />)

    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
