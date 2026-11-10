import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
    name: string
    password: string
    role: string
    phone: string
    twoFactorSecret?: string
    twoFactorEnabled?: boolean
    createdAt: Date
    updatedAt: Date
}

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Пользователь' },
    phone: { type: String, required: true },
    twoFactorSecret: { type: String },
    twoFactorEnabled: { type: Boolean, default: false }
}, {
    timestamps: true,
    collection: 'users'
})

export const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default mongoose.model('User', UserSchema);