import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

function renderHomePage(
  onLogout: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
) {
  return render(<HomePage onLogout={onLogout} />)
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the fixed navigation and editorial content', () => {
    renderHomePage()

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
  })

  it('renders a solid login-page background without province media', () => {
    const { container } = renderHomePage()
    const homepage = container.querySelector('.homepage')
    const style = window.getComputedStyle(homepage!)

    expect(style.backgroundColor).toBe('rgb(243, 241, 237)')
    expect(style.color).toBe('rgb(23, 23, 23)')
    expect(container.querySelector('.homepage-background')).toBeNull()
    expect(container.querySelector('.homepage-slide')).toBeNull()
    expect(container.querySelector('.homepage-location')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('ANHUI, CHINA')).not.toBeInTheDocument()
    expect(
      screen.queryByText('01 / A NEW PERSPECTIVE'),
    ).not.toBeInTheDocument()
  })

  it('does not schedule background work', () => {
    const { unmount } = renderHomePage()

    expect(vi.getTimerCount()).toBe(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
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
      screen.getByRole('heading', { name: 'Explore the World' }),
    ).toBeInTheDocument()
  })

  it('has no homepage entrance animation', () => {
    const { container } = renderHomePage()
    const homepage = container.querySelector('.homepage')

    expect(window.getComputedStyle(homepage!).animationName).toBe('none')
  })

  it('locks document scrolling only while mounted', () => {
    const { unmount } = renderHomePage()

    expect(document.body).toHaveClass('home-view')
    expect(window.getComputedStyle(document.body).overflow).toBe('hidden')

    unmount()
    expect(document.body).not.toHaveClass('home-view')
  })
})
