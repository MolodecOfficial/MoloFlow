import Point from "~~/server/models/point.model";
import mongoose from "mongoose";

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id');
        const pointId = getRouterParam(event, 'pointId');

        // Проверяем валидность ID
        if (!mongoose.Types.ObjectId.isValid(pointId)) {
            throw createError({
                statusCode: 400,
                message: 'Неверный ID точки'
            });
        }

        // Ищем точку и проверяем, что она принадлежит предприятию
        const point = await Point.findOne({
            _id: pointId,
            enterpriseId: enterpriseId
        });

        if (!point) {
            throw createError({
                statusCode: 404,
                message: 'Точка не найдена'
            });
        }

        // Удаляем точку
        await Point.deleteOne({ _id: pointId });

        return {
            success: true,
            message: 'Точка успешно удалена',
            deletedId: pointId
        };

    } catch (error: any) {
        if (error.statusCode) {
            throw error;
        }

        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка при удалении точки'
        });
    }
});