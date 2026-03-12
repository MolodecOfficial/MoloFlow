import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
    enterpriseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Enterprise',
        required: true,
    },
    pointId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Point',
    }, // если null - план для всего предприятия
    period: {
        type: String,
        enum: ['day', 'week', 'month', 'quarter', 'year'],
        required: true,
    },
    date: {
        type: Date,
        required: true, // начало периода
    },
    metrics: {
        revenue: { // выручка план
            type: Number,
            default: 0,
        },
        expenses: { // расходы план
            type: Number,
            default: 0,
        },
        profit: { // прибыль план
            type: Number,
            default: 0,
        },
        customers: { // клиенты план
            type: Number,
            default: 0,
        },
        averageCheck: { // средний чек план
            type: Number,
            default: 0,
        },
    },
    actual: {
        revenue: { type: Number, default: 0 },
        expenses: { type: Number, default: 0 },
        profit: { type: Number, default: 0 },
        customers: { type: Number, default: 0 },
        averageCheck: { type: Number, default: 0 },
    }
}, {
    timestamps: true
});

// Виртуальное поле для разницы план/факт
planSchema.virtual('differences').get(function() {
    return {
        revenue: this.actual.revenue - this.metrics.revenue,
        expenses: this.actual.expenses - this.metrics.expenses,
        profit: this.actual.profit - this.metrics.profit,
        customers: this.actual.customers - this.metrics.customers,
        revenuePercent: this.metrics.revenue ?
            ((this.actual.revenue / this.metrics.revenue) * 100).toFixed(2) : 0,
        profitPercent: this.metrics.profit ?
            ((this.actual.profit / this.metrics.profit) * 100).toFixed(2) : 0,
    };
});

// Уникальный индекс для периода
planSchema.index({ enterpriseId: 1, pointId: 1, period: 1, date: 1 }, { unique: true });

export const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

export default mongoose.model('Plan', planSchema);