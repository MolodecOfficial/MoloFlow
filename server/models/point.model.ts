import mongoose from "mongoose";

const pointSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Название точки обязательно'],
    },
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Enterprise',
        required: true,
    },
    region: {
        type: String,
        required: [true, 'Регион обязателен'],
    },
    city: {
        type: String,
        required: [true, 'Город обязателен'],
    },
    address: {
        type: String,
        required: [true, 'Адрес обязателен'],
    },
    type: {
        type: String,
        required: [true, 'Укажите формат магазина'],
        enum: ['Магазин', 'Офис', 'Производство', 'Склад', 'Другое'],
        default: 'Магазин',
    },
    positions: {
        type: [String],
        default: []
    },
    departments: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: ['Активна', 'Закрыта', 'На ремонте'],
        default: 'Активна',
    },
    contactPerson: {
        name: {
            type: String,
            required: [true, 'ФИО контактного лица обязательно'],
        },
        phone: {
            type: String,
            required: [true, 'Телефон контактного лица обязателен'],
        },
        email: {
            type: String,
            required: [true, 'Email контактного лица обязателен'],
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Введите корректный email'],
        },
    },
    openingDate: {
        type: Date,
        default: Date.now,
    },
    metadata: {
        square: Number,
        employeeCount: Number,
    },
    employeePlan: {
        type: Number
    }
}, {
    timestamps: true
});

pointSchema.index({ enterpriseId: 1, name: 1 }, { unique: true });

export const Point = mongoose.models.Point || mongoose.model('Point', pointSchema);

export default mongoose.model('Point', pointSchema);