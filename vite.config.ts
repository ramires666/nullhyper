import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'fs'
import path from 'path'

function pineStrategiesPlugin(): Plugin {
  const watchedDirs = new Set<string>()

  function parsePineFile(filePath: string, filename: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const stat = fs.statSync(filePath)

      // Detect strategy(...) or indicator(...) title & type
      let title = path.basename(filename, path.extname(filename)).replace(/[_-]/g, ' ')
      // Capitalize words
      title = title.replace(/\b\w/g, (c) => c.toUpperCase())

      let type: 'strategy' | 'indicator' = 'strategy'

      const strategyMatch = content.match(/strategy\s*\(\s*["']([^"']+)["']/i)
      const indicatorMatch = content.match(/indicator\s*\(\s*["']([^"']+)["']/i)

      if (strategyMatch) {
        title = strategyMatch[1]
        type = 'strategy'
      } else if (indicatorMatch) {
        title = indicatorMatch[1]
        type = 'indicator'
      }

      // Check if version is specified, if not default to v6
      let code = content
      if (!code.includes('//@version=')) {
        code = '//@version=6\n' + code
      }

      return {
        id: `file_${filename}`,
        title,
        type,
        description: `Folder file: ${filename}`,
        filename,
        path: filePath,
        code,
        mtime: stat.mtimeMs,
        source: 'folder' as const,
      }
    } catch (err) {
      console.warn(`[PinePlugin] Failed to read ${filePath}:`, err)
      return null
    }
  }

  function scanDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) return []
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const pineFiles = entries.filter(
        (e) =>
          e.isFile() &&
          (e.name.endsWith('.pine') || e.name.endsWith('.pine6') || e.name.endsWith('.ps'))
      )

      return pineFiles
        .map((f) => parsePineFile(path.join(dirPath, f.name), f.name))
        .filter(Boolean)
    } catch (err) {
      console.warn(`[PinePlugin] Scan error in ${dirPath}:`, err)
      return []
    }
  }

  return {
    name: 'pine-strategies-plugin',
    configureServer(server) {
      const defaultStrategiesDir = path.resolve(process.cwd(), 'strategies')
      if (!fs.existsSync(defaultStrategiesDir)) {
        fs.mkdirSync(defaultStrategiesDir, { recursive: true })
      }

      // Register default dir in watcher
      if (!watchedDirs.has(defaultStrategiesDir)) {
        server.watcher.add(defaultStrategiesDir)
        watchedDirs.add(defaultStrategiesDir)
      }

      // Listen for file changes and broadcast to frontend
      server.watcher.on('all', (event, filePath) => {
        if (
          filePath.endsWith('.pine') ||
          filePath.endsWith('.pine6') ||
          filePath.endsWith('.ps')
        ) {
          console.log(`[PinePlugin] File ${event}: ${filePath}`)
          server.ws.send({
            type: 'custom',
            event: 'pine:strategies-changed',
            data: { event, filePath },
          })
        }
      })

      // API Middleware
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const parsedUrl = new URL(req.url, 'http://localhost')

        // 1. GET /api/strategies
        if (req.method === 'GET' && parsedUrl.pathname === '/api/strategies') {
          const customDir = parsedUrl.searchParams.get('dir')
          const targetDir = customDir && customDir.trim().length > 0 ? customDir.trim() : defaultStrategiesDir

          // If customDir requested and exists, ensure it is added to server watcher
          if (customDir && fs.existsSync(customDir) && !watchedDirs.has(customDir)) {
            try {
              server.watcher.add(customDir)
              watchedDirs.add(customDir)
              console.log(`[PinePlugin] Now watching custom strategies directory: ${customDir}`)
            } catch (wErr) {
              console.warn(`[PinePlugin] Could not watch ${customDir}:`, wErr)
            }
          }

          const items = scanDirectory(targetDir)
          const defaultItems =
            targetDir !== defaultStrategiesDir ? scanDirectory(defaultStrategiesDir) : []

          // Combine with deduplication by filename
          const allItems = [...items]
          const existingNames = new Set(items.map((i: any) => i.filename))
          for (const di of defaultItems) {
            if (di && !existingNames.has(di.filename)) {
              allItems.push(di)
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              activeFolder: targetDir,
              defaultFolder: defaultStrategiesDir,
              total: allItems.length,
              items: allItems,
            })
          )
          return
        }

        // 2. POST /api/strategies/save
        if (req.method === 'POST' && parsedUrl.pathname === '/api/strategies/save') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const { filename, code, dir } = JSON.parse(body)
              if (!filename || !code) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing filename or code' }))
                return
              }

              const targetDir = dir && dir.trim().length > 0 ? dir.trim() : defaultStrategiesDir
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
              }

              let safeName = filename.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
              if (!safeName.endsWith('.pine')) {
                safeName += '.pine'
              }

              const filePath = path.join(targetDir, safeName)
              fs.writeFileSync(filePath, code, 'utf-8')

              // Broadcast change
              server.ws.send({
                type: 'custom',
                event: 'pine:strategies-changed',
                data: { event: 'change', filePath },
              })

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, filename: safeName, path: filePath }))
            } catch (err: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err?.message || String(err) }))
            }
          })
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pineStrategiesPlugin()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
      },
      '/api/binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/binance/, ''),
      },
    },
  },
})
