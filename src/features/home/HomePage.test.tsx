import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import type { HomePhase } from './homeIntro'

function renderHomePage(
  onLogout: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
  phase: HomePhase = 'ready',
) {
  return render(<HomePage phase={phase} onLogout={onLogout} />)
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the same five image nodes through every controlled phase', () => {
    const onLogout = vi.fn().mockResolvedValue(undefined)
    const { container, rerender } = render(
      <HomePage phase="primed" onLogout={onLogout} />,
    )
    const originalImages = Array.from(
      container.querySelectorAll<HTMLImageElement>('.homepage-intro-image'),
    )
    const originalFrames = Array.from(
      container.querySelectorAll<HTMLElement>('.homepage-intro-frame'),
    )

    expect(originalImages).toHaveLength(5)
    expect(originalFrames).toHaveLength(5)
    expect(originalFrames.map((frame) => frame.querySelector('img'))).toEqual(
      originalImages,
    )
    expect(originalImages.map((image) => image.alt)).toEqual([
      'White magnolia blossoms against a deep red wall in Beijing.',
      'A road crossing red and tan desert terrain in Qinghai.',
      'An aerial night view of illuminated streets and towers in Shanghai.',
      'Colorful prayer flags radiating around a golden center in Tibet.',
      'Turquoise desert lakes winding between pale dunes in Xinjiang.',
    ])
    expect(container.querySelector('.homepage-intro-counter')).toBeInTheDocument()

    for (const phase of ['gallery', 'lifting', 'ready'] as HomePhase[]) {
      rerender(<HomePage phase={phase} onLogout={onLogout} />)
      const currentImages = Array.from(
        container.querySelectorAll<HTMLImageElement>('.homepage-intro-image'),
      )
      expect(currentImages).toEqual(originalImages)
      expect(
        Array.from(container.querySelectorAll('.homepage-intro-frame')),
      ).toEqual(originalFrames)
    }
  })

  it('moves the complete final page as one surface beneath the persistent picture', () => {
    const { container } = renderHomePage()
    const surface = container.querySelector('.homepage-warm-reveal')
    const picture = container.querySelector<HTMLElement>('.homepage-intro-visual')

    expect(surface).toContainElement(screen.getByRole('navigation'))
    expect(surface).toContainElement(
      screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' }),
    )
    expect(surface).toContainElement(
      screen.getByRole('button', { name: 'BEGIN THE JOURNEY' }),
    )
    expect(surface).toContainElement(screen.getByText('· 2026'))
    expect(surface).not.toContainElement(picture)
  })

  it('runs the intro counter only during gallery and cleans up its animation frame', () => {
    const requestSpy = vi.spyOn(window, 'requestAnimationFrame')
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const onLogout = vi.fn().mockResolvedValue(undefined)
    const { container, rerender, unmount } = render(
      <HomePage phase="primed" onLogout={onLogout} />,
    )
    const counter = container.querySelector('.homepage-intro-counter-value')

    expect(counter).toHaveTextContent('00')
    expect(requestSpy).not.toHaveBeenCalled()

    rerender(<HomePage phase="gallery" onLogout={onLogout} />)
    expect(requestSpy).toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1000))
    expect(Number(counter?.textContent)).toBeGreaterThan(0)

    rerender(<HomePage phase="lifting" onLogout={onLogout} />)
    expect(counter).toHaveTextContent('100')
    expect(cancelSpy).toHaveBeenCalled()
    const requestsAfterGallery = requestSpy.mock.calls.length
    act(() => vi.advanceTimersByTime(1000))
    expect(requestSpy).toHaveBeenCalledTimes(requestsAfterGallery)
    unmount()
  })

  it('locks primed and gallery states and unlocks interaction while lifting', () => {
    const onLogout = vi.fn().mockResolvedValue(undefined)
    const { container, rerender } = render(
      <HomePage phase="primed" onLogout={onLogout} />,
    )
    const homepage = container.querySelector('.homepage') as HTMLElement
    const profile = screen.getByRole('button', {
      name: 'User profile',
      hidden: true,
    })

    expect(homepage).toHaveAttribute('inert')
    expect(homepage).toHaveAttribute('aria-hidden', 'true')
    expect(window.getComputedStyle(homepage).pointerEvents).toBe('none')
    fireEvent.click(profile)
    expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument()

    rerender(<HomePage phase="gallery" onLogout={onLogout} />)
    expect(homepage).toHaveAttribute('inert')
    expect(homepage).not.toHaveAttribute('aria-hidden')
    expect(window.getComputedStyle(homepage).pointerEvents).toBe('none')

    rerender(<HomePage phase="lifting" onLogout={onLogout} />)
    expect(homepage).not.toHaveAttribute('inert')
    expect(homepage).not.toHaveAttribute('aria-hidden')
    expect(window.getComputedStyle(homepage).pointerEvents).toBe('auto')
    fireEvent.click(profile)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('places the logo left and all four navigation controls right', () => {
    const { container } = renderHomePage()

    const navigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    })
    const logo = within(navigation).getByRole('img', { name: 'ELSEWHERE' })
    expect(navigation.firstElementChild).toContainElement(logo)
    expect(
      within(navigation)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim()),
    ).toEqual(['Footprints', 'Guides', 'Community', 'User profile'])
    const footer = container.querySelector('.homepage-footer')
    expect(footer).not.toContainElement(
      screen.getByRole('button', { name: 'Guides' }),
    )
    expect(footer).not.toContainElement(
      screen.getByRole('button', { name: 'User profile' }),
    )
    expect(
      screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Follow the places that move you.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Keep the moments that stay.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'BEGIN THE JOURNEY' }),
    ).toBeInTheDocument()
    const credit = container.querySelector('.homepage-credit') as HTMLElement
    expect(within(credit).getByRole('img', { name: 'ELSEWHERE' })).toBeInTheDocument()
    expect(within(credit).getByText('· 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' }).querySelector('.brand-logo')).toBeNull()
  })

  it('does not schedule phase work from inside the component', () => {
    const { unmount } = renderHomePage()

    expect(vi.getTimerCount()).toBe(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts the walking parade only after App enters ready', () => {
    const onLogout = vi.fn().mockResolvedValue(undefined)
    const { container, rerender } = render(
      <HomePage phase="primed" onLogout={onLogout} />,
    )
    for (const phase of ['primed', 'gallery', 'lifting'] as HomePhase[]) {
      rerender(<HomePage phase={phase} onLogout={onLogout} />)
      expect(container.querySelector('.walker-lane')).toBeNull()
    }
    rerender(<HomePage phase="ready" onLogout={onLogout} />)
    const lane = container.querySelector('.walker-lane')
    expect(lane).toBeInTheDocument()
    expect(lane).toHaveAttribute('aria-hidden', 'true')
    expect(lane?.querySelectorAll('.walker-crossing')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'User profile' })).toBeEnabled()
  })

  it('keeps profile and navigation hooks static', () => {
    renderHomePage()

    expect(
      screen.getByRole('button', { name: 'Footprints' }),
    ).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Guides' })).toHaveAttribute(
      'type',
      'button',
    )
    expect(
      screen.getByRole('button', { name: 'Community' }),
    ).toHaveAttribute('type', 'button')
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('toggles an accessible profile menu with the requested actions', () => {
    renderHomePage()
    const profile = screen.getByRole('button', { name: 'User profile' })

    expect(profile).toHaveAttribute('aria-haspopup', 'menu')
    expect(profile).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(profile)
    const menu = screen.getByRole('menu')
    expect(profile).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(menu).getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Personal homepage', 'Log out'])

    fireEvent.click(profile)
    expect(profile).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps the personal homepage action reserved and closes its menu', () => {
    renderHomePage()
    const initialUrl = window.location.href

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Personal homepage' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(window.location.href).toBe(initialUrl)
    expect(screen.getByRole('button', { name: 'User profile' })).toHaveFocus()
  })

  it('dismisses the profile menu outside and with Escape', () => {
    renderHomePage()
    const profile = screen.getByRole('button', { name: 'User profile' })

    fireEvent.click(profile)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(profile)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(profile).toHaveFocus()
  })

  it('supports keyboard opening, navigation, and Tab dismissal', () => {
    renderHomePage()
    const profile = screen.getByRole('button', { name: 'User profile' })

    profile.focus()
    fireEvent.keyDown(profile, { key: 'ArrowDown' })
    const personalHomepage = screen.getByRole('menuitem', {
      name: 'Personal homepage',
    })
    const logout = screen.getByRole('menuitem', { name: 'Log out' })
    expect(personalHomepage).toHaveFocus()

    fireEvent.keyDown(personalHomepage, { key: 'ArrowDown' })
    expect(logout).toHaveFocus()
    fireEvent.keyDown(logout, { key: 'ArrowDown' })
    expect(personalHomepage).toHaveFocus()
    fireEvent.keyDown(personalHomepage, { key: 'ArrowUp' })
    expect(logout).toHaveFocus()

    fireEvent.keyDown(logout, { key: 'Tab' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('blocks duplicate logout submissions while one is pending', async () => {
    let finishLogout: (() => void) | undefined
    const onLogout = vi.fn(
      () => new Promise<void>((resolve) => {
        finishLogout = resolve
      }),
    )
    renderHomePage(onLogout)

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    const logoutButton = screen.getByRole('menuitem', { name: 'Log out' })
    fireEvent.click(logoutButton)
    fireEvent.click(logoutButton)

    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(logoutButton).toBeDisabled()

    await act(async () => finishLogout?.())
  })

  it('keeps a failed logout available for retry', async () => {
    const onLogout = vi.fn().mockRejectedValue(new Error('offline'))
    renderHomePage(onLogout)

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
      await Promise.resolve()
    })

    expect(
      screen.getByRole('menuitem', { name: 'Log out' }),
    ).toBeEnabled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'FIND YOUR ELSEWHERE' }),
    ).toBeInTheDocument()
  })

  it('removes document menu listeners when closed or unmounted', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHomePage()

    fireEvent.click(screen.getByRole('button', { name: 'User profile' }))
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('locks document scrolling only while an active homepage is mounted', () => {
    const { unmount } = renderHomePage()

    expect(document.body).toHaveClass('home-view')
    expect(window.getComputedStyle(document.body).overflow).toBe('hidden')
    expect(window.getComputedStyle(document.body).overflowX).toBe('hidden')

    unmount()
    expect(document.body).not.toHaveClass('home-view')
  })

  it('disables the persistent marquee for reduced motion', () => {
    const marqueeRule = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === '(prefers-reduced-motion: reduce)',
      )
      .flatMap((rule) => Array.from(rule.cssRules))
      .find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.includes('.homepage-marquee-track'),
    )

    expect(marqueeRule?.style.animation).toBe('none')
    expect(marqueeRule?.style.getPropertyPriority('animation')).toBe('important')
  })
})
