    import mongoose, { type InferSchemaType, type Model } from "mongoose";

const workspaceFolderSchema = new mongoose.Schema({
    // строка, а не ObjectId: на клиенте есть значение 'default', когда enterpriseId не передан
    enterpriseId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkspaceFolder',
        default: null,
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

workspaceFolderSchema.index({ enterpriseId: 1, parentId: 1 })

export type WorkspaceFolderType = InferSchemaType<typeof workspaceFolderSchema>

export const WorkspaceFolder: Model<WorkspaceFolderType> =
    (mongoose.models.WorkspaceFolder as Model<WorkspaceFolderType>) ||
    mongoose.model<WorkspaceFolderType>('WorkspaceFolder', workspaceFolderSchema);

export default WorkspaceFolder;
