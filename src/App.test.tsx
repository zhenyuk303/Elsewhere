import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens on the signup experience', () => {
    render(<App />)

    expect(screen.getByText('ELSEWHERE')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('A wonderful journey begins now.'),
    ).not.toBeInTheDocument()
  })

  it('switches only the left panel and preserves the carousel node and phase', () => {
    render(<App />)
    const carousel = screen.getByLabelText('Travel destinations')

    act(() => vi.advanceTimersByTime(2500))
    expect(carousel).toHaveAttribute('data-phase', 'hold')

    fireEvent.click(screen.getByRole('link', { name: 'Login' }))

    expect(
      screen.getByRole('heading', {
        name: 'A wonderful journey begins now.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Travel destinations')).toBe(carousel)
    expect(carousel).toHaveAttribute('data-index', '0')
    expect(carousel).toHaveAttribute('data-phase', 'hold')
  })

  it('pauses one transition and mounts the home placeholder only after it ends', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'traveler' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-path' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to all Term, Privacy Policy and Fees',
      }),
    )

    const submit = screen.getByRole('button', { name: 'Login' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(screen.getAllByTestId('runway-transition')).toHaveLength(1)
    expect(screen.getByLabelText('Travel destinations')).toHaveClass('is-paused')
    expect(screen.getByTestId('auth-journey')).toHaveClass('is-transitioning')
    expect(
      screen.queryByRole('heading', { name: 'Your journey starts here.' }),
    ).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(3200))

    expect(
      screen.getByRole('heading', { name: 'Your journey starts here.' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('runway-transition')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Travel destinations')).not.toBeInTheDocument()
  })
})
