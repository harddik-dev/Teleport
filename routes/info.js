import express from 'express'
import { supabase } from '../utils/db.js'

const router = express.Router()

router.get('/:id', async (req, res) => {
  try {
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error || !file) return res.status(404).json({ error: 'File not found' })
    if (new Date() > new Date(file.expires_at)) return res.status(410).json({ error: 'Expired' })

    return res.json({
      originalName: file.original_name,
      mimeType:     file.mime_type,
      sizeBytes:    file.size_bytes,
      expiresAt:    file.expires_at,
      downloads:    file.downloads,
      ttlHours:     file.ttl_hours
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch info' })
  }
})

export default router