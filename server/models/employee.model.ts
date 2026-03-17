import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
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
    department: {
        type: String,
        enum: ['IT-Отдел', 'Отдел продаж', 'Отдел безопасности', 'Юридический отдел'],
    }, // Отдел
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
        emergencyPhone: String,
    }
}, {
    timestamps: true
});

// Один пользователь может работать только в одном предприятии
employeeSchema.index({ userId: 1 }, { unique: true });

export const EmployeeUser = mongoose.models.EmployeeUser || mongoose.model('EmployeeUser', employeeSchema);

export default mongoose.model('EmployeeUser', employeeSchema);