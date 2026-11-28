const iconPaths = {
  messages: 'M6 17.5 3.5 20v-4.3A3.7 3.7 0 0 1 2 12.8V7.5A3.5 3.5 0 0 1 5.5 4h13A3.5 3.5 0 0 1 22 7.5v6a4 4 0 0 1-4 4H6Z M7 10.75h.05m4.925 0h.05m4.925 0H17',
  mine: 'M7 4.5h10m-8-2h6m-9 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Zm2 5.5h8m-8 4h5',
  feed: 'm3 10 9-7.5 9 7.5m-16-1v11h5v-6h4v6h5V9',
  likes: 'M20.8 13.1 12 21l-8.8-7.9A5.25 5.25 0 0 1 12 7.4a5.25 5.25 0 0 1 8.8 5.7Z',
  search: 'M10.8 18a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Zm5.2-2 4.5 4.5',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  pin: 'M19.5 9.5c0 5.4-7.5 11-7.5 11s-7.5-5.6-7.5-11a7.5 7.5 0 0 1 15 0ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
}

export function CommunityIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={iconPaths[name]} />
  </svg>
}
