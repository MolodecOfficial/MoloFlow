import { Schema, model, type Document, type Types } from 'mongoose'

export interface IDirectoryItem extends Document {
    enterpriseId: Types.ObjectId
    directorySlug: string
    code: string // Уникальный идентификатор/артикул/табельный номер внутри раздела
    title: string // Основное наименование / ФИО
    description?: string
    parentId: Types.ObjectId | null
    attributes: Record<string, string | number | boolean | null>
    createdAt: Date
    updatedAt: Date
}

const DirectoryItemSchema = new Schema<IDirectoryItem>(
    {
        enterpriseId: { type: Schema.Types.ObjectId, ref: 'Enterprise', required: true, index: true },
        directorySlug: { type: String, required: true, index: true, trim: true },
        code: { type: String, trim: true, default: '', index: true },
        title: { type: String, required: true, trim: true, index: true },
        description: { type: String, trim: true, default: '' },
        parentId: { type: Schema.Types.ObjectId, ref: 'DirectoryItem', default: null },
        attributes: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: () => ({}) }
    },
    {
        timestamps: true,
        minimize: false
    }
)

// Составные индексы для мгновенной фильтрации
DirectoryItemSchema.index({ enterpriseId: 1, directorySlug: 1, createdAt: -1 })
DirectoryItemSchema.index({ enterpriseId: 1, 'attributes.inn': 1 })
DirectoryItemSchema.index({ title: 'text', code: 'text', description: 'text' })

export const DirectoryItem = model<IDirectoryItem>('DirectoryItem', DirectoryItemSchema)