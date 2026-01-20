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
    access: {
        type: String,
        enum: ['Предприятие', 'Склад', 'Бухгалтерия'],
        default: 'Нет доступа.'
    }
})

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default mongoose.model('User', userSchema);