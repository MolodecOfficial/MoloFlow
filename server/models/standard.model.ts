import mongoose from 'mongoose'

const CellStyleSchema = new mongoose.Schema({
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    verticalAlign: { type: String, enum: ['top', 'middle', 'bottom'], default: 'top' },
    fontWeight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
    fontStyle: { type: String, enum: ['normal', 'italic'], default: 'normal' },
    fontSize: { type: Number, default: 13 },
    backgroundColor: { type: String, default: '' },
    textColor: { type: String, default: '#000000' },
    borderTop: { type: String, default: '' },
    borderBottom: { type: String, default: '' },
    borderLeft: { type: String, default: '' },
    borderRight: { type: String, default: '' }
})

const CellSchema = new mongoose.Schema({
    content: { type: String, default: '' },
    colspan: { type: Number, default: 1 },
    rowspan: { type: Number, default: 1 },
    hidden: { type: Boolean, default: false },
    style: { type: CellStyleSchema, default: () => ({}) }
})

const TableRowSchema = new mongoose.Schema({
    cells: [CellSchema],
    backgroundColor: { type: String, default: '' }
})

const standardSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['table', 'card', 'list'], default: 'table' },
    isDefault: { type: Boolean, default: false },
    tableRows: [TableRowSchema],
    cardSettings: { type: Object, default: {} },
    listSettings: { type: Object, default: {} },
    styles: { type: Object, default: {} },
    isActive: { type: Boolean, default: true }
}, { timestamps: true })

export const Standard = mongoose.models.Standard || mongoose.model('Standard', standardSchema)
export default Standard