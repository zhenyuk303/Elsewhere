import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import githubMark from '../../assets/social/github-mark.svg'
import googleMark from '../../assets/social/google-g.png'
import { AuthPanel } from './AuthPanel'

function renderPanel(mode: 'signup' | 'login' = 'signup') {
  const onModeChange = vi.fn()
  const onAuthenticate = vi.fn().mockResolvedValue(undefined)
  const onSocialLogin = vi.fn().mockResolvedValue(undefined)
  const onValidSubmit = vi.fn()

  render(
    <AuthPanel
      mode={mode}
      disabled={false}
      onModeChange={onModeChange}
      onAuthenticate={onAuthenticate}
      onSocialLogin={onSocialLogin}
      onValidSubmit={onValidSubmit}
    />,
  )

  return { onModeChange, onAuthenticate, onSocialLogin, onValidSubmit }
}

it.each([
  ['L01', 'signup', false, 'T/T'],
  ['L02', 'signup', true, 'T/F'],
  ['L03', 'login', false, 'F/short-circuit'],
  ['L04', 'login', true, 'F/short-circuit'],
] as const)('%s agreement decision (%s, checked=%s, operands=%s)', async (id, mode, checked) => {
  const user = userEvent.setup()
  const onAuthenticate = vi.fn().mockResolvedValue(undefined)
  const props = { disabled: false, onModeChange: vi.fn(), onAuthenticate,
    onSocialLogin: vi.fn().mockResolvedValue(undefined), onValidSubmit: vi.fn() }
  const { rerender } = render(<AuthPanel {...props} mode={checked ? 'signup' : mode} />)
  if (checked) {
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()
    if (mode === 'login') rerender(<AuthPanel {...props} mode={'login'} />)
  }
  await user.type(screen.getByLabelText('Username'), 'qa_logic')
  await user.type(screen.getByLabelText('Password'), 'synthetic-password')
  await user.click(screen.getByRole('button', { name: mode === 'signup' ? /^Sign Up$/ : /^Login$/ }))
  const error = screen.queryByText('Please accept the terms to continue')
  if (id === 'L01') {
    expect(error).toBeVisible()
    expect(onAuthenticate).not.toHaveBeenCalled()
  } else {
    expect(error).not.toBeInTheDocument()
    expect(onAuthenticate).toHaveBeenCalledExactlyOnceWith('qa_logic', 'synthetic-password', checked)
  }
})

describe('AuthPanel', () => {
  it('renders the exact signup experience without an email field', () => {
    renderPanel()

    const brand = screen.getByRole('link', { name: 'Elsewhere home' })
    expect(brand.querySelector('.brand-logo')).toBeInTheDocument()
    expect(brand).not.toHaveTextContent('ELSEWHERE')
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
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Google' })).toBeInTheDocument()
  })

  it('renders the primary signup action without a decorative arrow', () => {
    renderPanel()

    const signupButton = screen.getByRole('button', { name: 'Sign Up' })

    expect(signupButton).toHaveTextContent(/^Sign Up$/)
    expect(signupButton.querySelector('.button-arrow')).toBeNull()
  })

  it('animates the three-line heading block while keeping its anchor fixed', () => {
    const { container } = render(
      <AuthPanel
        mode="signup"
        disabled={false}
        onModeChange={vi.fn()}
        onAuthenticate={vi.fn().mockResolvedValue(undefined)}
        onSocialLogin={vi.fn().mockResolvedValue(undefined)}
        onValidSubmit={vi.fn()}
      />,
    )

    const panel = container.querySelector('.auth-panel')
    const titleBlock = container.querySelector('.title-block')

    expect(window.getComputedStyle(panel!).justifyContent).toBe('flex-start')
    expect(window.getComputedStyle(titleBlock!).animationName).toBe(
      'auth-content-in',
    )
    expect(window.getComputedStyle(titleBlock!).transform).toBe('none')
  })

  it('shows GitHub and Google marks without the retired providers', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: 'GitHub' }).querySelector('img')).toHaveAttribute('src', githubMark)
    expect(screen.getByRole('button', { name: 'Google' }).querySelector('img')).toHaveAttribute('src', googleMark)
    expect(screen.queryByRole('button', { name: 'QQ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '微信' })).not.toBeInTheDocument()
  })

  it('shows a backend configuration error without leaving the form', async () => {
    const user = userEvent.setup()
    const { onSocialLogin, onValidSubmit } = renderPanel('login')
    onSocialLogin.mockRejectedValueOnce(new Error('GitHub login is not configured yet'))

    await user.click(screen.getByRole('button', { name: 'GitHub' }))

    expect(onSocialLogin).toHaveBeenCalledWith('github')
    expect(await screen.findByRole('alert')).toHaveTextContent('GitHub login is not configured yet')
    expect(onValidSubmit).not.toHaveBeenCalled()
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
    await user.click(screen.getByRole('button', { name: 'Sign Up' }))

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
    const submit = screen.getByRole('button', { name: 'Sign Up' })
    vi.spyOn(submit, 'getBoundingClientRect').mockReturnValue({
      left: 120,
      top: 480,
      width: 340,
      height: 54,
    } as DOMRect)

    await user.type(screen.getByLabelText('Username'), 'traveler')
    await user.type(screen.getByLabelText('Password'), 'Fixture1!')
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I agree to all Term, Privacy Policy and Fees',
      }),
    )
    await user.click(submit)

    expect(onValidSubmit).toHaveBeenCalledWith(
      {
        left: 120,
        top: 480,
        width: 340,
        height: 54,
      },
      'signup',
    )
  })

  it('shows the signup password rules and rejects a digits-only password before submitting', async () => {
    const user = userEvent.setup()
    const { onAuthenticate } = renderPanel()
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/8–72 characters/)
    await user.type(screen.getByLabelText('Username'), 'traveler')
    await user.type(screen.getByLabelText('Password'), '12345678')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Sign Up' }))
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/uppercase letter/)
    expect(onAuthenticate).not.toHaveBeenCalled()
  })

  it('places login social actions in the same form slot as signup', () => {
    renderPanel('login')

    const socialLabel = screen.getByText('Or login with')
    const socialBlock = socialLabel.closest('.social-block')
    const form = socialBlock?.closest('form')

    expect(screen.getByRole('button', { name: 'GitHub' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Google' })).toBeInTheDocument()
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

  it('keeps the user on the form when the server rejects the credentials', async () => {
    const user = userEvent.setup()
    const { onAuthenticate, onValidSubmit } = renderPanel('login')
    onAuthenticate.mockRejectedValueOnce(new Error('Invalid username or password'))

    await user.type(screen.getByLabelText('Username'), 'traveler')
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password')
    expect(onValidSubmit).not.toHaveBeenCalled()
  })
})
