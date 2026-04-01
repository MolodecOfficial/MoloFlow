import Point from "~~/server/models/point.model";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const body = await readBody(event);

    const { name, region, city, address, type, positions, departments, contactPerson, metadata } = body;

    if (!name || !region || !city || !address) {
        throw createError({
            statusCode: 400,
            message: 'Заполните обязательные поля: название, регион, город, адрес'
        });
    }

    try {
        const newPoint = new Point({
            enterpriseId,
            name,
            region,
            city,
            address,
            type,
            positions: positions || [],
            departments: departments || [],
            contactPerson,
            metadata,
            status: 'Активна'
        });

        await newPoint.save();

        return {
            statusCode: 200,
            message: 'Точка успешно добавлена',
            point: newPoint
        };
    } catch (error: any) {
        if (error.code === 11000) {
            throw createError({
                statusCode: 400,
                message: 'Точка с таким названием уже существует'
            });
        }
        throw createError({ statusCode: 500, message: error.message });
    }
});