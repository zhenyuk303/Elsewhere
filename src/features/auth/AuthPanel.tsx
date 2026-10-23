import { FormEvent, useState } from 'react'
import qqIcon from '../../assets/social/qq-icon.png'
import wechatIcon from '../../assets/social/wechat-icon.svg'
import type { AuthMode, ButtonRect } from './types'
import './auth.css'

type AuthPanelProps = {
  mode: AuthMode
  disabled: boolean
  onModeChange: (mode: AuthMode) => void
  onAuthenticate: (username: string, password: string, agreementAccepted: boolean) => Promise<void>
  onValidSubmit: (origin: ButtonRect) => void
}

type FormErrors = Partial<
  Record<'username' | 'password' | 'agreement', string>
>

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19c.7-3.7 3.1-5.6 6.5-5.6s5.8 1.9 6.5 5.6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="5.5" y="10" width="13" height="9.5" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  )
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z" />
      <circle cx="12" cy="12" r="2.4" />
      {hidden ? <path d="m4 4 16 16" /> : null}
    </svg>
  )
}

export function AuthPanel({
  mode,
  disabled,
  onModeChange,
  onAuthenticate,
  onValidSubmit,
}: AuthPanelProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreement, setAgreement] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'
  const isDisabled = disabled || busy

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (!username.trim()) nextErrors.username = 'Username is required'
    if (!password.trim()) nextErrors.password = 'Password is required'
    if (isSignup && !agreement) {
      nextErrors.agreement = 'Please accept the terms to continue'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || isDisabled) return

    const button = event.currentTarget.elements.namedItem(
      'primary-action',
    ) as HTMLButtonElement
    const { left, top, width, height } = button.getBoundingClientRect()
    setBusy(true)
    setServerError('')
    try {
      await onAuthenticate(username.trim(), password, agreement)
      onValidSubmit({ left, top, width, height })
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-panel">
      <header className="auth-header">
        <a className="brand" href="#top" aria-label="Elsewhere home">
          ELSEWHERE
        </a>
        <div className="title-block" key={mode}>
          <h1 id="auth-title">
            {isSignup ? 'Create your account' : 'Welcome'}
          </h1>
          {isSignup ? (
            <p className="auth-subtitle">
              Let's create an account and start a wonderful journey
            </p>
          ) : (
            <p className="auth-subtitle">A wonderful journey begins now</p>
          )}
        </div>
      </header>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor={`${mode}-username`}>Username</label>
          <div className={`field-shell ${errors.username ? 'has-error' : ''}`}>
            <span className="field-icon">
              <UserIcon />
            </span>
            <input
              id={`${mode}-username`}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              disabled={isDisabled}
              aria-describedby={errors.username ? `${mode}-username-error` : undefined}
            />
          </div>
          {errors.username ? (
            <p className="field-error" id={`${mode}-username-error`}>
              {errors.username}
            </p>
          ) : null}
        </div>

        <div className="field-group">
          <label htmlFor={`${mode}-password`}>Password</label>
          <div className={`field-shell ${errors.password ? 'has-error' : ''}`}>
            <span className="field-icon">
              <LockIcon />
            </span>
            <input
              id={`${mode}-password`}
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              disabled={isDisabled}
              aria-describedby={errors.password ? `${mode}-password-error` : undefined}
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={isDisabled}
            >
              <EyeIcon hidden={showPassword} />
            </button>
          </div>
          {errors.password ? (
            <p className="field-error" id={`${mode}-password-error`}>
              {errors.password}
            </p>
          ) : null}
        </div>

        {isSignup ? (
          <div className="agreement-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={agreement}
                onChange={(event) => setAgreement(event.target.checked)}
                disabled={isDisabled}
              />
              <span aria-hidden="true" className="custom-check" />
              <span>I agree to all Term, Privacy Policy and Fees</span>
            </label>
            {errors.agreement ? (
              <p className="field-error agreement-error">{errors.agreement}</p>
            ) : null}
          </div>
        ) : null}

        <button
          className="primary-button"
          type="submit"
          name="primary-action"
          disabled={isDisabled}
        >
          <span>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Login'}</span>
          <span aria-hidden="true" className="button-arrow">
            ↗
          </span>
        </button>
        {serverError ? <p className="field-error" role="alert">{serverError}</p> : null}

        {isSignup ? (
          <div className="social-block">
            <p className="social-label">
              <span>Or sign up with</span>
            </p>
            <div className="social-actions">
              <button type="button" disabled={isDisabled}>
                <span className="social-icon social-icon--qq" aria-hidden="true">
                  <img src={qqIcon} alt="" />
                </span>
                QQ
              </button>
              <button type="button" disabled={isDisabled}>
                <span
                  className="social-icon social-icon--wechat"
                  aria-hidden="true"
                >
                  <img src={wechatIcon} alt="" />
                </span>
                微信
              </button>
            </div>
          </div>
        ) : null}
      </form>

      <p className="mode-switch">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <a
          href={isSignup ? '#login' : '#signup'}
          onClick={(event) => {
            event.preventDefault()
            onModeChange(isSignup ? 'login' : 'signup')
          }}
        >
          {isSignup ? 'Login' : 'Sign up'}
        </a>
      </p>
    </div>
  )
}
