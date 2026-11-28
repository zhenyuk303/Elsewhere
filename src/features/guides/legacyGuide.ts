import type { Guide, GuideStop } from './guidesData'

type StopTimes = Pick<GuideStop, 'start' | 'end'>
type StopContent = Pick<GuideStop, 'start' | 'end' | 'place' | 'notes' | 'tips'>
type SampleStop = StopTimes & { place: string; phrase: string }

const suggestedTimes: StopTimes = { start: '09:00', end: '10:00' }
const dayHeading = /^(?:#{1,6}\s*)?(?:day\s+\d+|第\s*[零〇一二三四五六七八九十百0-9]+\s*[天日])(?=$|[\s:：–—-])/i
const timeRange = /^(?:(?:[-*]|\d+[.)])\s+)?(?:\*\*)?\[?([01]?\d|2[0-3]):([0-5]\d)\s*(?:[-–—~至到]|\bto\b)\s*([01]?\d|2[0-3]):([0-5]\d)(?!\d)/i
const tipLine = /^(?:[-*]\s+)?(?:\*\*)?(?:tips?|提示)\s*[:：]\s*(?:\*\*)?\s*(.+)$/i

const sampleStops: Record<string, SampleStop[]> = {
  'sample-beijing-dongcheng': [
    { place: 'Jingshan Park', phrase: 'Jingshan Park', start: '08:30', end: '09:45' },
    { place: 'Drum Tower and Bell Tower', phrase: 'Drum Tower', start: '10:00', end: '11:15' },
    { place: 'Dongcheng lanes', phrase: 'break for tea', start: '11:15', end: '12:00' },
  ],
  'sample-beijing-xicheng': [
    { place: 'Beihai Park', phrase: 'Beihai Park', start: '09:00', end: '10:30' },
    { place: 'Shichahai', phrase: 'Shichahai', start: '11:00', end: '12:30' },
    { place: 'Shichahai lakeside', phrase: 'along the lakeside', start: '14:00', end: '15:00' },
  ],
  'sample-shanghai-bund': [
    { place: 'The Bund', phrase: 'the Bund', start: '16:45', end: '17:30' },
    { place: 'Waibaidu Bridge', phrase: 'Waibaidu Bridge', start: '17:30', end: '18:15' },
    { place: 'Huangpu River waterfront', phrase: 'both banks', start: '18:15', end: '19:00' },
  ],
  'sample-zhejiang-west-lake': [
    { place: 'Beishan Road', phrase: 'Beishan Road', start: '09:00', end: '10:15' },
    { place: 'Bai Causeway', phrase: 'Bai Causeway', start: '10:30', end: '11:45' },
    { place: 'West Lake shoreline', phrase: 'pause by the shore', start: '12:00', end: '12:45' },
  ],
  'sample-sichuan-jiuzhaigou': [
    { place: 'Five Flower Lake', phrase: 'Five Flower Lake', start: '09:00', end: '10:30' },
    { place: 'Jiuzhaigou waterfalls', phrase: 'waterfalls', start: '11:00', end: '12:15' },
    { place: 'Jiuzhaigou marked paths', phrase: 'marked paths', start: '13:00', end: '14:00' },
  ],
  'sample-yunnan-dali': [
    { place: 'Dali Old Town', phrase: 'old town', start: '09:00', end: '11:00' },
    { place: 'Erhai shoreline', phrase: 'Erhai shoreline', start: '14:00', end: '15:30' },
    { place: 'Erhai lakeside', phrase: 'across the lake', start: '15:30', end: '16:00' },
  ],
}

const tagSignals: [string, RegExp][] = [
  ['Walking', /\b(?:walk(?:s|ing)?|on foot|lanes|paths)\b|步行|徒步|散步/i],
  ['Photography', /\b(?:photograph(?:s|y)?|camera|photos?)\b|摄影|拍照/i],
  ['Waterfront', /\b(?:lake(?:s|side)?|river(?:s|side)?|waterfront|shoreline)\b|水岸|湖边|江边/i],
  ['Heritage', /\b(?:palace|temple|pagoda|historic|old town)\b|古城|故宫|古镇|寺庙/i],
  ['Mountains', /\b(?:mountains?|ridge|hiking)\b|山脊|山峰|登山/i],
  ['Food', /\b(?:street food|restaurant|dinner|lunch|tea)\b|美食|小吃/i],
]

function cityFromPlace(place: string, province: string) {
  const location = place.trim()
  const region = province.trim()
  if (!region || !location.toLowerCase().endsWith(region.toLowerCase())) return location

  const prefix = location.slice(0, -region.length)
  return /[\s,，]$/.test(prefix) ? prefix.replace(/[\s,，]+$/, '') : location
}

function readTimedStop(line: string): (StopTimes & { place?: string }) | undefined {
  const content = line.trim()
  const match = timeRange.exec(content.replace(/[０-９：～［]/g, character => character.normalize('NFKC')))
  if (!match) return undefined

  const [, startHour, startMinute, endHour, endMinute] = match
  const start = `${startHour.padStart(2, '0')}:${startMinute}`
  const end = `${endHour.padStart(2, '0')}:${endMinute}`
  if (start >= end) return undefined

  const label = content.slice(match[0].length).replace(/^\s*[\]］]?\s*(?:\*\*)?\s*[:：|–—-]?\s*/, '').trim()
  if (/^(?:a\.?m\.?|p\.?m\.?)(?:\s|$)/i.test(label)) return undefined
  const place = label.length <= 100 && !/[.!?。！？;；](?:\s|$)/.test(label) ? label || undefined : undefined
  return { start, end, place }
}

function splitDays(body: string): string[][] {
  const days: string[][] = []
  let lines: string[] = []
  let foundHeading = false
  for (const line of body.split(/\r?\n/)) {
    if (dayHeading.test(line.trim().normalize('NFKC'))) {
      if (foundHeading) {
        days.push(lines)
        lines = []
      }
      foundHeading = true
    }
    lines.push(line)
  }
  return [...days, lines]
}

function stopsFromLines(lines: string[], place: string): StopContent[] {
  const stops: StopContent[] = []
  let timedStop: ReturnType<typeof readTimedStop>
  let notes: string[] = []
  let tips: string[] = []

  function finishStop() {
    stops.push({
      ...(timedStop ?? suggestedTimes),
      place: timedStop?.place ?? place,
      notes: notes.join('\n').trim(),
      tips: tips.join(' '),
    })
    notes = []
    tips = []
  }

  for (const line of lines) {
    const nextStop = readTimedStop(line)
    if (nextStop) {
      if (timedStop) finishStop()
      timedStop = nextStop
    }
    const tip = tipLine.exec(line.trim())?.[1].trim()
    if (tip) tips.push(tip)
    else notes.push(line)
  }
  finishStop()
  return stops
}

function buildSampleStops(guide: Guide): StopContent[] | undefined {
  if (!Object.hasOwn(sampleStops, guide.id)) return undefined
  const plan = sampleStops[guide.id]

  const paragraphs = guide.body.trim().split(/\r?\n\s*\r?\n/)
  if (plan.length !== paragraphs.length || !plan.every(({ phrase }, index) => paragraphs[index].includes(phrase))) {
    return undefined
  }
  return plan.map(({ start, end, place }, index) => ({ start, end, place, notes: paragraphs[index], tips: '' }))
}

export function upgradeLegacyGuide(guide: Guide): Guide {
  if (guide.itinerary !== undefined) return guide

  const city = guide.city ?? cityFromPlace(guide.place, guide.province)
  const place = city || guide.place.trim() || guide.province.trim() || 'Stop details'
  const tagText = `${guide.title} ${guide.body}`
  const tags = guide.tags ?? tagSignals.filter(([, signal]) => signal.test(tagText)).slice(0, 3).map(([tag]) => tag)
  const sample = buildSampleStops(guide)
  const days = sample ? [sample] : splitDays(guide.body).map(lines => stopsFromLines(lines, place))
  const itinerary = days.map((stops, dayIndex) => {
    const id = `${guide.id}-day-${dayIndex + 1}`
    return {
      id,
      stops: stops.map((stop, index): GuideStop => ({ ...stop, id: `${id}-stop-${index + 1}`, photos: [] })),
    }
  })

  return { ...guide, city, tags, itinerary, itinerarySource: 'generated' }
}
