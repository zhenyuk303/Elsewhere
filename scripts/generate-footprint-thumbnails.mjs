import { mkdir, readdir } from 'node:fs/promises'
import { join, parse, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const [source = join('public', 'images', 'carousel'), target = join('public', 'images', 'footprint-thumbs')] = process.argv.slice(2)
if (resolve(source) === resolve(target)) throw new Error('The thumbnail folder must differ from the source folder.')
const files = (await readdir(source)).filter(file => /\.(?:webp|jpg)$/i.test(file))
await mkdir(target, { recursive: true })

for (const file of files) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', join(source, file), '-vf', 'scale=840:840:force_original_aspect_ratio=decrease:flags=lanczos',
    '-c:v', 'libwebp', '-quality', '78', '-frames:v', '1', join(target, `${parse(file).name}.webp`)], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Could not generate the thumbnail for ${file}`)
}
console.log(`Generated ${files.length} Footprints thumbnails`)
