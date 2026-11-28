import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAnchoredDialog } from './useAnchoredDialog'

function fakeAnimation() {
  return {
    playState: 'running',
    currentTime: 95,
    onfinish: null as (() => void) | null,
    cancel: vi.fn(),
    reverse: vi.fn(),
  }
}

function setup(reducedMotion = false) {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(700, 100, 96, 36))
  vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }))
  const enter = fakeAnimation()
  const exit = fakeAnimation()
  const animate = vi.fn().mockReturnValueOnce(enter).mockReturnValueOnce(exit)
  const onClose = vi.fn()
  const onSave = vi.fn()

  function TestDialog() {
    const { dialogRef, close, backdropProps } = useAnchoredDialog({ anchor, onClose })
    return (
      <dialog aria-label="Editor" {...backdropProps} ref={element => {
        dialogRef.current = element
        if (!element) return
        element.animate = animate
        element.getBoundingClientRect = () => new DOMRect(200, 150, 500, 600)
      }}>
        <button onClick={() => close(onSave)}>Save</button>
      </dialog>
    )
  }

  render(<TestDialog />)
  return { animate, enter, exit, onClose, onSave }
}

afterEach(() => vi.unstubAllGlobals())

describe('anchored dialog motion', () => {
  it('reveals a rounded sheet at full form size', () => {
    const { animate } = setup()
    const [frames, options] = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(options.duration).toBeLessThan(300)
    expect(frames[0]).toMatchObject({ transform: 'translate(0px, -41px)' })
    expect(frames.every(frame => frame.clipPath?.toString().startsWith('inset('))).toBe(true)
    expect(frames.every(frame => !frame.transform?.toString().includes('scale'))).toBe(true)
    expect(frames[1].transform).not.toBe(frames[0].transform)
    expect(frames.at(-1)?.transform).toBe('translate(0px, 0px)')
  })

  it('keeps the modal open and inert until it retracts to its trigger', () => {
    const { animate, enter, exit, onClose, onSave } = setup()
    const dialog = screen.getByRole('dialog')
    expect(animate).toHaveBeenCalledTimes(1)
    enter.onfinish?.()
    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)
    expect(animate).toHaveBeenCalledTimes(2)
    expect(dialog).toHaveAttribute('open')
    expect(dialog.inert).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
    exit.onfinish?.()
    expect(dialog).not.toHaveAttribute('open')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reverses a still-opening modal from its current position', () => {
    const { animate, enter, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(enter.reverse).toHaveBeenCalledTimes(1)
    expect(animate).toHaveBeenCalledTimes(1)
    enter.onfinish?.()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('retracts on a backdrop click and ignores clicks inside or drags across the panel edge', () => {
    const { animate, enter, exit, onClose, onSave } = setup()
    const dialog = screen.getByRole('dialog')
    const inside = { clientX: 225, clientY: 200 }
    const outside = { clientX: 50, clientY: 80 }
    enter.onfinish?.()

    fireEvent.pointerDown(dialog, inside)
    fireEvent.click(dialog, inside)
    fireEvent.pointerDown(dialog, inside)
    fireEvent.click(dialog, outside)
    expect(animate).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(dialog, outside)
    fireEvent.click(dialog, outside)
    expect(animate).toHaveBeenCalledTimes(2)
    expect(dialog).toHaveAttribute('open')
    exit.onfinish?.()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('closes immediately when reduced motion is requested', () => {
    const { animate, onClose } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(animate).not.toHaveBeenCalled()
  })
})
