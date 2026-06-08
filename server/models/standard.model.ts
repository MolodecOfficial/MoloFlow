import mongoose from 'mongoose'

const columnSchema = new mongoose.Schema({
    field: { type: String, required: true },
    label: { type: String, required: true },
    width: { type: String, default: 'auto' },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    sortable: { type: Boolean, default: true }
}, { _id: false })

const standardSchema = new mongoose.Schema({
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Enterprise',
        required: true
    },
    tabId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tab',
        required: true
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    styles: { type: Object, default: {} },
    type: { type: String, enum: ['table', 'card', 'list'], required: true },
    isDefault: { type: Boolean, default: false },
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String, default: '' },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    tableSettings: {
        columns: [columnSchema],
        density: { type: String, enum: ['compact', 'normal', 'spacious'], default: 'normal' },
        striped: { type: Boolean, default: true },
        hoverable: { type: Boolean, default: true }
    },
    cardSettings: {
        title: String,
        subtitle: String,
        fields: [String],
        columns: { type: Number, default: 3 },
        avatarField: String,
        showFooter: { type: Boolean, default: true },
        showStatus: { type: Boolean, default: true }
    },
    listSettings: {
        title: String,
        subtitle: String,
        showIcon: { type: Boolean, default: true },
        showDivider: { type: Boolean, default: true }
    },
    showSearch: { type: Boolean, default: true },
    showFilters: { type: Boolean, default: true },
    showPagination: { type: Boolean, default: true },
    itemsPerPage: { type: Number, default: 20 },
    emptyStateMessage: { type: String, default: 'Нет данных для отображения' },
    emptyStateIcon: { type: String, default: '📭' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true })

standardSchema.index({ enterpriseId: 1, tabId: 1, type: 1 })
standardSchema.index({ enterpriseId: 1, isTemplate: 1 })

standardSchema.pre('save', async function(next) {
    if (this.isDefault) {
        await mongoose.model('Standard').updateMany(
            {
                enterpriseId: this.enterpriseId,
                tabId: this.tabId,
                type: this.type,
                _id: { $ne: this._id }
            },
            { isDefault: false }
        )
    }
    next()
})

export const Standard = mongoose.models.Standard || mongoose.model('Standard', standardSchema)
export default Standard