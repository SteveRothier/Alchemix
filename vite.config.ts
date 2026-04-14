import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const ROOT_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(ROOT_DIR, 'src', 'data')
const CRAFTED_FILE = resolve(DATA_DIR, 'craftedVials.ts')

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
          if (process.env.NODE_ENV !== 'development') {
            json(res, 403, { ok: false, error: 'Endpoint available in development only' })
            return
          }
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'Method not allowed' })
            return
          }
          try {
            const body = (await readJsonBody(req)) as {
              craftedTs?: unknown
            }
            const craftedTs =
              typeof body.craftedTs === 'string' ? body.craftedTs : ''
            if (!craftedTs.trim()) {
              json(res, 400, {
                ok: false,
                error: 'Invalid payload: craftedTs is required',
              })
              return
            }
            await writeFile(CRAFTED_FILE, craftedTs, 'utf8')
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
