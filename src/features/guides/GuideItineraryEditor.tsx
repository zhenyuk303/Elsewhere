import { useState, type DragEvent } from 'react'
import type { GuideDay, GuideStop } from './guidesData'
import './guide-itinerary-editor.css'

function newId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('')
}

function newGuideStop(): GuideStop {
  return { id: newId(), start: '09:00', end: '12:00', place: '', notes: '', tips: '', photos: [] }
}

export function newGuideDay(): GuideDay {
  return { id: newId(), stops: [newGuideStop()] }
}

type Props = {
  days: GuideDay[]
  onChange: (days: GuideDay[]) => void
  onAttach: (dayId: string, stopId: string, files: File[]) => void
}

export function GuideItineraryEditor({ days, onChange, onAttach }: Props) {
  const [draggedOver, setDraggedOver] = useState<string | null>(null)

  function updateStop(dayId: string, stopId: string, change: Partial<GuideStop>) {
    onChange(days.map(day => day.id === dayId
      ? { ...day, stops: day.stops.map(stop => stop.id === stopId ? { ...stop, ...change } : stop) }
      : day))
  }

  function drop(event: DragEvent<HTMLDivElement>, dayId: string, stopId: string) {
    event.preventDefault()
    setDraggedOver(null)
    if (event.currentTarget.closest('fieldset[disabled]')) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length) onAttach(dayId, stopId, files)
  }

  return <section className="guide-itinerary" aria-label="Daily itinerary">
    {days.map((day, dayIndex) => <fieldset className="guide-itinerary-day" key={day.id}>
      <legend>Day {dayIndex + 1}</legend>
      {days.length > 1 && <button type="button" className="guide-itinerary-remove-day"
        aria-label={`Remove day ${dayIndex + 1}`}
        onClick={() => onChange(days.filter(candidate => candidate.id !== day.id))}>Remove day</button>}
      <div className="guide-itinerary-stops">
        {day.stops.map((stop, stopIndex) => {
          const fieldId = `guide-stop-${stop.id}`
          const context = `Day ${dayIndex + 1}, item ${stopIndex + 1}`
          const timeLabel = `${fieldId}-time-label`
          return <div className="guide-itinerary-stop" key={stop.id} role="group" aria-label={context}>
            <div className="guide-itinerary-stop-head">
              <h4>Item {stopIndex + 1}</h4>
              {day.stops.length > 1 && <button type="button" className="guide-itinerary-remove"
                aria-label={`Remove ${context.toLowerCase()}`}
                onClick={() => onChange(days.map(candidate => candidate.id === day.id
                  ? { ...candidate, stops: candidate.stops.filter(item => item.id !== stop.id) }
                  : candidate))}>Remove item</button>}
            </div>
            <div className="guide-itinerary-place-time">
              <label className="guide-itinerary-field" htmlFor={`${fieldId}-place`}>
                Place
                <input id={`${fieldId}-place`} name={`${fieldId}-place`} value={stop.place}
                  placeholder="Place name" onChange={event => updateStop(day.id, stop.id, { place: event.target.value })} />
              </label>
              <div className="guide-itinerary-field">
                <span id={timeLabel}>Time</span>
                <div className="guide-itinerary-time" role="group" aria-labelledby={timeLabel}>
                  <label className="guide-itinerary-time-label" htmlFor={`${fieldId}-start`}>
                    <span>Start</span>
                    <input type="time" id={`${fieldId}-start`} name={`${fieldId}-start`} value={stop.start}
                      onChange={event => updateStop(day.id, stop.id, { start: event.target.value })} />
                  </label>
                  <span className="guide-itinerary-time-divider" aria-hidden="true">–</span>
                  <label className="guide-itinerary-time-label" htmlFor={`${fieldId}-end`}>
                    <span>End</span>
                    <input type="time" id={`${fieldId}-end`} name={`${fieldId}-end`} value={stop.end}
                      onChange={event => updateStop(day.id, stop.id, { end: event.target.value })} />
                  </label>
                </div>
              </div>
            </div>
            <label className="guide-itinerary-field" htmlFor={`${fieldId}-notes`}>
              Notes
              <textarea id={`${fieldId}-notes`} name={`${fieldId}-notes`} value={stop.notes} rows={3}
                placeholder="What would you like to do here?"
                onChange={event => updateStop(day.id, stop.id, { notes: event.target.value })} />
            </label>
            <label className="guide-itinerary-field" htmlFor={`${fieldId}-tips`}>
              Tips
              <input id={`${fieldId}-tips`} name={`${fieldId}-tips`} value={stop.tips}
                placeholder="A practical detail to remember"
                onChange={event => updateStop(day.id, stop.id, { tips: event.target.value })} />
            </label>
            <div className="guide-itinerary-photos" data-dragging={draggedOver === stop.id}
              onDragOver={event => {
                if (!Array.from(event.dataTransfer.types).includes('Files')) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
                setDraggedOver(stop.id)
              }} onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggedOver(null)
              }} onDrop={event => drop(event, day.id, stop.id)}>
              {stop.photos.length > 0 && <ul className="guide-itinerary-photo-list">
                {stop.photos.map((photo, photoIndex) => <li key={photoIndex}>
                  <img src={photo} alt={`${stop.place || context}, photo ${photoIndex + 1}`} loading="lazy" decoding="async" />
                  <button type="button" aria-label={`Remove photo ${photoIndex + 1} from ${context.toLowerCase()}`}
                    onClick={() => updateStop(day.id, stop.id, { photos: stop.photos.filter((_, index) => index !== photoIndex) })}>×</button>
                </li>)}
              </ul>}
              <label className="guide-itinerary-attach" htmlFor={`${fieldId}-photos`}>
                <input type="file" id={`${fieldId}-photos`} accept="image/*" multiple
                  aria-label={`Add photos to ${context.toLowerCase()}`}
                  onChange={event => {
                    const files = Array.from(event.currentTarget.files ?? [])
                    event.currentTarget.value = ''
                    if (files.length) onAttach(day.id, stop.id, files)
                  }} />
                <span aria-hidden="true">＋</span>
                <span>Add photos <span className="guide-itinerary-drop-hint">or drop images here</span></span>
              </label>
            </div>
          </div>
        })}
      </div>
      <button type="button" className="guide-itinerary-add-item"
        onClick={() => onChange(days.map(candidate => candidate.id === day.id
          ? { ...candidate, stops: [...candidate.stops, newGuideStop()] } : candidate))}>+ Add item</button>
    </fieldset>)}
    <button type="button" className="guide-itinerary-add-day"
      onClick={() => onChange([...days, newGuideDay()])}>+ Add day</button>
  </section>
}
