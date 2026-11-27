import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, parse } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'

const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'

function localFootprints(directory: string, account: string, thumbnails: string): Plugin {
  return {
    name: 'local-footprints',
    configureServer(server) {
      server.middlewares.use('/api/local-footprints', async (request, response) => {
        response.setHeader('Cache-Control', 'private, no-store')
        if (request.method !== 'GET' || !directory || !account || !request.headers.cookie) {
          response.writeHead(404).end()
          return
        }

        try {
          const session = await fetch(`${backend}/api/auth/me`, { headers: { cookie: request.headers.cookie } })
          const user = session.ok ? await session.json() as { id: number; username: string } : null
          if (user?.username !== account) {
            response.writeHead(404).end()
            return
          }

          const files = (await readdir(directory, { withFileTypes: true }))
            .filter(entry => entry.isFile() && /\.jpg$/i.test(entry.name))
            .map(entry => entry.name)
          const [pathname, query] = (request.url ?? '/').split('?')
          const file = decodeURIComponent(pathname.slice(1))
          if (!file) {
            response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ownerId: user.id, files }))
          } else if (files.includes(file)) {
            const original = join(directory, file)
            const thumbnail = thumbnails && new URLSearchParams(query).has('thumb') &&
              join(thumbnails, `${parse(file).name}.webp`)
            const thumbInfo = thumbnail ? await stat(thumbnail).catch(() => null) : null
            const useThumbnail = thumbInfo?.isFile() && thumbInfo.mtimeMs >= (await stat(original)).mtimeMs
            const image = createReadStream(useThumbnail ? String(thumbnail) : original)
            image.once('open', () => {
              response.writeHead(200, { 'Content-Type': useThumbnail ? 'image/webp' : 'image/jpeg' })
              image.pipe(response)
            })
            image.once('error', () => response.headersSent ? response.destroy() : response.writeHead(404).end())
            response.once('close', () => image.destroy())
          } else {
            response.writeHead(404).end()
          }
        } catch {
          response.writeHead(404).end()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FOOTPRINTS_LOCAL_')
  return {
    plugins: [
      react(),
      localFootprints(env.FOOTPRINTS_LOCAL_DIRECTORY ?? '', env.FOOTPRINTS_LOCAL_USERNAME ?? '', env.FOOTPRINTS_LOCAL_THUMBNAILS ?? ''),
    ],
    server: {
      proxy: { '/api': backend },
    },
    test: {
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})
