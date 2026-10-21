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

  it('renders login copy and submits without an agreement checkbox', async () => {
    const user = userEvent.setup()
    const { onModeChange, onValidSubmit } = renderPanel('login')

    expect(
      screen.getByRole('heading', {
        name: 'A wonderful journey begins now.',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'QQ' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Username'), 'traveler')
    await user.type(screen.getByLabelText('Password'), 'secret-path')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(onValidSubmit).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('link', { name: 'Sign up' }))
    expect(onModeChange).toHaveBeenCalledWith('signup')
  })
})
