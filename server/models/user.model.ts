import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Имя - Обязательное Поле!'],
    },
    password: {
        type: String,
        required: [true, 'Пароль - обязательное поле!'],
    },
    role: {
        type: String,
        enum: ['Пользователь', 'Бухгалтер', 'Комплектовщик', 'Сотрудник', 'Управляющий'],
        default: 'Пользователь',
    },
    phone: {
        type: String,
        required: [true, 'Номер телефона - обязательное поле'],
        validate: {
            validator: function(v: string) {
                return /^\d+$/.test(v);
            },
            message: 'Телефон должен содержать только цифры'
        }
    },
    twoFactorSecret: {
        type: String,
        default: null
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});


export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default mongoose.model('User', userSchema);