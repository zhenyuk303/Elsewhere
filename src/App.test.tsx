import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('opens on the signup experience', () => {
    render(<App />)

    expect(screen.getByText('ELSEWHERE')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('A wonderful journey begins now.'),
    ).not.toBeInTheDocument()
  })
})
