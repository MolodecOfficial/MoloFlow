// server/models/moloDatabase.model.ts
// Описание мини-баз предприятия (схема коллекций). Сами записи лежат в molo_records — см. utils/moloDb/store.ts.
import mongoose from 'mongoose'

const schema = new mongoose.Schema({
    enterpriseId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    // Схемы коллекций валидируются в normalizeDatabaseDef() до записи, поэтому здесь Mixed
    collections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdBy: {
        _id: { type: String },
        name: { type: String }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

schema.index({ enterpriseId: 1, name: 1 }, { unique: true })

export const MoloDatabase: any = (mongoose.models as any).MoloDatabase || mongoose.model('MoloDatabase', schema)
export default MoloDatabase