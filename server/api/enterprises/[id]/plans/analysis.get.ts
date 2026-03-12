import Plan from "~~/server/models/plan.model";
import Point from "~~/server/models/point.model";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const { period, year, month, pointId } = getQuery(event);

    try {
        const filter: any = { enterpriseId };
        if (period) filter.period = period;
        if (pointId) filter.pointId = pointId;

        // Фильтр по дате
        if (year && month) {
            const startDate = new Date(Number(year), Number(month) - 1, 1);
            const endDate = new Date(Number(year), Number(month), 0);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const plans = await Plan.find(filter)
            .populate('pointId', 'name region city')
            .sort({ date: -1 });

        // Агрегированные данные
        const totalMetrics = plans.reduce((acc, plan) => {
            acc.planRevenue += plan.metrics.revenue;
            acc.planExpenses += plan.metrics.expenses;
            acc.planProfit += plan.metrics.profit;
            acc.actualRevenue += plan.actual.revenue;
            acc.actualExpenses += plan.actual.expenses;
            acc.actualProfit += plan.actual.profit;
            return acc;
        }, {
            planRevenue: 0, planExpenses: 0, planProfit: 0,
            actualRevenue: 0, actualExpenses: 0, actualProfit: 0
        });

        const differences = {
            revenue: totalMetrics.actualRevenue - totalMetrics.planRevenue,
            expenses: totalMetrics.actualExpenses - totalMetrics.planExpenses,
            profit: totalMetrics.actualProfit - totalMetrics.planProfit,
            revenuePercent: totalMetrics.planRevenue ?
                ((totalMetrics.actualRevenue / totalMetrics.planRevenue) * 100).toFixed(2) : 0,
            profitPercent: totalMetrics.planProfit ?
                ((totalMetrics.actualProfit / totalMetrics.planProfit) * 100).toFixed(2) : 0
        };

        // Группировка по точкам
        const byPoint = plans.reduce((acc, plan) => {
            const pointName = plan.pointId ? plan.pointId.name : 'Общий';
            if (!acc[pointName]) {
                acc[pointName] = {
                    plans: [],
                    totals: { planProfit: 0, actualProfit: 0, difference: 0 }
                };
            }
            acc[pointName].plans.push(plan);
            acc[pointName].totals.planProfit += plan.metrics.profit;
            acc[pointName].totals.actualProfit += plan.actual.profit;
            acc[pointName].totals.difference =
                acc[pointName].totals.actualProfit - acc[pointName].totals.planProfit;
            return acc;
        }, {});

        return {
            plans,
            totals: totalMetrics,
            differences,
            byPoint,
            totalCount: plans.length
        };
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message });
    }
});