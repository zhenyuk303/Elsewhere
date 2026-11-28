import { fireEvent, render, screen } from '@testing-library/react'
import { GuideItineraryEditor, newGuideDay } from './GuideItineraryEditor'

it('attaches dropped images to the itinerary item that received them', () => {
  const day = newGuideDay()
  const stop = day.stops[0]
  const onAttach = vi.fn()
  render(<GuideItineraryEditor days={[day]} onChange={vi.fn()} onAttach={onAttach} />)

  const input = screen.getByLabelText('Add photos to day 1, item 1')
  const files = [new File(['test'], 'stop.webp', { type: 'image/webp' })]
  fireEvent.drop(input, { dataTransfer: { files } })

  expect(onAttach).toHaveBeenCalledOnce()
  expect(onAttach).toHaveBeenCalledWith(day.id, stop.id, files)
})
