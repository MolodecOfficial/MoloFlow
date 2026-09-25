import mongoose, { type InferSchemaType, type Model } from "mongoose";

// Версии лежат отдельно от документа, чтобы 20 снимков не упирались в лимит 16 МБ на один документ Mongo
const workspaceDocumentVersionSchema = new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkspaceDocument',
        required: true,
    },
    enterpriseId: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        default: '',
    },
    size: {
        type: Number,
        default: 0,
    },
    comment: {
        type: String,
        default: '',
        maxlength: 200,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

workspaceDocumentVersionSchema.index({ documentId: 1, createdAt: -1 })

export type WorkspaceDocumentVersionType = InferSchemaType<typeof workspaceDocumentVersionSchema>

export const WorkspaceDocumentVersion: Model<WorkspaceDocumentVersionType> =
    (mongoose.models.WorkspaceDocumentVersion as Model<WorkspaceDocumentVersionType>) ||
    mongoose.model<WorkspaceDocumentVersionType>('WorkspaceDocumentVersion', workspaceDocumentVersionSchema);

export default WorkspaceDocumentVersion;
