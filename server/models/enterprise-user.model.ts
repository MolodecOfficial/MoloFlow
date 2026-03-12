import mongoose from "mongoose";

const enterpriseUserSchema = new mongoose.Schema({
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Enterprise',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    position: {
        type: String,
        required: [true, 'Должность обязательна'],
    },
    department: String, // отдел
    pointId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Point',
    }, // к какой точке привязан
    hireDate: { // когда устроен
        type: Date,
        default: Date.now,
    },
    salary: { // зарплата
        type: Number,
        min: 0,
    },
    status: {
        type: String,
        enum: ['Активен', 'В отпуске', 'Уволен'],
        default: 'Активен',
    },
    contacts: {
        phone: String,
        email: String,
        emergencyPhone: String, // экстренный телефон
    }
}, {
    timestamps: true
});

// Один пользователь может работать только в одном предприятии
enterpriseUserSchema.index({ userId: 1 }, { unique: true });

export const EnterpriseUser = mongoose.models.EnterpriseUser || mongoose.model('EnterpriseUser', enterpriseUserSchema);

export default mongoose.model('EnterpriseUser', enterpriseUserSchema);