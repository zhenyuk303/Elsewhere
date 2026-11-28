import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { App } from './App'
import { authenticate, currentUser, logout } from './features/auth/authApi'
import {
  FOOTPRINTS_TO_GUIDES_EXIT_MS,
  HOME_FOOTPRINTS_EXIT_MS,
  HOME_GALLERY_MS,
  HOME_LIFT_MS,
  homeIntroSlides,
  preloadHomeImage,
} from './features/home/homeIntro'
import { REDUCED_TRANSITION_MS } from './features/transition/RunwayTransition'
import './styles/global.css'

vi.mock('./features/footprints/footprintsApi', async () => {
  const { createDemoRepository } = await import('./features/footprints/footprintsData')
  return { serverFootprints: createDemoRepository() }
})

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
    target: { value: 'Fixture1!' },
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

async function openFootprintsFromHome() {
  fireEvent.click(screen.getByRole('button', { name: 'Footprints' }))
  await act(async () => { vi.advanceTimersByTime(HOME_FOOTPRINTS_EXIT_MS) })
  await act(async () => { vi.advanceTimersByTime(1800) })
}

function selectFootprintFilter(filter: 'Province' | 'Theme', option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: filter }))
  fireEvent.click(screen.getByRole('option', { name: option }))
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

    act(() => vi.advanceTimersByTime(1200))
    expect(homepage).toHaveAttribute('data-home-phase', 'lifting')
    expect(homepage.querySelector('.walker-lane')).toBeNull()
    act(() => vi.advanceTimersByTime(HOME_LIFT_MS - 1201))
    expect(homepage).toHaveAttribute('data-home-phase', 'lifting')
    act(() => vi.advanceTimersByTime(1))
    expect(homepage).toHaveAttribute('data-home-phase', 'ready')
    expect(homepage.querySelector('.walker-lane')).toBeInTheDocument()
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

  it('opens Footprints after one Home exit and preserves the shared navigation', async () => {
    await renderAuthenticatedHomepage()
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    const profile = screen.getByRole('button', { name: 'User profile' })
    const footprints = screen.getByRole('button', { name: 'Footprints' })
    const home = screen.getByRole('button', { name: 'Elsewhere home' })

    fireEvent.click(footprints)
    expect(navigation.closest('main')).toHaveAttribute('data-footprints-transition', 'leaving')
    expect(document.querySelector('.footprints')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elsewhere home' })).toBe(home)

    const halfway = HOME_FOOTPRINTS_EXIT_MS / 2
    act(() => vi.advanceTimersByTime(halfway))
    fireEvent.click(footprints)
    act(() => vi.advanceTimersByTime(halfway - 1))
    expect(document.querySelector('.footprints')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1) })

    const opening = screen.getByRole('heading', { name: 'Footprints' }).closest('.footprints')
    expect(opening).toHaveAttribute('data-opening', 'true')
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBe(navigation)
    expect(screen.getByRole('button', { name: 'User profile' })).toBe(profile)

    await act(async () => { vi.advanceTimersByTime(1800) })
    expect(opening).not.toHaveAttribute('data-opening', 'true')
    expect(screen.getByRole('combobox', { name: 'Province' })).toBeInTheDocument()
    expect(screen.queryByText(/demo collection|elsewhere \/ footprints/i)).not.toBeInTheDocument()
    fireEvent.click(home)
    expect(screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' })).toBeInTheDocument()
  })

  it('opens the latest requested page and preserves navigation between Guides and Footprints', async () => {
    await renderAuthenticatedHomepage()
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    const guides = screen.getByRole('button', { name: 'Guides' })
    fireEvent.click(screen.getByRole('button', { name: 'Footprints' }))
    act(() => vi.advanceTimersByTime(HOME_FOOTPRINTS_EXIT_MS / 2))
    fireEvent.click(guides)
    await act(async () => { vi.advanceTimersByTime(HOME_FOOTPRINTS_EXIT_MS) })

    expect(guides).toHaveAttribute('aria-current', 'page')
    expect(navigation.closest('main')).toHaveAttribute('aria-labelledby', 'guides-title')
    expect(document.getElementById('guides-title')).toBeInTheDocument()
    expect(document.body).not.toHaveClass('home-view')
    expect(screen.queryByLabelText('Province')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBe(navigation)

    const footprints = screen.getByRole('button', { name: 'Footprints' })
    await act(async () => { fireEvent.click(footprints) })
    expect(screen.getByRole('combobox', { name: 'Province' })).toBeInTheDocument()
    expect(guides).not.toHaveAttribute('aria-current')
    const outgoing = document.querySelector('.footprints')

    fireEvent.click(guides)
    expect(outgoing).toBeInTheDocument()
    expect(document.getElementById('guides-title')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(FOOTPRINTS_TO_GUIDES_EXIT_MS / 2))
    fireEvent.click(footprints)
    await act(async () => { vi.advanceTimersByTime(FOOTPRINTS_TO_GUIDES_EXIT_MS) })
    expect(outgoing).toBeInTheDocument()
    expect(footprints).toHaveAttribute('aria-current', 'page')

    fireEvent.click(guides)
    act(() => vi.advanceTimersByTime(FOOTPRINTS_TO_GUIDES_EXIT_MS - 1))
    expect(outgoing).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(outgoing).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBe(navigation)
    expect(document.getElementById('guides-title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Elsewhere home' }))
    expect(screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' })).toBeInTheDocument()
    expect(guides).toHaveFocus()
  })

  it('cancels the pending Footprints opening when returning Home during the exit', async () => {
    await renderAuthenticatedHomepage()
    const home = screen.getByRole('button', { name: 'Elsewhere home' })
    fireEvent.click(screen.getByRole('button', { name: 'Footprints' }))
    act(() => vi.advanceTimersByTime(HOME_FOOTPRINTS_EXIT_MS / 2))
    fireEvent.click(home)
    await act(async () => { vi.advanceTimersByTime(HOME_FOOTPRINTS_EXIT_MS + 1800) })

    expect(screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' })).toBeInTheDocument()
    expect(document.querySelector('.footprints')).not.toBeInTheDocument()
    expect(home.closest('main')).not.toHaveAttribute('data-footprints-transition', 'leaving')
  })

  it('changes pages immediately when reduced motion is requested', async () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      ...media,
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
    }))
    await renderAuthenticatedHomepage()
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Footprints' })) })

    const footprints = screen.getByRole('heading', { name: 'Footprints' }).closest('.footprints')
    expect(footprints).not.toHaveAttribute('data-opening', 'true')
    expect(navigation.closest('main')).not.toHaveAttribute('data-footprints-transition', 'leaving')
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBe(navigation)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guides' })) })
    expect(footprints).not.toBeInTheDocument()
    expect(document.getElementById('guides-title')).toBeInTheDocument()
  })

  it('settles on the last gallery click and keeps missing info tied to the lead photo', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    const [first, latest] = screen.getAllByRole('button', { name: /^View photo from / })
    const province = latest.getAttribute('aria-label')!.replace('View photo from ', '')
    fireEvent.click(first, { detail: 1 })
    act(() => vi.advanceTimersByTime(80))
    fireEvent.click(latest, { detail: 1 })
    act(() => vi.advanceTimersByTime(2800))
    expect(screen.getByRole('heading', { name: province })).toBeInTheDocument()
    const selectedName = `View photo from ${province}`
    expect(screen.getByRole('button', { name: selectedName, pressed: true })).toBeInTheDocument()
    const galleryPhotos = screen.getAllByRole('button', { name: /^View photo from / })
    expect(galleryPhotos.some(button => button.getAttribute('aria-label') !== selectedName)).toBe(true)
    expect(screen.getByText('City to be added')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    selectFootprintFilter('Theme', 'Coast')
    act(() => vi.advanceTimersByTime(2800))
    expect(screen.getByRole('heading', { name: 'Footprints' })).toBeInTheDocument()
    expect(screen.getByText('No footprints match these filters.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^View photo from / })).not.toBeInTheDocument()
  })

  it('shows the selected province brush title immediately and keeps it when the theme changes', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    selectFootprintFilter('Province', 'Beijing')
    expect(screen.getByRole('heading', { name: 'Beijing' }).querySelector('img')).toHaveAttribute(
      'src', '/images/province-labels/%E5%8C%97%E4%BA%AC.png',
    )
    expect(screen.queryByText('City to be added')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(80))
    selectFootprintFilter('Province', 'Inner Mongolia')
    const heading = screen.getByRole('heading', { name: 'Inner Mongolia' })
    expect(heading.querySelector('img')).toHaveAttribute(
      'src', '/images/province-labels/%E5%86%85%E8%92%99%E5%8F%A4.png',
    )
    selectFootprintFilter('Theme', 'Coast')
    expect(screen.getByRole('heading', { name: 'Inner Mongolia' })).toBe(heading)
    act(() => vi.advanceTimersByTime(2800))
    expect(screen.getByRole('heading', { name: 'Inner Mongolia' }).querySelector('img')).toHaveAttribute(
      'src', '/images/province-labels/%E5%86%85%E8%92%99%E5%8F%A4.png',
    )
    expect(screen.getByText('No footprints match these filters.')).toBeInTheDocument()
    expect(screen.queryByText('City to be added')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    selectFootprintFilter('Province', 'All provinces')
    const introduction = screen.getByRole('heading', { name: 'Footprints' })
    expect(introduction).toHaveTextContent('Journal')
    expect(introduction.querySelector('img')).toBeNull()
  })

  it('moves the clicked photo with its neighbor on the reel into the rightmost lead slot', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    const region = screen.getByRole('region', { name: 'Photo composition' })
    const [neighbor, selected] = screen.getAllByRole<HTMLButtonElement>('button', { name: /^View photo from / })
    const selectedName = selected.getAttribute('aria-label')!
    const { left, width } = selected.style
    const baseWidth = window.innerWidth * .30
    const logicalX = (button: HTMLButtonElement) => {
      const scale = Number.parseFloat(button.style.width) / baseWidth
      return Number.parseFloat(button.style.left) / scale
    }
    const neighborStart = logicalX(neighbor)
    const selectedStart = logicalX(selected)

    fireEvent.click(selected, { detail: 1 })
    expect(selected).toBeInTheDocument()
    expect(region).not.toHaveClass('fp-gallery--out')

    act(() => vi.advanceTimersByTime(80))
    expect(neighbor).toBeInTheDocument()
    expect(selected).toBeInTheDocument()
    expect(selected.style.left).not.toBe(left)
    expect(selected.style.width).not.toBe(width)
    const mediaWidth = Number.parseFloat(region.style.getPropertyValue('--fp-photo-media-width'))
    const mediaHeight = Number.parseFloat(region.style.getPropertyValue('--fp-photo-media-height'))
    const mediaScale = Number.parseFloat(selected.style.getPropertyValue('--fp-photo-media-scale'))
    expect(mediaWidth * mediaScale).toBeCloseTo(Number.parseFloat(selected.style.width))
    expect(mediaHeight * mediaScale).toBeCloseTo(Number.parseFloat(selected.style.height))
    const neighborX = logicalX(neighbor)
    const selectedX = logicalX(selected)
    expect(selectedX).toBeGreaterThan(neighborX)
    expect(selectedX - selectedStart).toBeCloseTo(neighborX - neighborStart, 4)
    expect(getComputedStyle(selected).zIndex).toBe(getComputedStyle(neighbor).zIndex)
    expect(region).not.toHaveClass('fp-gallery--in')

    act(() => vi.advanceTimersByTime(1900))
    const trailing = selected.nextElementSibling as HTMLButtonElement
    expect(trailing).toHaveClass('fp-photo')
    const visibleStrip = window.innerWidth - Number.parseFloat(trailing.style.left)
    expect(visibleStrip).toBeGreaterThan(0)
    expect(visibleStrip).toBeLessThan(2)

    act(() => vi.advanceTimersByTime(900))
    expect(trailing).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: selectedName, pressed: true })).toBe(selected)
    const settled = screen.getAllByRole<HTMLButtonElement>('button', { name: /^View photo from / })
    const rightmostLeft = Math.max(...settled.map(button => Number.parseFloat(button.style.left)))
    expect(Number.parseFloat(selected.style.left)).toBe(rightmostLeft)
    const selectedRight = Number.parseFloat(selected.style.left) + Number.parseFloat(selected.style.width)
    expect(selectedRight).toBeCloseTo(window.innerWidth, 2)
  })

  it('moves the outgoing photos continuously before settling on the selected province', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    const region = screen.getByRole('region', { name: 'Photo composition' })
    const [match, , outgoing] = screen.getAllByRole<HTMLButtonElement>('button', { name: /^View photo from / })
    const matchingName = match.getAttribute('aria-label')!
    const province = matchingName.replace('View photo from ', '')
    const { left, width } = outgoing.style

    selectFootprintFilter('Province', province)
    expect(outgoing).toBeInTheDocument()
    expect(region).not.toHaveClass('fp-gallery--out')

    act(() => vi.advanceTimersByTime(80))
    expect(outgoing).toBeInTheDocument()
    expect(outgoing.style.left).not.toBe(left)
    expect(outgoing.style.width).not.toBe(width)
    expect(region).not.toHaveClass('fp-gallery--in')

    act(() => vi.advanceTimersByTime(2500))
    const settled = screen.getAllByRole('button', { name: /^View photo from / })
    expect(settled.length).toBeGreaterThan(1)
    for (const button of settled) expect(button).toHaveAccessibleName(matchingName)
    expect(outgoing).not.toBeInTheDocument()
  })

  it('waits for mouse movement after the wheel settles before restoring hover', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    const region = screen.getByRole('region', { name: 'Photo composition' })
    const movePointer = (clientX: number) =>
      fireEvent.pointerMove(region, { pointerType: 'mouse', clientX, clientY: 500 })

    fireEvent.wheel(region, { deltaY: 120, clientX: 400, clientY: 500 })
    expect(region).toHaveAttribute('data-wheel-hover-paused', 'true')
    movePointer(410)
    act(() => vi.advanceTimersByTime(2800))
    expect(region).toHaveAttribute('data-moving', 'false')
    movePointer(410)
    expect(region).toHaveAttribute('data-wheel-hover-paused', 'true')
    movePointer(411)
    expect(region).toHaveAttribute('data-wheel-hover-paused', 'true')
    movePointer(415)
    expect(region).toHaveAttribute('data-wheel-hover-paused', 'false')
  })

  it('keeps the filtered reel moving and wrapping after selecting a photo', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    const region = screen.getByRole('region', { name: 'Photo composition' })
    const matchingName = 'View photo from Anhui'
    selectFootprintFilter('Province', 'Anhui')
    act(() => vi.advanceTimersByTime(2500))

    const [, selected] = screen.getAllByRole<HTMLButtonElement>('button', { name: matchingName })
    fireEvent.click(selected, { detail: 1 })
    act(() => vi.advanceTimersByTime(2800))
    expect(screen.getByRole('button', { name: matchingName, pressed: true })).toBe(selected)
    const leadLeft = Number.parseFloat(selected.style.left)
    const visible = screen.getAllByRole<HTMLButtonElement>('button', { name: /^View photo from / })
    expect(leadLeft).toBe(Math.max(...visible.map(button => Number.parseFloat(button.style.left))))

    fireEvent.wheel(region, { deltaY: -120 })
    act(() => vi.advanceTimersByTime(100))
    expect(selected).toBeInTheDocument()
    expect(Number.parseFloat(selected.style.left)).toBeLessThan(leadLeft)

    fireEvent.wheel(region, { deltaY: -100_000 })
    act(() => vi.advanceTimersByTime(5000))
    const wrapped = screen.getAllByRole('button', { name: /^View photo from / })
    expect(wrapped.length).toBeGreaterThan(1)
    for (const button of wrapped) expect(button).toHaveAccessibleName(matchingName)
  })

  it('advances the reel with the keyboard without replacing its introduction', async () => {
    await renderAuthenticatedHomepage()
    await openFootprintsFromHome()
    const names = () => screen.getAllByRole('button', { name: /^View photo from / }).map(button => button.getAttribute('aria-label'))
    const initial = names()
    fireEvent.keyDown(screen.getAllByRole('button', { name: /^View photo from / })[0], { key: 'ArrowRight' })
    act(() => vi.advanceTimersByTime(2400))
    const shifted = names()
    expect(shifted.slice(1)).toEqual(initial.slice(0, shifted.length - 1))
    expect(initial).not.toContain(shifted[0])
    expect(screen.getByRole('heading', { name: 'Footprints' })).toBeInTheDocument()
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
