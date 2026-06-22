// Production HTTP host for the TanStack Start SSR handler.
//
// `dist/server/server.js` default-exports a WinterCG handler ({ fetch(Request) -> Response })
// that does NOT listen on a port. This thin launcher (zero extra deps, Node 20+ globals only):
//   - serves built client assets from dist/client/ as static files,
//   - delegates everything else to the SSR fetch handler,
//   - injects window.__BACKEND_URL__ into HTML responses from BACKEND_URL,
//     so a single built image targets any backend purely via env — no rebuild.
//
// Env:
//   PORT         listen port (default 3000)
//   HOST         bind address (default 0.0.0.0)
//   BACKEND_URL  backend API base URL exposed to the browser (default http://localhost:4000)
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = join(__dirname, 'dist', 'client')
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

const { default: ssr } = await import('./dist/server/server.js')

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

// Runtime config script injected before </head> so the browser bundle can read it.
function configScript() {
  const json = JSON.stringify(BACKEND_URL)
  return `<script>window.__BACKEND_URL__=${json}</script>`
}

// Resolve a request path to a real file inside CLIENT_DIR, guarding traversal.
function staticFile(pathname) {
  if (pathname === '/' || pathname.endsWith('/')) return null
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const abs = join(CLIENT_DIR, rel)
  if (!abs.startsWith(CLIENT_DIR)) return null
  if (!existsSync(abs)) return null
  const st = statSync(abs)
  if (!st.isFile()) return null
  return { abs, size: st.size }
}

function serveStatic(file, res) {
  const ext = file.abs.slice(file.abs.lastIndexOf('.'))
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': file.size,
    // Hashed asset filenames are immutable; everything else stays uncached.
    'Cache-Control': file.abs.includes(`${join('client', 'assets')}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  })
  createReadStream(file.abs).pipe(res)
}

// Build a WinterCG Request from a Node IncomingMessage.
function toWebRequest(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  const host = req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`
  const url = `${proto}://${host}${req.url}`
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv)
    else headers.set(k, v)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  })
}

// Write a WinterCG Response back to the Node ServerResponse.
async function writeWebResponse(webRes, res, { injectConfig }) {
  const headers = {}
  for (const [k, v] of webRes.headers) headers[k] = v
  const contentType = webRes.headers.get('content-type') || ''
  const isHtml = contentType.includes('text/html')

  if (isHtml && injectConfig) {
    // Buffer HTML to splice the config script into <head>; HTML is small.
    let html = await webRes.text()
    const tag = configScript()
    html = html.includes('</head>')
      ? html.replace('</head>', `${tag}</head>`)
      : `${tag}${html}`
    const body = Buffer.from(html, 'utf-8')
    delete headers['content-length']
    res.writeHead(webRes.status, { ...headers, 'Content-Length': body.byteLength })
    res.end(body)
    return
  }

  res.writeHead(webRes.status, headers)
  if (!webRes.body) {
    res.end()
    return
  }
  // Stream everything else (covers SSE / streamed SSR) without buffering.
  Readable.fromWeb(webRes.body).pipe(res)
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0])
      const file = staticFile(pathname)
      if (file) {
        serveStatic(file, res)
        return
      }
      const webRes = await ssr.fetch(toWebRequest(req))
      await writeWebResponse(webRes, res, { injectConfig: true })
    } catch (err) {
      console.error('[server-entry] request failed:', err)
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal Server Error')
    }
  })()
})

server.listen(PORT, HOST, () => {
  console.log(`frontend SSR listening on http://${HOST}:${PORT} (backend: ${BACKEND_URL})`)
})
