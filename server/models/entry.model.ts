import mongoose from 'mongoose'

const entrySchema = new mongoose.Schema({
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Enterprise', required: true, index: true
    },

    tabId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Tab', required: true, index: true
    },

    data: {
        type: Map, of: mongoose.Schema.Types.Mixed, default: {}
    },

    createdBy: String,

    updatedBy: String,

    isArchived: {
        type: Boolean, default: false
    },

    isActive: {
        type: Boolean, default: true
    }
}, {
    timestamps: true
})

entrySchema.index({
    enterpriseId: 1, tabId: 1
})

export const Entry = mongoose.models.Entry || mongoose.model('Entry', entrySchema)

export default Entry