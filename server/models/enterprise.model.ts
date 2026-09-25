import mongoose, { Schema, Document } from 'mongoose'

export interface IEnterpriseMember {
    userId: mongoose.Types.ObjectId
    role: string
    joinedAt: Date
}

export interface IEnterprise extends Document {
    enterpriseName: string
    inn: number
    kpp?: number
    ogrn: number
    legalAddress: string
    actualAddress?: string
    phone: number
    email: string
    director: string
    okved: number
    keypass: string
    ownershipForm: string
    members: IEnterpriseMember[]
    createdAt: Date
    updatedAt: Date
}

const EnterpriseMemberSchema = new Schema<IEnterpriseMember>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, default: 'Сотрудник' },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false })

const EnterpriseSchema = new Schema<IEnterprise>({
    enterpriseName: { type: String, required: true },
    inn: { type: Number, required: true, unique: true },
    kpp: { type: Number },
    ogrn: { type: Number, required: true },
    legalAddress: { type: String, required: true },
    actualAddress: { type: String },
    phone: { type: Number, required: true },
    email: { type: String, required: true },
    director: { type: String, required: true },
    okved: { type: Number, required: true },
    keypass: { type: String, required: true },
    ownershipForm: { type: String, default: 'ООО' },
    members: { type: [EnterpriseMemberSchema], default: [] }
}, {
    timestamps: true,
    collection: 'enterprises'
})

export const Enterprise = mongoose.models.Enterprise || mongoose.model<IEnterprise>('Enterprise', EnterpriseSchema)

export default mongoose.model('Enterprise', EnterpriseSchema)