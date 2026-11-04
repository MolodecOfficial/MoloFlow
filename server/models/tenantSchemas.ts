// server/models/tenantSchemas.ts
// Схемы, которые живут внутри БД предприятия (molo_ent_<id>).
import { Schema } from 'mongoose'

const workspaceFolderSchema = new Schema({
    enterpriseId: { type: String },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    parentId: { type: Schema.Types.ObjectId, ref: 'WorkspaceFolder', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})
workspaceFolderSchema.index({ parentId: 1 })

const workspaceDocumentSchema = new Schema({
    enterpriseId: { type: String },
    folderId: { type: Schema.Types.ObjectId, ref: 'WorkspaceFolder', default: null },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameLower: { type: String, default: '' },
    type: { type: String, enum: ['excel', 'word', 'pdf', 'image', 'primary'], required: true },
    content: { type: String, default: '' },
    searchText: { type: String, default: '', select: false },
    size: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})
workspaceDocumentSchema.index({ updatedAt: -1 })
workspaceDocumentSchema.index({ folderId: 1 })

const workspaceDocumentVersionSchema = new Schema({
    documentId: { type: Schema.Types.ObjectId, ref: 'WorkspaceDocument', required: true },
    enterpriseId: { type: String },
    content: { type: String, default: '' },
    size: { type: Number, default: 0 },
    comment: { type: String, default: '', maxlength: 200 },
    createdAt: { type: Date, default: Date.now }
})
workspaceDocumentVersionSchema.index({ documentId: 1, createdAt: -1 })

const directoryItemSchema = new Schema({
    enterpriseId: { type: String },
    directorySlug: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    parentId: { type: Schema.Types.ObjectId, ref: 'DirectoryItem', default: null },
    attributes: { type: Schema.Types.Mixed, default: () => ({}) }
}, { timestamps: true, minimize: false })
directoryItemSchema.index({ directorySlug: 1, createdAt: -1 })
directoryItemSchema.index({ directorySlug: 1, 'attributes.userId': 1 })
directoryItemSchema.index({ directorySlug: 1, code: 1 })
directoryItemSchema.index({ title: 'text', code: 'text', description: 'text' })

const departmentSchema = new Schema({
    enterpriseId: { type: String },
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' }
}, { timestamps: true })
departmentSchema.index({ key: 1 }, { unique: true })

const directoryDefinitionSchema = new Schema({
    enterpriseId: { type: String },
    slug: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    aliases: { type: [String], default: [] },
    icon: { type: String, default: 'folder' },
    codeLabel: { type: String, default: 'Код / Идентификатор' },
    titleLabel: { type: String, default: 'Наименование' },
    groupByKey: { type: String, default: '' },
    fields: [{
        key: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'date', 'select', 'boolean', 'file'], default: 'text' },
        required: { type: Boolean, default: false },
        options: [{ label: String, value: Schema.Types.Mixed }],
        placeholder: { type: String, default: '' },
        span: { type: Number, enum: [1, 2], default: 1 }
    }],
    isSystem: { type: Boolean, default: false }
}, { timestamps: true })
directoryDefinitionSchema.index({ slug: 1 }, { unique: true })

const moloDatabaseSchema = new Schema({
    enterpriseId: { type: String },
    name: { type: String, required: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    collections: { type: [Schema.Types.Mixed], default: [] },
    createdBy: { _id: { type: String }, name: { type: String } },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})
moloDatabaseSchema.index({ name: 1 }, { unique: true })

const moloEndpointSchema = new Schema({
    enterpriseId: { type: String },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    methods: { type: [String], default: ['POST'] },
    moduleId: { type: String, required: true },
    file: { type: String, default: '' },
    access: { type: String, enum: ['public', 'key', 'members'], default: 'members' },
    secret: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    createdBy: { _id: { type: String }, name: { type: String } },
    stats: {
        calls: { type: Number, default: 0 },
        lastCallAt: { type: Date, default: null },
        lastStatus: { type: Number, default: null }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})
moloEndpointSchema.index({ slug: 1 }, { unique: true })

const dynamicModuleSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    fileName: { type: String, required: true, trim: true, maxlength: 80 },
    format: { type: String, enum: ['vue', 'js', 'ts', 'py'], required: true },
    description: { type: String, default: '', maxlength: 500 },
    isPublic: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    previewImage: { type: String, default: null },
    code: { type: String, default: '' },
    files: { type: [Schema.Types.Mixed], default: [] },
    dependencies: { type: Schema.Types.Mixed, default: () => ({}) },
    devDependencies: { type: Schema.Types.Mixed, default: () => ({}) },
    clientHooks: { type: Schema.Types.Mixed, default: () => ({}) },
    composables: { type: [String], default: [] },
    serverEntry: { type: String, default: '' },
    hasServerCode: { type: Boolean, default: false },
    clientBundle: { type: String, default: '', select: false },
    version: { type: Number, default: 1 },
    createdBy: { _id: { type: String }, name: { type: String } }
}, { timestamps: true, minimize: false })
dynamicModuleSchema.index({ fileName: 1 }, { unique: true })
dynamicModuleSchema.index({ isPublic: 1, isActive: 1 })

const menuSchema = new Schema({
    enterpriseId: { type: String },
    items: { type: [Schema.Types.Mixed], default: [] },
    updatedAt: { type: Date, default: Date.now }
})

export const TENANT_MODELS = {
    WorkspaceFolder: workspaceFolderSchema,
    WorkspaceDocument: workspaceDocumentSchema,
    WorkspaceDocumentVersion: workspaceDocumentVersionSchema,
    DirectoryItem: directoryItemSchema,
    Department: departmentSchema,
    DirectoryDefinition: directoryDefinitionSchema,
    MoloDatabase: moloDatabaseSchema,
    MoloEndpoint: moloEndpointSchema,
    DynamicModule: dynamicModuleSchema,
    Menu: menuSchema
} as const

export type TenantModelName = keyof typeof TENANT_MODELS
