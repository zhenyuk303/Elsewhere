import { useEffect, useRef, useState, type FormEvent } from 'react'
import './community-messages.css'

const friends = [
  { id: 'maya', name: 'Maya Chen', initials: 'MC' },
  { id: 'leo', name: 'Leo Park', initials: 'LP' },
  { id: 'nina', name: 'Nina Wu', initials: 'NW' },
  { id: 'alex', name: 'Alex Lin', initials: 'AL' },
] as const
type FriendId = typeof friends[number]['id']
type Message = { id: string; text: string; sentAt: number }
type Threads = Record<FriendId, Message[]>
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function storageKey(ownerId: number) {
  return `elsewhere:community:messages:v1:${ownerId}`
}

function emptyThreads(): Threads {
  return { maya: [], leo: [], nina: [], alex: [] }
}

function readThreads(ownerId: number): { threads: Threads; error: string } {
  const threads = emptyThreads()
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId))
    if (!raw) return { threads, error: '' }
    const saved: unknown = JSON.parse(raw)
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error()
    for (const friend of friends) {
      const messages: unknown = (saved as Record<string, unknown>)[friend.id]
      if (messages === undefined) continue
      if (!Array.isArray(messages)) throw new Error()
      threads[friend.id] = messages.filter((message): message is Message => {
        if (!message || typeof message !== 'object') return false
        return typeof message.id === 'string' && typeof message.text === 'string'
          && typeof message.sentAt === 'number' && Number.isFinite(message.sentAt)
          && !Number.isNaN(new Date(message.sentAt).getTime())
      })
    }
    return { threads, error: '' }
  } catch {
    return { threads: emptyThreads(), error: 'Saved messages could not be read in this browser.' }
  }
}

export function CommunityMessages({ ownerId }: { ownerId: number }) {
  return <MessageWorkspace key={ownerId} ownerId={ownerId} />
}

function MessageWorkspace({ ownerId }: { ownerId: number }) {
  const [initial] = useState(() => readThreads(ownerId))
  const [threads, setThreads] = useState(initial.threads)
  const [selected, setSelected] = useState<FriendId>('maya')
  const [drafts, setDrafts] = useState<Partial<Record<FriendId, string>>>({})
  const [error, setError] = useState(initial.error)
  const timeline = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const friend = friends.find(candidate => candidate.id === selected)!
  const messages = threads[selected]
  const draft = drafts[selected] ?? ''

  useEffect(() => {
    const element = timeline.current
    if (element) element.scrollTop = element.scrollHeight
  }, [selected, messages.length])

  function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) return
    const id = Array.from(crypto.getRandomValues(new Uint32Array(3)), value => value.toString(16)).join('-')
    const message = { id, text, sentAt: Date.now() }
    const next = { ...threads, [selected]: [...messages, message] }
    try {
      window.localStorage.setItem(storageKey(ownerId), JSON.stringify(next))
      setError('')
    } catch {
      setError('This message is visible for this visit. Browser storage is full or unavailable.')
    }
    setThreads(next)
    setDrafts(current => ({ ...current, [selected]: '' }))
    composer.current?.focus({ preventScroll: true })
  }

  return <section className="community-messages" aria-label="Messages">
    <aside className="community-message-sidebar" aria-label="Demo friends">
      <div className="community-message-sidebar-head">
        <h2>Friends</h2>
        <span>Local demo</span>
      </div>
      <ul className="community-message-friends">
        {friends.map(contact => {
          const lastMessage = threads[contact.id].at(-1)
          return <li key={contact.id}>
            <button type="button" className="community-message-friend" aria-pressed={selected === contact.id}
              onClick={() => setSelected(contact.id)}>
              <span className="community-message-avatar" aria-hidden="true">{contact.initials}</span>
              <span className="community-message-friend-copy">
                <strong>{contact.name}</strong>
                <span>{lastMessage ? `You: ${lastMessage.text}` : 'No messages yet'}</span>
              </span>
            </button>
          </li>
        })}
      </ul>
    </aside>

    <div className="community-message-chat">
      <header className="community-message-chat-head">
        <div><h3>{friend.name}</h3><p>Demo chat · saved in this browser</p></div>
        <span className="community-message-avatar" aria-hidden="true">{friend.initials}</span>
      </header>
      <div ref={timeline} className="community-message-timeline" role="log"
        aria-label={`Conversation with ${friend.name}`} aria-live="polite" aria-relevant="additions" tabIndex={0}>
        {messages.length ? messages.map(message => <article className="community-message-entry" key={message.id}
          aria-label={`You, ${dateFormat.format(message.sentAt)}`}>
          <p>{message.text}</p>
          <time dateTime={new Date(message.sentAt).toISOString()}>{dateFormat.format(message.sentAt)}</time>
        </article>) : <div className="community-message-empty">
          <p>No messages yet</p>
          <span>Try a message here. It stays in this local demo.</span>
        </div>}
      </div>
      <form className="community-message-composer" onSubmit={send}>
        <label htmlFor={`community-message-${ownerId}`}>Message to {friend.name}</label>
        <textarea ref={composer} id={`community-message-${ownerId}`} value={draft} rows={3}
          placeholder="Write a message…" maxLength={4000}
          onChange={event => setDrafts(current => ({ ...current, [selected]: event.target.value }))}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send()
            }
          }} />
        <div className="community-message-send-row">
          <span>Enter to send · Shift + Enter for a new line</span>
          <button type="submit" disabled={!draft.trim()}>Send</button>
        </div>
        <p className="community-message-storage" role="status">{error}</p>
      </form>
    </div>
  </section>
}
