import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  buildFfmpegArgs,
  parsePairName,
} from './generate-province-labels.mjs'

function runFfmpeg(args, options = {}) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], options)
  assert.equal(result.status, 0, result.stderr?.toString())
  return result.stdout
}

function readAlphaAt(filePath, x, y) {
  const output = runFfmpeg([
    '-i',
    filePath,
    '-vf',
    `crop=1:1:${x}:${y},alphaextract,format=gray`,
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    '-',
  ])
  return output[0]
}

test('parses upper and lower province names from a paired PNG filename', () => {
  assert.deepEqual(parsePairName('云南_台湾.png'), ['云南', '台湾'])
  assert.deepEqual(parsePairName('黑龙江_内蒙古.png'), ['黑龙江', '内蒙古'])
  assert.deepEqual(parsePairName('四川_上海.png'), ['上海', '四川'])
})

test('rejects source filenames that do not contain exactly two province names', () => {
  assert.throws(() => parsePairName('云南.png'), /<upper>_<lower>\.png/)
  assert.throws(() => parsePairName('云南_台湾_澳门.png'), /<upper>_<lower>\.png/)
  assert.throws(() => parsePairName('云南_台湾.jpg'), /<upper>_<lower>\.png/)
})

test('builds an upper-panel FFmpeg command with a smooth white alpha mask', () => {
  const args = buildFfmpegArgs('source.png', '云南.png', 'upper')

  assert.deepEqual(args.slice(0, 4), ['-y', '-i', 'source.png', '-filter_complex'])
  assert.match(args[4], /crop=2896:1728:88:174/)
  assert.match(args[4], /format=gray,lut=y=/)
  assert.match(args[4], /alphaextract/)
  assert.match(args[4], /blend=all_mode=multiply/)
  assert.match(args[4], /alphamerge/)
  assert.deepEqual(args.slice(-3), ['-frames:v', '1', '云南.png'])
})

test('uses the lower panel crop for the second province', () => {
  const args = buildFfmpegArgs('source.png', '台湾.png', 'lower')

  assert.match(args[4], /crop=2896:1728:88:2110/)
})

test('rejects an unknown panel', () => {
  assert.throws(
    () => buildFfmpegArgs('source.png', '云南.png', 'middle'),
    /upper or lower/,
  )
})

test('keeps dark lettering opaque while removing transparent RGB and pale artwork', () => {
  const directory = mkdtempSync(join(tmpdir(), 'province-label-test-'))
  const sourcePath = join(directory, 'source.png')
  const outputPath = join(directory, 'output.png')

  try {
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      'color=c=black@0.0:s=3072x4107,format=rgba',
      '-vf',
      'drawbox=x=200:y=300:w=120:h=120:color=black@1:t=fill:replace=1,drawbox=x=400:y=500:w=120:h=120:color=0xC8C8C8@1:t=fill:replace=1,drawbox=x=1800:y=1500:w=240:h=120:color=black@1:t=fill:replace=1,drawbox=x=1200:y=1750:w=240:h=120:color=black@0.24:t=fill:replace=1',
      '-frames:v',
      '1',
      sourcePath,
      '-y',
    ])
    runFfmpeg(buildFfmpegArgs(sourcePath, outputPath, 'upper'))

    assert.ok(readAlphaAt(outputPath, 150, 180) >= 250, 'dark brush stroke')
    assert.equal(readAlphaAt(outputPath, 350, 350), 0, 'pale watermark')
    assert.ok(readAlphaAt(outputPath, 1750, 1350) >= 250, 'lower-right brush stroke')
    assert.equal(readAlphaAt(outputPath, 1150, 1600), 0, 'low-opacity watermark')
    assert.equal(readAlphaAt(outputPath, 20, 20), 0, 'transparent black RGB')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
