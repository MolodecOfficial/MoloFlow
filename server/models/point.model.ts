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
        enum: ['Магазин', 'Офис', 'Производство', 'Склад', 'Другое'],
        default: 'Магазин',
    },
    status: {
        type: String,
        enum: ['Активна', 'Закрыта', 'На ремонте'],
        default: 'Активна',
    },
    contactPerson: {
        name: String,
        phone: String,
        email: String,
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