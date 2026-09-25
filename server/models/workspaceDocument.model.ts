import mongoose, { type InferSchemaType, type Model } from "mongoose";

const workspaceDocumentSchema = new mongoose.Schema({
    enterpriseId: {
        type: String,
        required: true,
    },
    folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkspaceFolder',
        default: null,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    // имя в нижнем регистре — для поиска (регистронезависимый regex по кириллице ненадёжен)
    nameLower: {
        type: String,
        default: '',
    },
    type: {
        type: String,
        enum: ['excel', 'word', 'pdf', "image", 'primary'],
        required: true,
    },
    // word  — HTML-строка из TipTap
    // excel — JSON.stringify(снимок Univer). Строкой, потому что в снимке могут быть
    //         ключи, которые Mongo не любит, а пустые объекты mongoose «схлопывает»
    content: {
        type: String,
        default: '',
    },
    // плоский текст содержимого в нижнем регистре для полнотекстового поиска
    searchText: {
        type: String,
        default: '',
        select: false,
    },
    // размер content в байтах
    size: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
})

workspaceDocumentSchema.index({ enterpriseId: 1, updatedAt: -1 })
workspaceDocumentSchema.index({ enterpriseId: 1, folderId: 1 })

export type WorkspaceDocumentType = InferSchemaType<typeof workspaceDocumentSchema>

export const WorkspaceDocument: Model<WorkspaceDocumentType> =
    (mongoose.models.WorkspaceDocument as Model<WorkspaceDocumentType>) ||
    mongoose.model<WorkspaceDocumentType>('WorkspaceDocument', workspaceDocumentSchema);

export default WorkspaceDocument;
