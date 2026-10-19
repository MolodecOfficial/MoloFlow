// server/models/moloEndpoint.model.ts
// Пользовательские HTTP-эндпоинты: адрес -> серверный файл модуля, выполняемый в песочнице.
import mongoose from 'mongoose'

const schema = new mongoose.Schema({
    enterpriseId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    methods: { type: [String], default: ['POST'] },
    moduleId: { type: String, required: true },
    /** Путь серверного файла модуля; пустая строка = основной файл модуля */
    file: { type: String, default: '' },
    /** public — открыт всем, key — по секретному ключу, members — только участники предприятия */
    access: { type: String, enum: ['public', 'key', 'members'], default: 'members' },
    secret: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    createdBy: {
        _id: { type: String },
        name: { type: String }
    },
    stats: {
        calls: { type: Number, default: 0 },
        lastCallAt: { type: Date, default: null },
        lastStatus: { type: Number, default: null }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

schema.index({ enterpriseId: 1, slug: 1 }, { unique: true })

export const MoloEndpoint: any = (mongoose.models as any).MoloEndpoint || mongoose.model('MoloEndpoint', schema)
export default MoloEndpoint