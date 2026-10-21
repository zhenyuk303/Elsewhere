export type AuthMode = 'signup' | 'login'

export type ButtonRect = {
  left: number
  top: number
  width: number
  height: number
}

export type TransitionOrigin = ButtonRect & {
  dividerX: number
  cardTop: number
  cardHeight: number
}
