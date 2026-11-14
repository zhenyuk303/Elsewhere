import { mkdir, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, parse } from 'node:path'

const sourceDir = join(process.cwd(), 'public', 'images')
const outputDir = join(sourceDir, 'carousel')
const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.jpg'))

await mkdir(outputDir, { recursive: true })

for (const file of files) {
  const source = join(sourceDir, file)
  const output = join(outputDir, `${parse(file).name}.webp`)
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', source,
    '-vf', "scale='min(iw,2400)':'min(ih,2400)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos",
    '-c:v', 'libwebp', '-quality', '82', '-compression_level', '5',
    '-frames:v', '1', output,
  ], { stdio: 'inherit' })

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Could not optimize ${file}`)
}

console.log(`Optimized ${files.length} carousel photos in ${outputDir}`)
