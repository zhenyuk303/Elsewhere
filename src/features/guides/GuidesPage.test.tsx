import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GuidesPage } from './GuidesPage'
import type { Guide, GuideDraft } from './guidesData'

vi.mock('./guidesData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./guidesData')>()
  const guidesByOwner = new Map<number, Map<string, Guide>>()

  return {
    ...actual,
    guideRepository: {
      async list(ownerId: number) {
        return [...(guidesByOwner.get(ownerId)?.values() ?? []), ...actual.sampleGuides]
      },
      async save(ownerId: number, draft: GuideDraft, id?: string) {
        const guides = guidesByOwner.get(ownerId) ?? new Map<string, Guide>()
        const guide = { ...draft, id: id ?? `guide-${guides.size + 1}` }
        guides.set(guide.id, guide)
        guidesByOwner.set(ownerId, guides)
        return guide
      },
    },
  }
})

it('keeps an unfinished guide in drafts until its itinerary is ready to publish', async () => {
  const title = 'A morning walk above the city'
  const publishedCard = `Read guide: ${title}`
  render(<GuidesPage ownerId={1} />)

  const addGuide = screen.getByRole('button', { name: 'Add guide' })
  await waitFor(() => expect(addGuide).toBeEnabled())
  fireEvent.click(addGuide)

  const editor = within(screen.getByRole('dialog', { name: 'Add a guide' }))
  fireEvent.change(editor.getByRole('textbox', { name: 'Title' }), { target: { value: title } })
  fireEvent.change(editor.getByRole('combobox', { name: 'Province' }), { target: { value: 'Beijing' } })
  fireEvent.change(editor.getByRole('combobox', { name: 'City' }), { target: { value: 'Dongcheng' } })
  fireEvent.change(editor.getByRole('textbox', { name: /^Tags/ }), { target: { value: 'Walking, Viewpoints' } })
  fireEvent.change(editor.getByLabelText('Place'), { target: { value: 'Jingshan Park' } })
  fireEvent.change(editor.getByLabelText('Start'), { target: { value: '08:30' } })
  fireEvent.change(editor.getByLabelText('End'), { target: { value: '08:00' } })
  await act(async () => {
    fireEvent.click(editor.getByRole('button', { name: 'Save draft' }))
  })

  const drafts = within(await screen.findByRole('list', { name: 'Saved drafts' }))
  expect(screen.queryByRole('button', { name: publishedCard })).not.toBeInTheDocument()
  fireEvent.click(drafts.getByRole('button', { name: /a morning walk above the city/i }))

  const reopened = within(screen.getByRole('dialog', { name: 'Edit guide' }))
  expect(reopened.getByRole('textbox', { name: 'Title' })).toHaveValue(title)
  expect(reopened.getByLabelText('Place')).toHaveValue('Jingshan Park')
  expect(reopened.getByLabelText('Start')).toHaveValue('08:30')
  const publish = reopened.getByRole('button', { name: 'Publish' })
  const end = reopened.getByLabelText('End')
  expect(end).toHaveValue('08:00')
  fireEvent.click(publish)
  expect(reopened.getByRole('alert')).toHaveTextContent(/the end time must be later than the start/i)
  expect(end).toHaveFocus()

  fireEvent.change(end, { target: { value: '10:00' } })
  fireEvent.change(reopened.getByLabelText('Tips'), { target: { value: 'Bring a light jacket.' } })
  await act(async () => {
    fireEvent.click(publish)
  })

  expect(await screen.findByRole('button', { name: publishedCard })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: 'Drafts (1)' })).not.toBeInTheDocument()
  const reader = within(screen.getByRole('region', { name: 'Guide details' }))
  const itinerary = within(reader.getByRole('region', { name: 'Itinerary' }))
  expect(itinerary.getByRole('heading', { name: 'Day 1' })).toBeVisible()
  expect(itinerary.getByRole('heading', { name: 'Jingshan Park' })).toBeVisible()
  expect(itinerary.getByText('08:30')).toHaveAttribute('datetime', '08:30')
  expect(itinerary.getByText('10:00')).toHaveAttribute('datetime', '10:00')
  expect(itinerary.getByText('Bring a light jacket.')).toBeVisible()
  const tags = within(reader.getByRole('list', { name: 'Tags' }))
  expect(tags.getByText('Walking')).toBeVisible()
  expect(tags.getByText('Viewpoints')).toBeVisible()
})
