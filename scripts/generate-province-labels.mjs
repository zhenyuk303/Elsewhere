import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EXPECTED_SOURCE_COUNT = 17
const EXPECTED_OUTPUT_COUNT = 34
const EXPECTED_DIMENSIONS = '3072x4107'
const PANEL = {
  left: 88,
  width: 2896,
  height: 1728,
  upperTop: 174,
  lowerTop: 2110,
}

export function parsePairName(fileName) {
  if (extname(fileName).toLowerCase() !== '.png') {
    throw new Error(`Expected <upper>_<lower>.png, received ${fileName}`)
  }

  const names = basename(fileName, extname(fileName)).split('_')
  if (names.length !== 2 || names.some((name) => name.length === 0)) {
    throw new Error(`Expected <upper>_<lower>.png, received ${fileName}`)
  }

  return names
}

export function buildFfmpegArgs(inputPath, outputPath, panel) {
  if (panel !== 'upper' && panel !== 'lower') {
    throw new Error(`Panel must be upper or lower, received ${panel}`)
  }

  const top = panel === 'upper' ? PANEL.upperTop : PANEL.lowerTop
  const alphaExpression =
    "if(lte(val\\,90)\\,255\\,if(gte(val\\,150)\\,0\\,(150-val)*255/60))"
  const filter = [
    `[0:v]crop=${PANEL.width}:${PANEL.height}:${PANEL.left}:${top},split=3[panel][masksrc][alphasrc]`,
    '[panel]format=rgb24,lutrgb=r=255:g=255:b=255[white]',
    `[masksrc]format=gray,lut=y='${alphaExpression}'[luma]`,
    '[alphasrc]alphaextract,format=gray[srcalpha]',
    '[luma][srcalpha]blend=all_mode=multiply[alpha]',
    '[white][alpha]alphamerge[out]',
  ].join(';')

  return [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-frames:v',
    '1',
    outputPath,
  ]
}

function run(command, args, errorContext) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.error || result.status !== 0) {
    const details = result.stderr?.trim() || result.error?.message || 'unknown error'
    throw new Error(`${errorContext}: ${details}`)
  }

  return result.stdout.trim()
}

function assertDimensions(inputPath) {
  const dimensions = run(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      inputPath,
    ],
    `Could not inspect ${basename(inputPath)}`,
  )

  if (dimensions !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `${basename(inputPath)} must be ${EXPECTED_DIMENSIONS}, received ${dimensions}`,
    )
  }
}

export function generateAll({
  sourceDir = resolve('../province'),
  outputDir = resolve('public/images/province-labels'),
} = {}) {
  const sources = readdirSync(sourceDir)
    .filter((fileName) => extname(fileName).toLowerCase() === '.png')
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))

  if (sources.length !== EXPECTED_SOURCE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SOURCE_COUNT} source PNGs in ${sourceDir}, found ${sources.length}`,
    )
  }

  mkdirSync(outputDir, { recursive: true })
  const outputNames = new Set()

  for (const fileName of sources) {
    const inputPath = resolve(sourceDir, fileName)
    assertDimensions(inputPath)
    const [upperName, lowerName] = parsePairName(fileName)

    for (const [provinceName, panel] of [
      [upperName, 'upper'],
      [lowerName, 'lower'],
    ]) {
      const outputName = `${provinceName}.png`
      if (outputNames.has(outputName)) {
        throw new Error(`Duplicate province output ${outputName}`)
      }

      outputNames.add(outputName)
      const outputPath = resolve(outputDir, outputName)
      run(
        'ffmpeg',
        buildFfmpegArgs(inputPath, outputPath, panel),
        `Could not generate ${outputName}`,
      )
    }
  }

  const outputs = readdirSync(outputDir).filter(
    (fileName) => extname(fileName).toLowerCase() === '.png',
  )
  if (
    outputNames.size !== EXPECTED_OUTPUT_COUNT ||
    outputs.length !== EXPECTED_OUTPUT_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_OUTPUT_COUNT} generated PNGs, found ${outputs.length}`,
    )
  }

  return { sourceCount: sources.length, outputCount: outputs.length }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = generateAll()
  console.log(
    `Generated ${result.outputCount} province labels from ${result.sourceCount} source PNGs.`,
  )
}
