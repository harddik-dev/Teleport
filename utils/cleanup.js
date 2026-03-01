// utils/cleanup.js
// Run this manually or set it on a cron job to delete expired files
// Example cron (every hour): node utils/cleanup.js

import dotenv from 'dotenv'
dotenv.config()

import { db, bucket } from './firebase.js'

async function cleanupExpiredFiles() {
  console.log('🧹 Running cleanup...')
  const now = new Date()

  try {
    // Find all expired files in Firestore
    const snapshot = await db.collection('files')
      .where('expiresAt', '<', now)
      .get()

    if (snapshot.empty) {
      console.log('✅ No expired files found.')
      return
    }

    console.log(`🗑️  Found ${snapshot.size} expired file(s). Deleting...`)

    const deletions = snapshot.docs.map(async (doc) => {
      const { fileId, originalName } = doc.data()
      try {
        // Delete from Firebase Storage
        await bucket.file(`files/${fileId}`).delete()
        // Delete metadata from Firestore
        await doc.ref.delete()
        console.log(`  ✓ Deleted: ${originalName} (${fileId})`)
      } catch (err) {
        console.error(`  ✗ Failed to delete ${fileId}:`, err.message)
      }
    })

    await Promise.all(deletions)
    console.log('🎉 Cleanup complete.')

  } catch (err) {
    console.error('Cleanup failed:', err)
  }

  process.exit(0)
}

cleanupExpiredFiles()