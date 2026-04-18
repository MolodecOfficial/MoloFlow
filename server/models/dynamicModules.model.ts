import mongoose from "mongoose";

const dynamicModuleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Введите название модуля!'],
        trim: true
    },
    fileName: {
        type: String,
        required: [true, 'Название файла обязательно'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    format: {
        type: String,
        required: [true, 'Выберите формат файла!'],
        enum: ['js', 'ts', 'vue'],
    },
    code: {
        type: String,
        required: [true, 'Введите код модуля!'],
    },
    enterpriseId: {
        type: String,
        required: [true, 'Укажите ID предприятия!'],
        index: true
    },
    createdBy: {
        _id: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, default: 'user' }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isPublic: {
        type: Boolean,
        default: false,
        index: true
    },
    version: {
        type: Number,
        default: 1
    },

    // Поля для глобального браузера
    stats: {
        downloads: { type: Number, default: 0 },
        ratings: {
            average: { type: Number, default: 0, min: 0, max: 5 },
            count: { type: Number, default: 0 }
        },
        lastUsed: { type: Date }
    },
    tags: [{ type: String, trim: true }],
    previewImage: { type: String, default: null }, // base64 или URL

    isOfficial: { type: Boolean, default: false }, // только админ

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Индексы
dynamicModuleSchema.index({ enterpriseId: 1, name: 1 }, { unique: true });
dynamicModuleSchema.index({ enterpriseId: 1, fileName: 1 }, { unique: true });
dynamicModuleSchema.index({ name: 'text', description: 'text', tags: 'text' });
dynamicModuleSchema.index({ 'stats.downloads': -1 });
dynamicModuleSchema.index({ createdAt: -1 });
dynamicModuleSchema.index({ isPublic: 1, moderationStatus: 1 });
dynamicModuleSchema.index({ tags: 1 });
dynamicModuleSchema.index({ isOfficial: -1, 'stats.downloads': -1 });

dynamicModuleSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

dynamicModuleSchema.methods.incrementDownloads = async function() {
    this.stats.downloads += 1;
    this.stats.lastUsed = new Date();
    await this.save();
};

export const DynamicModule = mongoose.models.DynamicModule || mongoose.model('DynamicModule', dynamicModuleSchema);

export default mongoose.model('DynamicModule', dynamicModuleSchema);