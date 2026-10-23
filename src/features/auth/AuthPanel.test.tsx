import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AuthPanel } from './AuthPanel'

function renderPanel(mode: 'signup' | 'login' = 'signup') {
  const onModeChange = vi.fn()
  const onValidSubmit = vi.fn()

  render(
    <AuthPanel
      mode={mode}
      disabled={false}
      onModeChange={onModeChange}
      onValidSubmit={onValidSubmit}
    />,
  )

  return { onModeChange, onValidSubmit }
}

describe('AuthPanel', () => {
  it('renders the exact signup experience without an email field', () => {
    renderPanel()

    expect(screen.getByText('ELSEWHERE')).toBeInTheDocument()
    expect(screen.queryByText('YOUR NEXT CHAPTER')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Let's create an account and start a wonderful journey",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'QQ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '微信' })).toBeInTheDocument()
  })

  it('anchors the three-line heading block without positional animation', () => {
    const { container } = render(
      <AuthPanel
        mode="signup"
        disabled={false}
        onModeChange={vi.fn()}
        onValidSubmit={vi.fn()}
      />,
    )

    const panel = container.querySelector('.auth-panel')
    const titleBlock = container.querySelector('.title-block')

    expect(window.getComputedStyle(panel!).justifyContent).toBe('flex-start')
    expect(window.getComputedStyle(titleBlock!).animationName).toBe('none')
  })

  it('uses local icon artwork for the social sign-up actions', () => {
    renderPanel()

    const qqIcon = screen
      .getByRole('button', { name: 'QQ' })
      .querySelector('img')
    const wechatIcon = screen
      .getByRole('button', { name: '微信' })
      .querySelector('img')

    expect(qqIcon).toHaveAttribute('src', expect.stringContaining('qq-icon'))
    expect(qqIcon).toHaveAttribute('alt', '')
    expect(wechatIcon?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/)
    expect(wechatIcon).toHaveAttribute('alt', '')
  })

  it('switches password visibility without changing its value', async () => {
    const user = userEvent.setup()
    renderPanel()

    const password = screen.getByLabelText('Password')
    await user.type(password, 'secret-path')
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('secret-path')
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toBeInTheDocument()
  })

  it('uses one equally sized outer focus highlight for both credential fields', async () => {
    const user = userEvent.setup()
    renderPanel()

    const username = screen.getByLabelText('Username')
    const password = screen.getByLabelText('Password')
    const usernameShell = username.closest('.field-shell')
    const passwordShell = password.closest('.field-shell')
    const passwordToggle = screen.getByRole('button', {
      name: 'Show password',
    })

    expect(usernameShell).not.toBeNull()
    expect(passwordShell).not.toBeNull()
    expect(passwordShell).toContainElement(passwordToggle)

    await user.click(username)
    const usernameHighlight = window.getComputedStyle(usernameShell!).boxShadow
    expect(window.getComputedStyle(username).outlineStyle).toBe('none')

    await user.click(password)
    const passwordHighlight = window.getComputedStyle(passwordShell!).boxShadow

    expect(window.getComputedStyle(password).outlineStyle).toBe('none')
    expect(passwordHighlight).toBe(usernameHighlight)
    expect(passwordHighlight).not.toBe('none')

    const inputFocusRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === '.field-shell input:focus-visible',
      )

    expect(inputFocusRule?.style.outline).toBe('none')
  })

  it('asks the parent to switch only when the bottom login link is used', async () => {
    const user = userEvent.setup()
    const { onModeChange, onValidSubmit } = renderPanel()

    await user.click(screen.getByRole('link', { name: 'Login' }))

    expect(onModeChange).toHaveBeenCalledOnce()
    expect(onModeChange).toHaveBeenCalledWith('login')
    expect(onValidSubmit).not.toHaveBeenCalled()
  })

  it('rejects whitespace credentials and an unchecked signup agreement', async () => {
    const user = userEvent.setup()
    const { onValidSubmit } = renderPanel()

    await user.type(screen.getByLabelText('Username'), '   ')
    await user.type(screen.getByLabelText('Password'), '   ')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(
      screen.getByText('Please accept the terms to continue'),
    ).toBeInTheDocument()
    expect(onValidSubmit).not.toHaveBeenCalled()
  })

  it('submits signup only after the agreement is accepted', async () => {
    const user = userEvent.setup()
    const { onValidSubmit } = renderPanel()
    const submit = screen.getByRole('button', { name: 'Login' })
    vi.spyOn(submit, 'getBoundingClientRect').mockReturnValue({
      left: 120,
      top: 480,
      width: 340,
      height: 54,
    } as DOMRect)

    await user.type(screen.getByLabelText('Username'), 'traveler')
    await user.type(screen.getByLabelText('Password'), 'secret-path')
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I agree to all Term, Privacy Policy and Fees',
      }),
    )
    await user.click(submit)

    expect(onValidSubmit).toHaveBeenCalledWith({
      left: 120,
      top: 480,
      width: 340,
      height: 54,
    })
  })

  it('places login social actions in the same form slot as signup', () => {
    renderPanel('login')

    const socialLabel = screen.getByText('Or login with')
    const socialBlock = socialLabel.closest('.social-block')
    const form = socialBlock?.closest('form')

    expect(screen.getByRole('button', { name: 'QQ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '微信' })).toBeInTheDocument()
    expect(form?.children).toHaveLength(5)
    expect(form?.children.item(2)).toHaveClass(
      'agreement-row',
      'agreement-row--placeholder',
    )
    expect(form?.children.item(2)).toHaveAttribute('aria-hidden', 'true')
    expect(form?.children.item(4)).toBe(socialBlock)
  })

  it('renders login copy and submits without an agreement checkbox', async () => {
    const user = userEvent.setup()
    const { onModeChange, onValidSubmit } = renderPanel('login')

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(
      screen.getByText('The best view comes after the hardest climb.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Username'), 'traveler')
    await user.type(screen.getByLabelText('Password'), 'secret-path')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(onValidSubmit).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('link', { name: 'Sign up' }))
    expect(onModeChange).toHaveBeenCalledWith('signup')
  })
})
