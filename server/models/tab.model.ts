// server/models/tab.model.ts
import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema({
    label: { type: String, required: true },
    value: { type: String, required: true },
    color: { type: String, default: '#6496ff' }
}, { _id: false })

const fieldSchema = new mongoose.Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
        type: String,
        enum: ['string', 'number', 'boolean', 'date', 'select', 'multiselect', 'email', 'phone', 'url', 'image', 'file', 'color', 'textarea'],
        default: 'string'
    },
    required: { type: Boolean, default: false },
    defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
    placeholder: { type: String, default: '' },
    description: { type: String, default: '' },
    options: { type: [optionSchema], default: [] },
    validation: {
        type: new mongoose.Schema({
            min: Number, max: Number, minLength: Number, maxLength: Number, pattern: String, customMessage: String
        }, { _id: false }), default: {}
    },
    display: {
        type: new mongoose.Schema({
            showInTable: { type: Boolean, default: true },
            showInCard: { type: Boolean, default: true },
            showInDetail: { type: Boolean, default: true },
            showInQuickView: { type: Boolean, default: false },
            width: { type: Number, default: 1 },
            format: { type: String, default: '' },
            prefix: { type: String, default: '' },
            suffix: { type: String, default: '' }
        }, { _id: false }), default: {}
    },
    isArray: { type: Boolean, default: false },
    isUnique: { type: Boolean, default: false },
    isSearchable: { type: Boolean, default: true },
    isFilterable: { type: Boolean, default: true },
    isSortable: { type: Boolean, default: true },
    isReadonly: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
}, { _id: false })

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    icon: { type: String, default: 'folder' }, // без эмодзи, используем имя иконки или просто текст
    fields: [fieldSchema]
}, { _id: true })

const tabSchema = new mongoose.Schema({
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Enterprise', required: true, index: true
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'folder' },
    color: { type: String, default: '#6496ff' },
    category: { type: String, default: 'custom' },
    defaultViewType: {
        type: String, enum: ['table', 'card', 'list', 'grid', 'kanban', 'calendar', 'map', 'timeline'], default: 'table'
    },
    groups: [groupSchema],
    actions: [{
        name: String, label: String, icon: String, color: String, action: String, isBulk: Boolean
    }],
    permissions: {
        canView: { type: Boolean, default: true },
        canCreate: { type: Boolean, default: true },
        canEdit: { type: Boolean, default: true },
        canDelete: { type: Boolean, default: true },
        canExport: { type: Boolean, default: false },
        rolesAllowed: [String]
    },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
})

tabSchema.index({ enterpriseId: 1, slug: 1 }, { unique: true })

tabSchema.pre('validate', function (next) {
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
    }
    next()
})

// Миграция старых вкладок (без групп, с полем fields)
async function migrateLegacyTabs() {
    const TabModel = mongoose.model('Tab')
    const legacyTabs = await TabModel.find({ groups: { $exists: false }, fields: { $exists: true } })
    for (const tab of legacyTabs) {
        const oldFields = tab.fields || []
        if (oldFields.length) {
            const defaultGroup = {
                name: 'Основные',
                description: 'Системная группа',
                order: 0,
                icon: 'folder',
                fields: oldFields.map((f: any) => {
                    const { _id, ...field } = f.toObject()
                    return { ...field, order: field.order ?? 0 }
                })
            }
            tab.groups = [defaultGroup]
            tab.fields = undefined
            await tab.save()
            console.log(`Migrated tab ${tab._id} (${tab.name})`)
        } else {
            tab.groups = []
            tab.fields = undefined
            await tab.save()
        }
    }
}

// Асинхронный запуск миграции при инициализации модели
setTimeout(() => {
    migrateLegacyTabs().catch(err => console.error('Migration error:', err))
}, 1000)

export const Tab = mongoose.models.Tab || mongoose.model('Tab', tabSchema)
export default Tab