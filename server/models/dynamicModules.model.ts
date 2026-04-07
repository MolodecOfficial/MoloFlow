import mongoose from "mongoose";

const dynamicModuleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Введите название модуля!'],
        unique: true,
        trim: true
    },
    fileName: {
        type: String,
        required: [true, 'Название файла обязательно'],
        unique: true,
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
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    version: {
        type: Number,
        default: 1
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

dynamicModuleSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export const DynamicModule = mongoose.models.DynamicModule || mongoose.model('DynamicModule', dynamicModuleSchema);

export default mongoose.model('DynamicModule', dynamicModuleSchema);