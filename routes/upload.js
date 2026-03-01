import express from 'express'
import multer from 'multer'
import { nanoid } from 'nanoid'
import { supabase } from '../utils/db.js'

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }  // 50MB limit
})

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    const ttlHours = parseInt(req.body.ttl) || 24
    const fileId   = nanoid(10)
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

    // ── 1. Upload file to Supabase Storage ──────────────────────────
    const { error: uploadError } = await supabase.storage
      .from('teleport-files')
      .upload(`files/${fileId}`, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (uploadError) throw uploadError

    // ── 2. Save metadata to Supabase DB ─────────────────────────────
    const { error: dbError } = await supabase.from('files').insert({
      id:            fileId,
      original_name: req.file.originalname,
      mime_type:     req.file.mimetype,
      size_bytes:    req.file.size,
      ttl_hours:     ttlHours,
      expires_at:    expiresAt.toISOString()
    })

    if (dbError) throw dbError

    // ── 3. Return share URL ──────────────────────────────────────────
    return res.status(201).json({
      success:  true,
      url:      `${process.env.BASE_URL}/d/${fileId}`,
      expiresAt: expiresAt.toISOString()
    })

  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ error: 'Upload failed. Try again.' })
  }
})

export default router