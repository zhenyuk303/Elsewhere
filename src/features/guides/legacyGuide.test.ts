import { sampleGuides, type Guide } from './guidesData'
import { upgradeLegacyGuide } from './legacyGuide'

const legacyGuide: Guide = {
  id: 'custom-route',
  title: 'A walk by the water',
  province: 'Zhejiang',
  place: 'Hangzhou, Zhejiang',
  body: 'Take your time along the shoreline.\n\nLeave some time for photographs.',
  cover: '/cover.webp',
  photos: ['/lake.webp'],
}

describe('legacy guide conversion', () => {
  it('retains the original prose and assets while building a stable stop for an unstructured guide', () => {
    const upgraded = upgradeLegacyGuide(legacyGuide)

    expect(upgraded).toMatchObject({
      ...legacyGuide,
      city: 'Hangzhou',
      tags: ['Walking', 'Photography', 'Waterfront'],
      itinerarySource: 'generated',
      itinerary: [
        {
          id: 'custom-route-day-1',
          stops: [{ id: 'custom-route-day-1-stop-1', place: 'Hangzhou', notes: legacyGuide.body }],
        },
      ],
    })
    expect(upgradeLegacyGuide(upgraded)).toBe(upgraded)
  })

  it('picks up day headings, times, stop labels and tips from English and Chinese text', () => {
    const body = [
      'Day 1: A walk by the river',
      '9:15–10:30 Riverside path',
      'Tips: Pack a light jacket.',
      '11:00 to 12:45 Follow the riverbank.',
      '第二天：湖边',
      '１４：００至１５：３０ — 湖边步道',
      '提示：带上水。',
    ].join('\n')
    const guide = upgradeLegacyGuide({ ...legacyGuide, body, tags: ['My route'] })

    expect(guide.itinerary?.map(day => day.stops.map(({ start, end, place, notes, tips }) => ({ start, end, place, notes, tips })))).toEqual([
      [
        { start: '09:15', end: '10:30', place: 'Riverside path', notes: 'Day 1: A walk by the river\n9:15–10:30 Riverside path', tips: 'Pack a light jacket.' },
        { start: '11:00', end: '12:45', place: 'Hangzhou', notes: '11:00 to 12:45 Follow the riverbank.', tips: '' },
      ],
      [{ start: '14:00', end: '15:30', place: '湖边步道', notes: '第二天：湖边\n１４：００至１５：３０ — 湖边步道', tips: '带上水。' }],
    ])
    expect(guide.body).toBe(body)
    expect(guide.tags).toEqual(['My route'])
  })

  it('uses named routes from the bundled text and leaves a modern draft intact', () => {
    const expectedFirstStops: Record<string, string> = {
      'sample-beijing-dongcheng': 'Jingshan Park',
      'sample-beijing-xicheng': 'Beihai Park',
      'sample-shanghai-bund': 'The Bund',
      'sample-zhejiang-west-lake': 'Beishan Road',
      'sample-sichuan-jiuzhaigou': 'Five Flower Lake',
      'sample-yunnan-dali': 'Dali Old Town',
    }
    for (const guide of sampleGuides) {
      const upgraded = upgradeLegacyGuide(guide)
      expect(upgraded.itinerary?.[0].stops[0].place).toBe(expectedFirstStops[guide.id])
      expect(upgraded.itinerary?.[0].stops.map(stop => stop.notes)).toEqual(guide.body.split('\n\n'))
    }

    const updatedSample = { ...legacyGuide, id: 'sample-beijing-dongcheng' }
    expect(upgradeLegacyGuide(updatedSample).itinerary?.[0].stops[0].place).toBe('Hangzhou')

    const draft: Guide = { ...legacyGuide, status: 'draft', itinerary: [] }
    expect(upgradeLegacyGuide(draft)).toBe(draft)
  })
})
