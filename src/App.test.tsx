import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { App } from './App'
import { authenticate, currentUser, logout } from './features/auth/authApi'
import {
  HOME_GALLERY_MS,
  HOME_LIFT_MS,
  homeIntroSlides,
  preloadHomeImage,
} from './features/home/homeIntro'
import { REDUCED_TRANSITION_MS } from './features/transition/RunwayTransition'
import './styles/global.css'

vi.mock('./features/auth/authApi', () => ({
  authenticate: vi.fn().mockResolvedValue({ id: 1, username: 'traveler' }),
  beginSocialLogin: vi.fn().mockResolvedValue('https://github.com/login/oauth/authorize'),
  currentUser: vi.fn().mockResolvedValue(null),
  logout: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./features/home/homeIntro', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/home/homeIntro')>()
  return {
    ...actual,
    preloadHomeImage: vi.fn().mockResolvedValue(undefined),
  }
})

const mockedAuthenticate = vi.mocked(authenticate)
const mockedCurrentUser = vi.mocked(currentUser)
const mockedLogout = vi.mocked(logout)
const mockedPreloadHomeImage = vi.mocked(preloadHomeImage)

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

function fillValidLoginForm() {
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'traveler' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret-path' },
  })
}

function switchToSignup() {
  fireEvent.click(screen.getByRole('link', { name: 'Sign up' }))
}

async function renderAuthenticatedHomepage() {
  render(<App />)
  fillValidLoginForm()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    await Promise.resolve()
  })
  act(() => vi.advanceTimersByTime(3000))
  act(() => vi.advanceTimersByTime(HOME_GALLERY_MS + HOME_LIFT_MS))
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
    mockedCurrentUser.mockResolvedValue(null)
    mockedLogout.mockResolvedValue(undefined)
    mockedAuthenticate.mockResolvedValue({ id: 1, username: 'traveler' })
    mockedPreloadHomeImage.mockResolvedValue(undefined)
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

  it('always opens on Login even when a server session could be restored', async () => {
    mockedCurrentUser.mockResolvedValueOnce({ id: 1, username: 'traveler' })
    await act(async () => {
      render(<App />)
      await Promise.resolve()
    })

    expect(screen.getByRole('link', { name: 'Elsewhere home' }).querySelector('.brand-logo')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Welcome' }),
    ).toBeInTheDocument()
    expect(mockedCurrentUser).not.toHaveBeenCalled()
    expect(
      screen.queryByText('A wonderful journey begins now.'),
    ).not.toBeInTheDocument()
    expect(document.querySelector('.homepage')).toBeNull()
  })

  it('prepares only the first homepage image while Login is idle', () => {
    render(<App />)

    expect(document.querySelector('.homepage')).toBeNull()
    expect(mockedPreloadHomeImage).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(0))

    expect(mockedPreloadHomeImage).toHaveBeenCalledOnce()
    expect(mockedPreloadHomeImage).toHaveBeenCalledWith(homeIntroSlides[0].src)
  })

  it('keeps the login layer on the shared warm background', () => {
    render(<App />)

    expect(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--elsewhere-warm')
        .trim(),
    ).toMatch(/^#[\da-f]{6}$/i)
    const appShellRule = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && rule.selectorText === '.app-shell',
      )
    expect(appShellRule?.style.background).toBe('var(--elsewhere-warm)')
  })

  it('does not mount the homepage when authentication fails', async () => {
    mockedAuthenticate.mockRejectedValueOnce(new Error('invalid credentials'))
    render(<App />)
    fillValidLoginForm()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
      await Promise.resolve()
    })

    expect(screen.getByRole('alert')).toHaveTextContent('invalid credentials')
    expect(document.querySelector('.homepage')).toBeNull()
    expect(screen.queryByTestId('runway-transition')).not.toBeInTheDocument()
  })

  it('restores the Homepage only after a successful OAuth callback', async () => {
    window.history.replaceState(null, '', '/?oauth=success')
    mockedCurrentUser.mockResolvedValueOnce({ id: 1, username: 'traveler' })

    await act(async () => {
      render(<App />)
      await Promise.resolve()
    })

    expect(mockedCurrentUser).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.homepage')).toHaveAttribute(
      'data-home-phase',
      'gallery',
    )
    expect(screen.queryByTestId('runway-transition')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('switches only the left panel and preserves the carousel node and phase', () => {
    render(<App />)
    const carousel = screen.getByLabelText('Travel destinations')

    act(() => vi.advanceTimersByTime(2500))
    expect(carousel).toHaveAttribute('data-phase', 'hold')

    switchToSignup()

    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Travel destinations')).toBe(carousel)
    expect(carousel).toHaveAttribute('data-index', '0')
    expect(carousel).toHaveAttribute('data-phase', 'hold')
  })

  it('primes one homepage beneath the paused auth view and swaps layers atomically', async () => {
    const { container } = render(<App />)

    switchToSignup()
    fillValidSignupForm()

    const submit = screen.getByRole('button', { name: 'Sign Up' })
    const card = screen.getByTestId('auth-journey')
    const authShell = screen
      .getByRole('heading', { name: 'Create your account' })
      .closest('.auth-shell') as HTMLElement
    const carousel = screen.getByLabelText('Travel destinations')
    await act(async () => { fireEvent.click(submit); fireEvent.click(submit) })

    expect(screen.getAllByTestId('runway-transition')).toHaveLength(1)
    expect(screen.getByTestId('transition-shape')).toHaveTextContent(
      /^Sign Up$/,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Login' }))
    expect(screen.getByTestId('transition-shape')).toHaveTextContent(
      /^Sign Up$/,
    )
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
    const primedHomepage = container.querySelector('.homepage') as HTMLElement
    expect(primedHomepage).toHaveAttribute('data-home-phase', 'primed')
    expect(primedHomepage).toHaveAttribute('inert')
    expect(primedHomepage).toHaveAttribute('aria-hidden', 'true')
    expect(window.getComputedStyle(primedHomepage).pointerEvents).toBe('none')

    act(() => vi.advanceTimersByTime(2999))
    expect(container.querySelector('.homepage')).toBe(primedHomepage)
    expect(primedHomepage).toHaveAttribute('data-home-phase', 'primed')
    expect(screen.getByTestId('auth-journey')).toBeInTheDocument()
    expect(screen.getByTestId('runway-transition')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1))

    expect(container.querySelector('.homepage')).toBe(primedHomepage)
    expect(primedHomepage).toHaveAttribute('data-home-phase', 'gallery')
    expect(screen.queryByTestId('auth-journey')).not.toBeInTheDocument()
    expect(screen.queryByTestId('runway-transition')).not.toBeInTheDocument()
    expect(container.querySelector('.travel-carousel')).toBeNull()

    act(() => vi.advanceTimersByTime(1))
    expect(primedHomepage).toHaveAttribute('data-home-phase', 'gallery')
  })

  it('advances the homepage phases from App-owned timers', async () => {
    const { container } = render(<App />)
    fillValidLoginForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    })

    act(() => vi.advanceTimersByTime(3000))
    const homepage = container.querySelector('.homepage') as HTMLElement
    expect(homepage).toHaveAttribute('data-home-phase', 'gallery')

    act(() => vi.advanceTimersByTime(HOME_GALLERY_MS - 1))
    expect(homepage).toHaveAttribute('data-home-phase', 'gallery')
    act(() => vi.advanceTimersByTime(1))
    expect(homepage).toHaveAttribute('data-home-phase', 'lifting')

    act(() => vi.advanceTimersByTime(850))
    expect(homepage).toHaveAttribute('data-home-phase', 'lifting')
    act(() => vi.advanceTimersByTime(HOME_LIFT_MS - 851))
    expect(homepage).toHaveAttribute('data-home-phase', 'lifting')
    act(() => vi.advanceTimersByTime(1))
    expect(homepage).toHaveAttribute('data-home-phase', 'ready')
  })

  it('cleans up App-owned idle and homepage timers on unmount', async () => {
    const { unmount } = render(<App />)
    fillValidLoginForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    })
    act(() => vi.advanceTimersByTime(3000))

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('enters the final homepage directly after the reduced-motion airplane', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    const { container } = render(<App />)
    fillValidLoginForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    })

    act(() => vi.advanceTimersByTime(REDUCED_TRANSITION_MS))

    expect(container.querySelector('.homepage')).toHaveAttribute(
      'data-home-phase',
      'ready',
    )
    expect(screen.queryByTestId('runway-transition')).not.toBeInTheDocument()
  })

  it('keeps the login label while the login transition collapses', async () => {
    render(<App />)

    fillValidLoginForm()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    })

    expect(screen.getByTestId('transition-shape')).toHaveTextContent(
      /^Login$/,
    )
  })

  it('captures the real button, divider, and card geometry for the transition', async () => {
    render(<App />)
    switchToSignup()

    const card = screen.getByTestId('auth-journey')
    const carousel = screen.getByLabelText('Travel destinations')
    const submit = screen.getByRole('button', { name: 'Sign Up' })

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
    switchToSignup()

    const card = screen.getByTestId('auth-journey')
    const submit = screen.getByRole('button', { name: 'Sign Up' })
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

  it('logs out from the profile menu and returns to Login', async () => {
    await renderAuthenticatedHomepage()

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
      await Promise.resolve()
    })

    expect(mockedLogout).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'FIND YOUR ELSEWHERE' }),
    ).not.toBeInTheDocument()
  })

  it('returns to Login when backend logout cleanup fails', async () => {
    mockedLogout.mockRejectedValueOnce(new Error('offline'))
    await renderAuthenticatedHomepage()

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
      await Promise.resolve()
    })

    expect(mockedLogout).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('heading', { name: 'Welcome' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'FIND YOUR ELSEWHERE' }),
    ).not.toBeInTheDocument()
  })

  it('keeps Login disabled until backend logout cleanup settles', async () => {
    let finishLogout: (() => void) | undefined
    mockedLogout.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishLogout = resolve }),
    )
    await renderAuthenticatedHomepage()

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))

    const login = screen.getByRole('button', { name: 'Login' })
    expect(login).toBeDisabled()

    await act(async () => finishLogout?.())
    expect(login).toBeEnabled()
  })
})
