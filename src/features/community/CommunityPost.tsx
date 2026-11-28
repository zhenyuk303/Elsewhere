import { useId, type MouseEvent } from 'react'
import { useAnchoredDialog } from '../../components/useAnchoredDialog'
import { CommunityIcon } from './CommunityIcon'
import type { CommunityPost as Post } from './communityData'

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function formatCommunityDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Date unavailable' : dateFormat.format(date)
}

function postPhotos(post: Post) {
  return post.photos.length ? post.photos : post.attachment?.photos ?? []
}

function PostLocation({ post }: { post: Post }) {
  return <span className="community-post-location">
    <time dateTime={post.publishedAt}>{formatCommunityDate(post.publishedAt)}</time>
    <span>{post.city || post.province || 'Location not set'}</span>
  </span>
}

type LikeProps = { post: Post; liked: boolean; onLike: (id: string) => void; loading: boolean }

function LikeButton({ post, liked, onLike, loading }: LikeProps) {
  return <button type="button" className="community-like" aria-pressed={liked} disabled={loading}
    aria-label={`Like ${post.title}`} onClick={() => onLike(post.id)}>
    <CommunityIcon name="likes" />
    <span>{post.likeCount + Number(liked)}</span>
  </button>
}

export function CommunityPostCard({ post, liked, onLike, loading, priority, onOpen }: LikeProps & {
  priority: boolean
  onOpen: (postId: string, anchor: HTMLButtonElement) => void
}) {
  const photo = postPhotos(post)[0]

  function open(event: MouseEvent<HTMLButtonElement>) {
    onOpen(post.id, event.currentTarget)
  }

  return <article className="community-post-card">
    <button type="button" className="community-post-open" onClick={open} aria-label={`Read ${post.title}`}>
      <span className="community-post-cover">
        {photo ? <img src={photo.thumbnailSrc || photo.src} alt={photo.alt} loading={priority ? 'eager' : 'lazy'} decoding="async" /> :
          <span className="community-post-cover-placeholder"><CommunityIcon name="pin" /></span>}
      </span>
      <span className="community-post-copy">
        <span className="community-post-author">{post.author}</span>
        <span className="community-post-title">{post.title}</span>
        <PostLocation post={post} />
      </span>
    </button>
    <LikeButton post={post} liked={liked} onLike={onLike} loading={loading} />
  </article>
}

export function CommunityPostReader({ post, liked, onLike, loading, anchor, onDismiss }: LikeProps & {
  anchor: HTMLButtonElement
  onDismiss: () => void
}) {
  const headingId = useId()
  const { dialogRef, close, backdropProps } = useAnchoredDialog({
    anchor, onClose: onDismiss, initialFocus: '.community-reader-close', motion: 'card',
  })
  const [cover, ...photos] = postPhotos(post)

  return <dialog className="community-post-reader" aria-labelledby={headingId} ref={dialogRef}
    {...backdropProps} onCancel={event => { event.preventDefault(); close() }}>
    <div className="community-reader-scroll">
      {cover && <img className="community-reader-cover" src={cover.src} alt={cover.alt} decoding="async" />}
      <article className="community-reader-copy">
        <div className="community-reader-byline">
          <p>{post.author}</p>
          <LikeButton post={post} liked={liked} onLike={onLike} loading={loading} />
        </div>
        <h2 id={headingId}>{post.title}</h2>
        <PostLocation post={post} />
        {post.body && <p className="community-reader-body">{post.body}</p>}
        {post.attachment && (
          <>
            <span className="community-reader-source">
              {post.attachment.kind === 'guide' ? 'Shared guide' : 'Shared footprint'}
            </span>
            {post.attachment.body && <p className="community-reader-body">{post.attachment.body}</p>}
          </>
        )}
        {photos.length > 0 && <div className="community-reader-photos">
          {photos.map((photo, index) => <img key={index} src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />)}
        </div>}
      </article>
    </div>
    <button type="button" className="community-reader-close" aria-label="Close post" onClick={() => close()}>
      <CommunityIcon name="close" />
    </button>
  </dialog>
}
