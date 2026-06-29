import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const sourceLogo = resolve(repoRoot, 'src/assets/solid-drive-logo.png')
const outputDir = resolve(repoRoot, 'public/icons')

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const DARK_BACKGROUND = { r: 7, g: 7, b: 56, alpha: 1 }

const ICONS = [
  { file: 'pwa-192x192-v2.png', size: 192, background: TRANSPARENT, logoRatio: 1.0 },
  { file: 'pwa-512x512-v2.png', size: 512, background: TRANSPARENT, logoRatio: 1.0 },
  { file: 'pwa-512x512-v3.png', size: 512, background: DARK_BACKGROUND, logoRatio: 1.0 },
  { file: 'maskable-512x512-v2.png', size: 512, background: DARK_BACKGROUND, logoRatio: 0.58 },
  { file: 'apple-touch-icon-180x180-v2.png', size: 180, background: DARK_BACKGROUND, logoRatio: 0.72 },
]

const renderIcon = async ({ file, size, background, logoRatio }) => {
  const logoBox = Math.round(size * logoRatio)
  const logo = await sharp(sourceLogo)
    .trim()
    .resize(logoBox, logoBox, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(resolve(outputDir, file))
}

await mkdir(outputDir, { recursive: true })
await Promise.all(ICONS.map(renderIcon))

console.log(`Generated ${ICONS.length} PWA icons in public/icons/`)
