import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const ROOT_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(ROOT_DIR, 'src', 'data')
const CRAFTED_FILE = resolve(DATA_DIR, 'craftedVials.ts')

type CraftedUpdate = {
  id: string
  liquid: {
    primaryColor: string
    secondaryColor?: string
    opacity: number
    texture: 'bubbles' | 'smoke' | 'spark' | 'wave' | 'liquid'
  }
}

function updateCraftedVialsSource(
  source: string,
  updates: CraftedUpdate[],
): string {
  let out = source
  for (const update of updates) {
    const id = update.id.trim()
    if (!id) continue
    const key = `  '${id}': {`
    const start = out.indexOf(key)
    const liquidBlock = [
      '    liquid: {',
      `      primaryColor: '${update.liquid.primaryColor}',`,
      update.liquid.secondaryColor?.trim()
        ? `      secondaryColor: '${update.liquid.secondaryColor.trim()}',`
        : '',
      `      opacity: ${Math.min(1, Math.max(0, Number(update.liquid.opacity) || 0.85))},`,
      `      texture: '${update.liquid.texture}',`,
      '    },',
    ]
      .filter(Boolean)
      .join('\n')

    if (start >= 0) {
      const braceStart = out.indexOf('{', start)
      if (braceStart < 0) continue
      let depth = 0
      let end = -1
      for (let i = braceStart; i < out.length; i += 1) {
        const ch = out[i]
        if (ch === '{') depth += 1
        else if (ch === '}') {
          depth -= 1
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      if (end < 0) continue
      const chunk = out.slice(start, end + 1)
      const nextChunk = chunk.replace(/liquid:\s*\{[\s\S]*?\n\s*\},/, liquidBlock)
      out = out.slice(0, start) + nextChunk + out.slice(end + 1)
      continue
    }

    const insertAt = out.lastIndexOf('\n}\n\nexport {')
    if (insertAt < 0) continue
    const append = [
      `  '${id}': {`,
      `    id: '${id}',`,
      "    type: 'element',",
      `    name: '${id}',`,
      "    description: 'Added from recipe workshop.',",
      liquidBlock,
      "    icon: 'rune',",
      '  },',
    ].join('\n')
    out = out.slice(0, insertAt) + append + out.slice(insertAt)
  }
  return out
}

async function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

function json(res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (chunk?: string) => void }, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'local-recipes-writer',
      configureServer(server) {
        server.middlewares.use('/api/save-recipes', async (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'Method not allowed' })
            return
          }
          try {
            const body = (await readJsonBody(req)) as {
              pairsTs?: unknown
              soloTs?: unknown
              craftedUpdates?: unknown
            }
            const pairsTs =
              typeof body.pairsTs === 'string' ? body.pairsTs : ''
            const soloTs = typeof body.soloTs === 'string' ? body.soloTs : ''
            const craftedUpdates = Array.isArray(body.craftedUpdates)
              ? (body.craftedUpdates as CraftedUpdate[])
              : []
            if (!pairsTs.trim() || !soloTs.trim()) {
              json(res, 400, {
                ok: false,
                error: 'Invalid payload: pairsTs and soloTs are required',
              })
              return
            }
            await writeFile(
              resolve(DATA_DIR, 'manualRecipePairs.ts'),
              pairsTs,
              'utf8',
            )
            await writeFile(
              resolve(DATA_DIR, 'manualSoloElements.ts'),
              soloTs,
              'utf8',
            )
            if (craftedUpdates.length > 0) {
              const craftedSource = await readFile(CRAFTED_FILE, 'utf8')
              const updated = updateCraftedVialsSource(
                craftedSource,
                craftedUpdates,
              )
              await writeFile(CRAFTED_FILE, updated, 'utf8')
            }
            json(res, 200, { ok: true })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error'
            json(res, 500, { ok: false, error: message })
          }
        })
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
