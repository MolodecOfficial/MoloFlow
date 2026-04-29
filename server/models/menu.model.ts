import mongoose, { Schema, Document } from "mongoose";

export interface IMenuItem {
    id: string;
    title: string;
    requiredRole: ('Пользователь' | 'Сотрудник' | 'Управляющий')[];
    isActive: boolean;
    componentName?: string;
    componentPath?: string;
    items?: IMenuItem[];
    parentId?: string;
    isModule?: boolean;
    moduleId?: string;
    format?: string;
    moduleData?: any;
}

export interface IMenuGroup extends Document {
    id: string;
    title: string;
    order: number;
    requiredRole: string[];
    isActive: boolean;
    type: 'menu' | 'module';
    items: IMenuItem[];
}

const MenuItemSchema = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    type: {
        type: String,
        enum: ['folder', 'item'],
        default: 'item'
    },
    requiredRole: [{
        type: String,
        enum: ['Пользователь', 'Сотрудник', 'Управляющий'],
        required: true
    }],
    isActive: { type: Boolean, default: true },
    componentName: { type: String },
    componentPath: { type: String },
    isModule: { type: Boolean, default: false },
    moduleId: { type: String },
    format: { type: String },               // новое
    moduleData: { type: Schema.Types.Mixed }, // новое
    items: { type: [Schema.Types.Mixed], default: [] }
});

const menuSchema = new Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    requiredRole: [{
        type: String,
        enum: ['Пользователь', 'Сотрудник', 'Управляющий'],
        required: true
    }],
    isActive: { type: Boolean, default: true },
    type: { type: String, enum: ['menu', 'module'], default: 'menu' },
    items: { type: [MenuItemSchema], default: [] }
}, {
    timestamps: true
});

export const Menu = mongoose.models.Menu || mongoose.model('Menu', menuSchema);