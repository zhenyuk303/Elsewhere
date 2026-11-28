import { useEffect, useRef, useState } from 'react'
import { CommunityComposer } from './CommunityComposer'
import { CommunityIcon } from './CommunityIcon'
import { CommunityMessages } from './CommunityMessages'
import { CommunityPostCard, CommunityPostReader, formatCommunityDate } from './CommunityPost'
import { communityRepository, sampleCommunityPosts, type CommunityDraft,
  type CommunityDraftFields, type CommunityLibrary, type CommunityPost } from './communityData'
import './community.css'

const sections = [
  { id: 'messages', label: 'Messages' },
  { id: 'mine', label: 'My posts' },
  { id: 'feed', label: 'Community home' },
  { id: 'likes', label: 'My likes' },
  { id: 'search', label: 'Search' },
] as const

type Section = typeof sections[number]['id']
const emptyLibrary: CommunityLibrary = { posts: [], drafts: [], likedIds: [] }

function matchesPost(post: CommunityPost, query: string) {
  const searchable = [post.title, post.body, post.attachment?.body, post.author, post.city, post.province]
    .join(' ').normalize('NFKC').toLowerCase()
  return query.trim().normalize('NFKC').toLowerCase().split(/\s+/).every(term => searchable.includes(term))
}

export function CommunityPage({ ownerId, username }: { ownerId: number; username: string }) {
  const [section, setSection] = useState<Section>('feed')
  const [library, setLibrary] = useState(emptyLibrary)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [reading, setReading] = useState<{ id: string; anchor: HTMLButtonElement }>()
  const [composer, setComposer] = useState<{ anchor: HTMLButtonElement; draft?: CommunityDraft }>()
  const heading = useRef<HTMLHeadingElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const pendingLikes = useRef(new Set<string>())

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    let active = true
    communityRepository.list(ownerId).then(data => {
      if (active) setLibrary(data)
    }).catch(() => {
      if (active) setNotice('Saved community activity could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [ownerId])

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0
    if (section === 'search') search.current?.focus({ preventScroll: true })
  }, [section])

  const allPosts = [...library.posts, ...sampleCommunityPosts]
  const liked = new Set(library.likedIds)
  const visible = section === 'mine' ? library.posts
    : section === 'likes' ? allPosts.filter(post => liked.has(post.id))
    : section === 'search' ? (query.trim() ? allPosts.filter(post => matchesPost(post, query)) : [])
    : allPosts
  const openedPost = reading && allPosts.find(post => post.id === reading.id)
  const label = section === 'feed' ? 'Community' : sections.find(option => option.id === section)?.label

  async function toggleLike(id: string) {
    if (loading || pendingLikes.current.has(id)) return
    pendingLikes.current.add(id)
    try {
      const isLiked = await communityRepository.toggleLike(ownerId, id)
      setLibrary(current => ({ ...current,
        likedIds: isLiked ? [...new Set([...current.likedIds, id])] : current.likedIds.filter(likedId => likedId !== id) }))
      setNotice('')
    } catch {
      setNotice('This like could not be saved.')
    } finally {
      pendingLikes.current.delete(id)
    }
  }

  function restoreFocus(anchor: HTMLElement) {
    if (anchor.isConnected) anchor.focus({ preventScroll: true })
    else heading.current?.focus({ preventScroll: true })
  }

  function dismissComposer() {
    if (composer) restoreFocus(composer.anchor)
    setComposer(undefined)
  }

  async function saveDraft(fields: CommunityDraftFields, id?: string) {
    const draft = await communityRepository.saveDraft(ownerId, fields, id)
    return () => {
      setLibrary(current => ({ ...current, drafts: [draft, ...current.drafts.filter(item => item.id !== draft.id)] }))
      setNotice('Draft saved.')
    }
  }

  async function publish(fields: CommunityDraftFields, id?: string) {
    const post = await communityRepository.publish(ownerId, username, fields, id)
    return () => {
      setLibrary(current => ({ ...current, drafts: current.drafts.filter(draft => draft.id !== id),
        posts: [post, ...current.posts] }))
      setNotice('Post published in this browser.')
    }
  }

  return <section className="community-page" aria-labelledby="community-title">
    <header className="community-heading">
      <h1 id="community-title" tabIndex={-1} ref={heading}>{label}</h1>
    </header>
    <nav className="community-rail" aria-label="Community navigation">
      {sections.map(option => (
        <button type="button" key={option.id} className="community-rail-item"
          aria-label={option.label} aria-pressed={section === option.id} title={option.label}
          onClick={() => { setSection(option.id); setNotice('') }}>
          <CommunityIcon name={option.id} />
        </button>
      ))}
    </nav>
    <div className="community-workspace">
      {section === 'messages' ? <CommunityMessages ownerId={ownerId} /> : (
        <>
          {section === 'mine' && (
            <div className="community-toolbar">
              <button type="button" className="community-add" aria-label="New post" disabled={loading}
                onClick={event => setComposer({ anchor: event.currentTarget })}>
                <CommunityIcon name="plus" />
                <span>New post</span>
              </button>
            </div>
          )}
          {section === 'search' && (
            <div className="community-toolbar community-search-toolbar" role="search">
              <label className="community-search">
                <span className="community-sr-only">Search community posts</span>
                <input ref={search} type="search" value={query} placeholder="Search by title, place or author"
                  onChange={event => setQuery(event.target.value)} />
                <CommunityIcon name="search" />
              </label>
            </div>
          )}
          <div className="community-scroll" ref={scroll} role="region" aria-label={section === 'search' ? 'Search results' : 'Posts'} tabIndex={0}>
            {section === 'mine' && library.drafts.length > 0 && (
              <section className="community-drafts" aria-labelledby="community-draft-title">
                <h2 id="community-draft-title">Drafts</h2>
                <ul>
                  {library.drafts.map(draft => (
                    <li key={draft.id}>
                      <button type="button" onClick={event => setComposer({ anchor: event.currentTarget, draft })}>
                        <span>{draft.title || draft.attachment?.title || 'Untitled draft'}</span>
                        <time dateTime={draft.updatedAt}>{formatCommunityDate(draft.updatedAt)}</time>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {visible.length ? (
              <div className="community-post-grid">
                {visible.map((post, index) => <CommunityPostCard key={post.id} post={post} liked={liked.has(post.id)} loading={loading}
                  priority={index < 6}
                  onLike={id => void toggleLike(id)} onOpen={(id, anchor) => setReading({ id, anchor })} />)}
              </div>
            ) : (
              <p className="community-empty">
                {loading ? 'Loading posts…' : section === 'mine' ? 'Your published posts will appear here.'
                  : section === 'likes' ? 'Tap a heart to keep a post here.'
                  : query.trim() ? 'No posts match your search.' : 'Find posts by title, place or author.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
    <p className={notice ? 'community-notice' : 'community-sr-only'} role="status">{notice}</p>
    {reading && openedPost && <CommunityPostReader post={openedPost} anchor={reading.anchor}
      liked={liked.has(openedPost.id)} loading={loading} onLike={id => void toggleLike(id)}
      onDismiss={() => { restoreFocus(reading.anchor); setReading(undefined) }} />}
    {composer && <CommunityComposer ownerId={ownerId} anchor={composer.anchor} draft={composer.draft}
      onDismiss={dismissComposer} onSaveDraft={saveDraft} onPublish={publish} />}
  </section>
}
