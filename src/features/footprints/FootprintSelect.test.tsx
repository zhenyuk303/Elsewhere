import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { vi } from 'vitest'
import { FootprintSelect } from './FootprintSelect'

it('selects by keyboard and consumes the first Escape before the enclosing editor', () => {
  const editorKeyDown = vi.fn()
  function Example() {
    const [value, setValue] = useState('')
    return <div onKeyDown={editorKeyDown}>
      <FootprintSelect id="province" label="Province" value={value} onChange={setValue}
        options={[{ value: '', label: 'All provinces' }, { value: 'Anhui', label: 'Anhui' }, { value: 'Beijing', label: 'Beijing' }]} />
    </div>
  }
  render(<Example />)
  const trigger = screen.getByRole('combobox', { name: 'Province' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  fireEvent.keyDown(trigger, { key: 'b' })
  const beijing = screen.getByRole('option', { name: 'Beijing' })
  expect(trigger).toHaveAttribute('aria-activedescendant', beijing.id)
  fireEvent.keyDown(trigger, { key: 'Enter' })
  expect(trigger).toHaveTextContent('Beijing')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

  fireEvent.click(trigger)
  editorKeyDown.mockClear()
  fireEvent.keyDown(trigger, { key: 'Escape' })
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(editorKeyDown).not.toHaveBeenCalled()
  fireEvent.keyDown(trigger, { key: 'Escape' })
  expect(editorKeyDown).toHaveBeenCalledTimes(1)
})
