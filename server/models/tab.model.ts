// server/models/tab.model.ts
import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema({
    label: { type: String, required: true },
    value: { type: String, required: true },
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
    link: { type: String, default: '' },
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
    icon: { type: String, default: 'folder' },
    image: { type: String, default: null },
    link: { type: String, default: '' },
    fields: [fieldSchema]
}, { _id: true })

const tabSchema = new mongoose.Schema({
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Enterprise',
        required: true,
        index: true
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, default: '' },
    defaultViewType: {
        type: String,
        enum: ['table', 'card', 'list', 'grid', 'kanban', 'calendar', 'map', 'timeline'],
        default: 'table'
    },
    groups: [groupSchema],
    actions: [{
        name: String, label: String, action: String, isBulk: Boolean
    }],
    // ЕДИНЫЙ стандарт по умолчанию для вкладки (любого типа)
    defaultStandardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Standard',
        default: null
    },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

tabSchema.virtual('allFields').get(function () {
    const fields: any[] = [];
    if (this.groups && Array.isArray(this.groups)) {
        this.groups.forEach((group: any) => {
            if (group.fields && Array.isArray(group.fields)) {
                fields.push(...group.fields);
            }
        });
    }
    return fields.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
});

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

export const Tab = mongoose.models.Tab || mongoose.model('Tab', tabSchema)
export default Tab