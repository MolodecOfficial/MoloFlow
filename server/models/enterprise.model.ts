// server/models/enterprise.model.ts
// Глобальный реестр предприятий: логин, ключ доступа, участники, статус. Остальное — в базе предприятия.
import mongoose, { Schema, type Document } from 'mongoose'

export interface IEnterpriseMember {
    userId: mongoose.Types.ObjectId
    role: string
    joinedAt: Date
}

export interface IEnterprise extends Document {
    enterpriseName: string
    inn: string
    keypass: string
    ownershipForm?: string
    creatorId?: mongoose.Types.ObjectId
    status: 'provisioning' | 'active' | 'deleting'
    members: IEnterpriseMember[]
    createdAt: Date
    updatedAt: Date
}

const MemberSchema = new Schema<IEnterpriseMember>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, default: 'Сотрудник' },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false })

const EnterpriseSchema = new Schema<IEnterprise>({
    enterpriseName: { type: String, required: true, trim: true },
    inn: { type: String, required: true, unique: true, trim: true },
    keypass: { type: String, required: true },
    ownershipForm: { type: String, default: 'ООО' },
    // Создатель — администратор именно этого предприятия, не глобальная роль аккаунта.
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: ['provisioning', 'active', 'deleting'], default: 'active', index: true },
    members: { type: [MemberSchema], default: [] }
}, {
    timestamps: true,
    collection: 'enterprises',
    // Старые поля реквизитов в записях остаются, их читает синхронизация
    strict: false
})

export const Enterprise: any = (mongoose.models.Enterprise as any) || mongoose.model<IEnterprise>('Enterprise', EnterpriseSchema)
export default Enterprise
