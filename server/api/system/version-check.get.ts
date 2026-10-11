import { defineEventHandler } from 'h3'
import mongoose from 'mongoose'
import pkg from '~~/package.json'

interface VersionConfigDoc {
    key: string
    version: string
    notes?: string
    updatedAt?: Date
}

export default defineEventHandler(async () => {
    const fallbackVersion = pkg.version || '1.0.0'
    const db = mongoose.connection.db

    if (!db) {
        return {
            latestVersion: fallbackVersion,
            notes: ''
        }
    }

    try {
        const config = await db.collection<VersionConfigDoc>('system_config').findOne({ key: 'app_version' })

        return {
            latestVersion: config?.version || fallbackVersion,
            notes: config?.notes || ''
        }
    } catch (err: any) {
        return {
            latestVersion: fallbackVersion,
            notes: '',
            error: err.message
        }
    }
})