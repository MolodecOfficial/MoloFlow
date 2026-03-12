import EnterpriseUser from "~~/server/models/enterprise-user.model";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const { status, pointId, position } = getQuery(event);

    const filter: any = { enterpriseId };
    if (status) filter.status = status;
    if (pointId) filter.pointId = pointId;
    if (position) filter.position = position;

    try {
        const employees = await EnterpriseUser.find(filter)
            .populate('userId', 'name role')
            .populate('pointId', 'name city address');

        const stats = {
            total: employees.length,
            active: employees.filter(e => e.status === 'Активен').length,
            onVacation: employees.filter(e => e.status === 'В отпуске').length,
            fired: employees.filter(e => e.status === 'Уволен').length,
            byPosition: employees.reduce((acc, emp) => {
                acc[emp.position] = (acc[emp.position] || 0) + 1;
                return acc;
            }, {})
        };

        return { employees, stats };
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message });
    }
});