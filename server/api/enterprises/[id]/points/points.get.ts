import Point from "~~/server/models/point.model";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const { region, city, type, status } = getQuery(event);

    const filter: any = { enterpriseId };

    if (region) filter.region = region;
    if (city) filter.city = city;
    if (type) filter.type = type;
    if (status) filter.status = status;

    try {
        const points = await Point.find(filter).sort({ createdAt: -1 });

        const groupedByRegion = points.reduce((acc, point) => {
            if (!acc[point.region]) {
                acc[point.region] = [];
            }
            acc[point.region].push(point);
            return acc;
        }, {});

        return {
            points,
            groupedByRegion,
            total: points.length
        };
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message });
    }
});