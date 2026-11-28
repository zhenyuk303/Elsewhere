import {
  useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { usePopupPullout } from '../transition/usePopupPullout'
import './footprint-select.css'

export type FootprintOption = { value: string; label: string }
type Props = {
  id: string
  label: string
  value: string
  options: readonly FootprintOption[]
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  describedBy?: string
  placeholder?: string
  triggerRef?: Ref<HTMLButtonElement>
}

export function FootprintSelect({
  id, label, value, options, onChange, disabled, invalid, required,
  describedBy, placeholder, triggerRef,
}: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [popup, setPopup] = useState<{ host: HTMLElement; style: CSSProperties; up: boolean }>()
  const showPopup = usePopupPullout(open && !!popup, list)
  const selected = options.findIndex(option => option.value === value)
  const listId = `${id}-listbox`
  useImperativeHandle(triggerRef, () => button.current!, [])

  function show(index = selected >= 0 ? selected : 0) {
    if (disabled || !options.length) return
    setActive(index)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    if (option.value !== value) onChange(option.value)
    setOpen(false)
    button.current?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    if (!open) return
    function place(event?: Event) {
      if (event?.target === list.current) return
      const trigger = button.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const dialog = trigger.closest('dialog')
      const host = dialog ?? document.body
      const visual = window.visualViewport
      const viewportLeft = visual?.offsetLeft ?? 0
      const viewportTop = visual?.offsetTop ?? 0
      const viewportRight = viewportLeft + (visual?.width ?? window.innerWidth)
      const viewportBottom = viewportTop + (visual?.height ?? window.innerHeight)
      const panel = dialog?.getBoundingClientRect()
      const leftBound = Math.max(viewportLeft, panel?.left ?? viewportLeft) + 8
      const rightBound = Math.min(viewportRight, panel?.right ?? viewportRight) - 8
      const topBound = Math.max(viewportTop, panel?.top ?? viewportTop) + 8
      const bottomBound = Math.min(viewportBottom, panel?.bottom ?? viewportBottom) - 8
      const below = Math.max(0, bottomBound - rect.bottom - 5)
      const above = Math.max(0, rect.top - topBound - 5)
      const up = below < Math.min(280, options.length * 36 + 12) && above > below
      const maxHeight = Math.min(320, up ? above : below)
      const width = Math.min(Math.max(rect.width, 190), Math.max(0, rightBound - leftBound))
      const left = Math.max(leftBound, Math.min(rect.left, rightBound - width))
      const hostLeft = panel ? panel.left + dialog!.clientLeft - dialog!.scrollLeft : 0
      const hostTop = panel ? panel.top + dialog!.clientTop - dialog!.scrollTop : 0
      setPopup({
        host, up,
        style: {
          position: dialog ? 'absolute' : 'fixed', left: left - hostLeft, width,
          maxHeight, top: (up ? rect.top - 5 : rect.bottom + 5) - hostTop,
          transform: up ? 'translateY(-100%)' : undefined,
        },
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [open, options])

  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      const target = event.target as Node
      if (!button.current?.contains(target) && !list.current?.contains(target)) setOpen(false)
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      button.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  useEffect(() => {
    if (!open) return
    const menu = list.current
    const option = menu?.children[active] as HTMLElement | undefined
    if (!menu || !option) return
    const top = option.offsetTop
    if (top < menu.scrollTop) menu.scrollTop = top
    else if (top + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = top + option.offsetHeight - menu.clientHeight
    }
  }, [active, open, listId, popup?.host])

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return }
    if (!options.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      if (!open) show(selected >= 0 ? selected : step > 0 ? 0 : options.length - 1)
      else setActive(current => (current + step + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      show(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(active)
      else show()
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      const now = performance.now()
      const previous = now - search.current.time < 700 ? search.current.text : ''
      const text = previous + event.key.toLocaleLowerCase()
      search.current = { text, time: now }
      const repeated = [...text].every(letter => letter === text[0])
      const prefix = repeated ? text[0] : text
      const start = open ? active : selected
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (start + offset + options.length) % options.length
        if (options[index].label.toLocaleLowerCase().startsWith(prefix)) { show(index); break }
      }
    }
  }

  return <span className="fp-select">
    <button ref={button} id={id} type="button" className="fp-select-trigger"
      role="combobox" aria-label={label} aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-haspopup="listbox" aria-activedescendant={open ? `${listId}-${active}` : undefined}
      aria-invalid={invalid || undefined} aria-required={required || undefined} aria-describedby={describedBy}
      disabled={disabled} onKeyDown={keyDown} onBlur={event => {
        if (!list.current?.contains(event.relatedTarget)) setOpen(false)
      }} onClick={() => open ? setOpen(false) : show()}>
      <span>{options[selected]?.label ?? placeholder ?? 'Choose an option'}</span>
      <span className="fp-select-chevron" aria-hidden="true" />
    </button>
    {showPopup && popup && createPortal(
      <div className="fp-select-position" style={popup.style}>
        <div ref={list} id={listId} role="listbox" aria-label={label} className="fp-select-list"
          data-placement={popup.up ? 'above' : 'below'} inert={!open} aria-hidden={!open || undefined}
          onMouseDown={event => event.preventDefault()}>
          {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`}
            role="option" aria-selected={option.value === value} className="fp-select-option"
            data-active={index === active} onPointerMove={event => {
              if (event.pointerType === 'mouse') setActive(index)
            }} onClick={() => choose(index)}>
            <span>{option.label}</span><span aria-hidden="true">{option.value === value ? '✓' : ''}</span>
          </div>)}
        </div>
      </div>, popup.host,
    )}
  </span>
}
