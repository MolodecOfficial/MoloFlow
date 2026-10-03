import { Schema, model, type Document, type Types } from 'mongoose'

export interface IDirectoryField {
    key: string
    label: string
    type: 'text' | 'number' | 'select' | 'boolean'
    required?: boolean
    options?: Array<{ label: string; value: string | number }>
    placeholder?: string
    span?: 1 | 2
}

export interface IDirectoryDefinition extends Document {
    enterpriseId: Types.ObjectId
    slug: string
    title: string
    description?: string
    aliases: string[] // Ключи для префикса {@}, например: ['автомобили', 'авто', 'машины', 'cars']
    icon?: string
    codeLabel?: string
    titleLabel?: string
    groupByKey?: string
    fields: IDirectoryField[]
    isSystem?: boolean
    createdAt: Date
    updatedAt: Date
}

const DirectoryDefinitionSchema = new Schema<IDirectoryDefinition>(
    {
        enterpriseId: { type: Schema.Types.ObjectId, ref: 'Enterprise', required: true, index: true },
        slug: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        aliases: { type: [String], default: [] },
        icon: { type: String, default: 'folder' },
        codeLabel: { type: String, default: 'Код / Идентификатор' },
        titleLabel: { type: String, default: 'Наименование' },
        groupByKey: { type: String, default: '' },
        fields: [
            {
                key: { type: String, required: true },
                label: { type: String, required: true },
                type: { type: String, enum: ['text', 'number', 'select', 'boolean'], default: 'text' },
                required: { type: Boolean, default: false },
                options: [{ label: String, value: Schema.Types.Mixed }],
                placeholder: { type: String, default: '' },
                span: { type: Number, enum: [1, 2], default: 1 }
            }
        ],
        isSystem: { type: Boolean, default: false }
    },
    {
        timestamps: true,
    }
)

DirectoryDefinitionSchema.index({ enterpriseId: 1, slug: 1 }, { unique: true })

export const DirectoryDefinition = model<IDirectoryDefinition>(
    'DirectoryDefinition',
    DirectoryDefinitionSchema
)