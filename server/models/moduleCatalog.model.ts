// Глобальный каталог модулей: индекс/метаданные, исходный код хранится в БД предприятия.
import mongoose, { Schema, type Model } from 'mongoose'

const schema = new Schema({
    enterpriseId: { type: String, required: true, index: true },
    fileName: { type: String, default: '' },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    format: { type: String, default: '' },
    tags: { type: [String], default: [] },
    version: { type: Number, default: 1 },
    isPublic: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    previewImage: { type: String, default: null },
    stats: {
        downloads: { type: Number, default: 0 },
        ratings: {
            average: { type: Number, default: 0 },
            count: { type: Number, default: 0 }
        }
    },
    isOfficial: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { minimize: false })

schema.index({ isPublic: 1, isActive: 1, 'stats.downloads': -1 })
schema.index({ isPublic: 1, isActive: 1, 'stats.ratings.average': -1 })
schema.index({ isPublic: 1, isActive: 1, createdAt: -1 })
schema.index({ name: 'text', description: 'text', tags: 'text' })

export const ModuleCatalog: Model<any> =
    (mongoose.models.ModuleCatalog as Model<any>) || mongoose.model('ModuleCatalog', schema)
export default ModuleCatalog
