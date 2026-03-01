import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import uploadRoute from './routes/upload.js'
import downloadRoute from './routes/download.js'
import infoRoute from './routes/info.js'
import { supabase } from './utils/db.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Middleware ──────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ── Routes ─────────────────────────────────────────────────────────────
app.use('/upload', uploadRoute)
app.use('/d',      downloadRoute)
app.use('/info',   infoRoute)

// ── Catch-all ──────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ── Cron: cleanup expired files every hour ─────────────────────────────
cron.schedule('0 * * * *', async () => {
  console.log('🧹 Running cleanup...')

  const { data: expired } = await supabase
    .from('files')
    .select('id')
    .lt('expires_at', new Date().toISOString())

  if (!expired || expired.length === 0) {
    console.log('✅ No expired files.')
    return
  }

  for (const file of expired) {
    await supabase.storage.from('teleport-files').remove([`files/${file.id}`])
    await supabase.from('files').delete().eq('id', file.id)
    console.log(`🗑️  Deleted: ${file.id}`)
  }
})

// ── Start ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Teleport running on http://localhost:${PORT}`)
})