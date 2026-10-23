import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { App } from './App'

vi.mock('./features/auth/authApi', () => ({
  authenticate: vi.fn().mockResolvedValue({ id: 1, username: 'traveler' }),
  currentUser: vi.fn().mockResolvedValue(null),
  logout: vi.fn().mockResolvedValue(undefined),
}))

function rect({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}

function fillValidSignupForm() {
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
}

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
      screen.getByRole('heading', { name: 'Welcome' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Travel destinations')).toBe(carousel)
    expect(carousel).toHaveAttribute('data-index', '0')
    expect(carousel).toHaveAttribute('data-phase', 'hold')
  })

  it('pauses one transition and mounts the home placeholder only after it ends', async () => {
    render(<App />)

    fillValidSignupForm()

    const submit = screen.getByRole('button', { name: 'Create account' })
    const card = screen.getByTestId('auth-journey')
    const authShell = screen
      .getByRole('heading', { name: 'Create your account' })
      .closest('.auth-shell') as HTMLElement
    const carousel = screen.getByLabelText('Travel destinations')
    await act(async () => { fireEvent.click(submit); fireEvent.click(submit) })

    expect(screen.getAllByTestId('runway-transition')).toHaveLength(1)
    expect(carousel).toHaveClass('is-paused')
    expect(card).toHaveClass('is-transitioning')
    expect(card).toBeInTheDocument()
    expect(authShell).toBeInTheDocument()
    expect(window.getComputedStyle(authShell).animationName).toBe('none')
    expect(window.getComputedStyle(carousel).animationName).toBe('none')
    const transitionShape = screen.getByTestId('transition-shape')
    expect(window.getComputedStyle(transitionShape).position).toBe('absolute')
    expect(window.getComputedStyle(transitionShape).backgroundColor).toBe(
      'rgb(23, 23, 23)',
    )
    expect(
      screen.queryByRole('heading', { name: 'Your journey starts here.' }),
    ).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(2999))
    expect(
      screen.queryByRole('heading', { name: 'Your journey starts here.' }),
    ).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))

    expect(
      screen.getByRole('heading', { name: 'Your journey starts here.' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('runway-transition')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Travel destinations')).not.toBeInTheDocument()
  })

  it('captures the real button, divider, and card geometry for the transition', async () => {
    render(<App />)

    const card = screen.getByTestId('auth-journey')
    const carousel = screen.getByLabelText('Travel destinations')
    const submit = screen.getByRole('button', { name: 'Create account' })

    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 40, top: 28, width: 1180, height: 760 }),
    )
    vi.spyOn(carousel, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 548, top: 28, width: 672, height: 760 }),
    )
    vi.spyOn(submit, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 128, top: 524, width: 332, height: 52 }),
    )

    fillValidSignupForm()
    await act(async () => { fireEvent.click(submit) })

    expect(screen.getByTestId('runway-transition')).toHaveStyle({
      '--origin-left': '128px',
      '--origin-top': '524px',
      '--origin-width': '332px',
      '--origin-height': '52px',
      '--divider-x': '548px',
      '--card-top': '28px',
      '--card-height': '760px',
    })
  })

  it('uses the card horizontal center as the transition axis on stacked layouts', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 880px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    render(<App />)

    const card = screen.getByTestId('auth-journey')
    const submit = screen.getByRole('button', { name: 'Create account' })
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 12, top: 0, width: 360, height: 720 }),
    )
    vi.spyOn(submit, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 32, top: 420, width: 320, height: 52 }),
    )

    fillValidSignupForm()
    await act(async () => { fireEvent.click(submit) })

    expect(screen.getByTestId('runway-transition')).toHaveStyle({
      '--divider-x': '192px',
      '--card-top': '0px',
      '--card-height': '720px',
    })
  })
})
