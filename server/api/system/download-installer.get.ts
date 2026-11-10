import { defineEventHandler, createError, setResponseHeaders, sendStream } from 'h3'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
    const db = mongoose.connection.db
    if (!db) {
        throw createError({ statusCode: 500, statusMessage: 'Database not connected' })
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'app_installers' })
    const files = await bucket.find().sort({ uploadDate: -1 }).limit(1).toArray()

    if (!files.length) {
        throw createError({ statusCode: 404, statusMessage: 'Инсталлятор не найден в базе данных' })
    }

    const targetFile = files[0]
    setResponseHeaders(event, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(targetFile.filename)}"`,
        'Content-Length': String(targetFile.length)
    })

    const readStream = bucket.openDownloadStream(targetFile._id)
    return sendStream(event, readStream)
})