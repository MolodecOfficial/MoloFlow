import mongoose from "mongoose";

const browserModuleSchema = new mongoose.Schema({
    // Базовая информация модуля
    name: {
        type: String,
        required: true,
        trim: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true,
        unique: true  // fileName должен быть уникальным в глобальном браузере
    },
    description: {
        type: String,
        default: ''
    },
    format: {
        type: String,
        required: true,
        enum: ['js', 'ts', 'vue'],
    },
    code: {
        type: String,
        required: true,
    },

    // Информация о создателе
    createdBy: {
        userId: { type: String, required: true },
        enterpriseId: { type: String, required: true },
        enterpriseName: { type: String },
        authorName: { type: String }
    },

    // Статистика использования
    stats: {
        downloads: { type: Number, default: 0 },
        ratings: {
            average: { type: Number, default: 0, min: 0, max: 5 },
            count: { type: Number, default: 0 }
        },
        lastUsed: { type: Date }
    },

    // Версионирование
    version: {
        type: String,
        default: '1.0.0'
    },

    // Теги для поиска
    tags: [{
        type: String,
        trim: true
    }],

    // Иконка/превью (опционально)
    previewImage: {
        type: String,
        default: null
    },

    // Статус модерации (если нужна)
    moderationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'featured'],
        default: 'pending'
    },

    isOfficial: {
        type: Boolean,
        default: false  // Официальные модули от платформы
    },
    isFeatured: {
        type: Boolean,
        default: false  // Рекомендуемые модули
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Индексы для быстрого поиска
browserModuleSchema.index({ name: 'text', description: 'text', tags: 'text' });
browserModuleSchema.index({ 'stats.downloads': -1 });
browserModuleSchema.index({ createdAt: -1 });
browserModuleSchema.index({ moderationStatus: 1, isActive: 1 });
browserModuleSchema.index({ tags: 1 });
browserModuleSchema.index({ isOfficial: -1, 'stats.downloads': -1 });

browserModuleSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Метод для увеличения счетчика загрузок
browserModuleSchema.methods.incrementDownloads = async function() {
    this.stats.downloads += 1;
    this.stats.lastUsed = new Date();
    await this.save();
};

export const BrowserModule = mongoose.models.BrowserModule || mongoose.model('BrowserModule', browserModuleSchema);

export default mongoose.model('Browser', browserSchema);