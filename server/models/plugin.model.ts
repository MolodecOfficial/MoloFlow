import mongoose from "mongoose";

// =============================================================
// Плагин — дополнение к существующему модулю.
//
// Структурно повторяет файловую часть DynamicModule (тот же формат
// файлов, тот же способ хранения кода), но НЕ является модулем сам
// по себе: у плагина нет своего "главного" code/fileName в смысле
// точки входа — вместо этого он целиком состоит из files[], которые
// на рантайме подмешиваются к файлам модуля-цели (см. DynamicModuleLoader,
// additionalFiles).
//
// Привязка к модулю — через targetFileName (fileName существующего
// DynamicModule в том же enterprise), а не через targetModuleId,
// потому что fileName стабильный человекочитаемый идентификатор,
// который сам пользователь вводит в UI при создании плагина, и по
// нему же на клиенте резолвится, какие плагины подтягивать к
// открываемому модулю (см. modules_get.ts — там нет самого _id
// целевого модуля под рукой без лишнего запроса, а fileName обычно
// уже есть).
// =============================================================

const pluginFileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
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
    isServerFile: {
        type: Boolean,
        default: false
    },
    size: {
        type: Number,
        default: 0
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const pluginSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Введите название плагина!'],
        trim: true
    },
    fileName: {
        type: String,
        required: [true, 'Название файла плагина обязательно'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },

    // К какому модулю привязан плагин. Хранится и как fileName (стабильный,
    // вводится/выбирается пользователем в UI), и как targetModuleId
    // (резолвится и кэшируется сервером при create/update через валидацию
    // существования — удобно для быстрых lookup'ов без похода по fileName
    // на горячем пути загрузки модуля).
    targetFileName: {
        type: String,
        required: [true, 'Укажите fileName модуля, к которому относится плагин'],
        trim: true,
        index: true
    },
    targetModuleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DynamicModule',
        required: true,
        index: true
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
    // Плагин можно временно выключить, не удаляя (не подмешивается в
    // рантайме, но остаётся редактируемым) — отдельно от isActive
    // (мягкое удаление), чтобы это включал сам автор из UI.
    isEnabled: {
        type: Boolean,
        default: true,
        index: true
    },

    version: {
        type: Number,
        default: 1
    },

    files: {
        type: [pluginFileSchema],
        default: []
    },
    hasServerCode: {
        type: Boolean,
        default: false
    },

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

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Один и тот же плагин (по имени) не может дублироваться для одного модуля
// в рамках предприятия.
pluginSchema.index({ enterpriseId: 1, targetFileName: 1, name: 1 }, { unique: true });

// Горячий путь: "дай все активные плагины для модуля X" (используется
// при каждой загрузке модуля в DynamicModuleLoader).
pluginSchema.index({ enterpriseId: 1, targetFileName: 1, isActive: 1, isEnabled: 1 });

pluginSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    this.hasServerCode = this.files?.some((file: any) => file.isServerFile) || false;

    if (this.files) {
        this.files.forEach((file: any) => {
            if (file.isNew) file.createdAt = new Date();
            file.updatedAt = new Date();
        });
    }
    next();
});

pluginSchema.methods.getDependenciesObject = function () {
    const deps: Record<string, string> = {};
    if (this.dependencies) {
        for (const [key, value] of this.dependencies) {
            deps[key] = value;
        }
    }
    return deps;
};

export const Plugin = mongoose.models.Plugin || mongoose.model('Plugin', pluginSchema);
export default Plugin;