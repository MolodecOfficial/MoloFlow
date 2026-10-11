import { Schema, model, type Document, type Types } from 'mongoose'

export interface IDepartment extends Document {
    enterpriseId: Types.ObjectId
    key: string // Уникальный ключ/код отдела (например, "it", "sales", "dev")
    name: string // Отображаемое название (например, "IT и разработка")
    description?: string
    createdAt: Date
    updatedAt: Date
}

const DepartmentSchema = new Schema<IDepartment>(
    {
        enterpriseId: { type: Schema.Types.ObjectId, ref: 'Enterprise', required: true, index: true },
        key: { type: String, required: true, trim: true, lowercase: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' }
    },
    { timestamps: true }
)

DepartmentSchema.index({ enterpriseId: 1, key: 1 }, { unique: true })

export const Department = model<IDepartment>('Department', DepartmentSchema)