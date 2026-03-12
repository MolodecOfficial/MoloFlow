import Plan from "~~/server/models/plan.model";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const period = getRouterParam(event, 'period');
    const body = await readBody(event);

    const { pointId, date, metrics } = body;

    if (!date || !metrics) {
        throw createError({ statusCode: 400, message: 'Необходимо указать дату и метрики' });
    }

    try {
        // Проверяем, есть ли уже план на этот период
        const existingPlan = await Plan.findOne({
            enterpriseId,
            pointId: pointId || null,
            period,
            date: new Date(date)
        });

        if (existingPlan) {
            throw createError({ statusCode: 400, message: 'План на этот период уже существует' });
        }

        const newPlan = new Plan({
            enterpriseId,
            pointId: pointId || null,
            period,
            date: new Date(date),
            metrics
        });

        await newPlan.save();

        return {
            statusCode: 200,
            message: 'План успешно создан',
            plan: newPlan
        };
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message });
    }
});