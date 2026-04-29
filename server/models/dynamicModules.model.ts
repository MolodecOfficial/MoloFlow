import mongoose from "mongoose";

// Подсхема для файла зависимости
const moduleFileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true  // например: "components/Button.vue", "utils/api.ts"
    },
    format: {
        type: String,
        enum: ['js', 'ts', 'vue', 'css', 'scss', 'json'],
        required: true
    },
    code: {
        type: String,
        default: ''
    },
    size: {
        type: Number,
        default: 0
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

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

    // НОВОЕ: Файлы модуля (компоненты, утилиты и т.д.)
    files: {
        type: [moduleFileSchema],
        default: []
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
    previewImage: { type: String, default: null },
    isOfficial: { type: Boolean, default: false },

    // npm зависимости
    dependencies: {
        type: Map,
        of: String,
        default: new Map()
    },
    devDependencies: {
        type: Map,
        of: String,
        default: new Map()
    },
    serverEntry: {
        type: String,
        default: null
    },
    composables: {
        type: [String],
        default: []
    },
    clientHooks: {
        type: Map,
        of: String,
        default: new Map()
    },
    allowedModules: {
        type: [String],
        default: ['fs', 'path', 'crypto', 'axios', 'lodash']
    },
    apiVersion: {
        type: Number,
        default: 2
    },

    // Сборка и ассеты
    buildStatus: {
        type: String,
        enum: ['pending', 'building', 'built', 'failed'],
        default: 'pending'
    },
    clientBundlePath: {
        type: String,
        default: null
    },
    cssBundlePath: {
        type: String,
        default: null
    },
    lastBuildAt: {
        type: Date,
        default: null
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Индексы
dynamicModuleSchema.index({ 'dependencies': 'text' });
dynamicModuleSchema.index({ enterpriseId: 1, name: 1 }, { unique: true });
dynamicModuleSchema.index({ enterpriseId: 1, fileName: 1 }, { unique: true });
dynamicModuleSchema.index({ name: 'text', description: 'text', tags: 'text' });
dynamicModuleSchema.index({ 'stats.downloads': -1 });
dynamicModuleSchema.index({ createdAt: -1 });
dynamicModuleSchema.index({ isPublic: 1, isActive: 1 });
dynamicModuleSchema.index({ tags: 1 });
dynamicModuleSchema.index({ isOfficial: -1, 'stats.downloads': -1 });

dynamicModuleSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    // Обновляем дату для каждого файла
    if (this.files) {
        this.files.forEach((file: any) => {
            if (file.isNew) file.createdAt = new Date();
            file.updatedAt = new Date();
        });
    }
    next();
});

dynamicModuleSchema.methods.incrementDownloads = async function() {
    this.stats.downloads += 1;
    this.stats.lastUsed = new Date();
    await this.save();
};

dynamicModuleSchema.methods.getDependenciesObject = function() {
    const deps: Record<string, string> = {};
    if (this.dependencies) {
        for (const [key, value] of this.dependencies) {
            deps[key] = value;
        }
    }
    return deps;
};

// Метод для получения дерева файлов
dynamicModuleSchema.methods.getFileTree = function() {
    const tree: any = {};

    // Главный файл
    const mainFile = {
        name: `${this.fileName}.${this.format}`,
        path: `${this.fileName}.${this.format}`,
        format: this.format,
        code: this.code,
        isMain: true
    };

    tree[mainFile.path] = mainFile;

    // Добавляем все файлы зависимостей
    if (this.files) {
        for (const file of this.files) {
            tree[file.path] = {
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code,
                isMain: false
            };
        }
    }

    return tree;
};

export const DynamicModule = mongoose.models.DynamicModule || mongoose.model('DynamicModule', dynamicModuleSchema);
export default DynamicModule;