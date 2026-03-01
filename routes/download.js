import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { supabase } from '../utils/db.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// GET /d/:id — serves the download PAGE
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !file) {
      return res.status(404).send(errorPage('File not found.'))
    }

    if (new Date() > new Date(file.expires_at)) {
      await supabase.storage.from('teleport-files').remove([`files/${id}`])
      await supabase.from('files').delete().eq('id', id)
      return res.status(410).send(errorPage('This file has expired and been deleted.'))
    }

    // Serve the download page
    return res.sendFile(path.join(__dirname, '../public/download.html'))

  } catch (err) {
    console.error('Download page error:', err)
    return res.status(500).send(errorPage('Something went wrong.'))
  }
})

// GET /d/:id/get — actual file download (called by the button)
router.get('/:id/get', async (req, res) => {
  try {
    const { id } = req.params

    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !file) return res.status(404).json({ error: 'File not found' })

    if (new Date() > new Date(file.expires_at)) {
      await supabase.storage.from('teleport-files').remove([`files/${id}`])
      await supabase.from('files').delete().eq('id', id)
      return res.status(410).json({ error: 'File expired' })
    }

    // Generate signed URL
    const { data: signed, error: signError } = await supabase.storage
      .from('teleport-files')
      .createSignedUrl(`files/${id}`, 900, {
        download: file.original_name
      })

    if (signError) throw signError

    // Update download count
    await supabase.from('files')
      .update({ downloads: file.downloads + 1 })
      .eq('id', id)

    return res.redirect(signed.signedUrl)

  } catch (err) {
    console.error('File download error:', err)
    return res.status(500).json({ error: 'Download failed' })
  }
})

function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Teleport</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center gap-6">
  <div class="text-6xl">🌀</div>
  <h1 class="text-2xl font-bold">${message}</h1>
  <a href="/" class="px-6 py-3 bg-purple-600 rounded-full text-sm font-bold hover:bg-purple-700">
    Teleport a new file
  </a>
</body></html>`
}

export default router