export type AuthUser = { id: number; username: string }

async function request(path: string, options?: RequestInit): Promise<AuthUser | null> {
  let response: Response
  try {
    response = await fetch(`/api/auth/${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new Error('Cannot reach the server. Please try again.')
  }
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : 'Request failed')
  }
  return body as AuthUser
}

export async function authenticate(mode: 'signup' | 'login', username: string, password: string, agreementAccepted: boolean): Promise<AuthUser> {
  const user = await request(mode === 'signup' ? 'register' : 'login', {
    method: 'POST',
    body: JSON.stringify(mode === 'signup' ? { username, password, agreementAccepted } : { username, password }),
  })
  return user!
}

export async function currentUser(): Promise<AuthUser | null> {
  try {
    return await request('me')
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  await request('logout', { method: 'POST' })
}

export type SocialProvider = 'qq' | 'wechat'

export async function beginSocialLogin(provider: SocialProvider): Promise<string> {
  let response: Response
  try {
    response = await fetch(`/api/auth/oauth/${provider}/start`, {
      method: 'POST',
      credentials: 'same-origin',
    })
  } catch {
    throw new Error('Cannot reach the server. Please try again.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : 'Social login is unavailable')
  }
  if (typeof body.authorizationUrl !== 'string') throw new Error('Social login is unavailable')
  return body.authorizationUrl
}
