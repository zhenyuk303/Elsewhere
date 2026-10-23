import { render } from '@testing-library/react'
import { HomePlaceholder } from './HomePlaceholder'

describe('HomePlaceholder', () => {
  it('locks document scrolling while the full-screen placeholder is mounted', () => {
    const { unmount } = render(<HomePlaceholder />)

    expect(document.body).toHaveClass('home-view')
    expect(window.getComputedStyle(document.body).overflow).toBe('hidden')

    unmount()

    expect(document.body).not.toHaveClass('home-view')
  })
})
