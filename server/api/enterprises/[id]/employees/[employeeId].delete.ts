import Employee from "~~/server/models/employee.model";
import mongoose from "mongoose";

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id');
        const employeeId = getRouterParam(event, 'employeeId');

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            throw createError({
                statusCode: 400,
                message: 'Неверный ID сотрудника'
            });
        }

        // Ищем сотрудника
        const employee = await Employee.findOne({
            _id: employeeId,
            enterpriseId: enterpriseId
        });

        if (!employee) {
            throw createError({
                statusCode: 404,
                message: 'Сотрудник не найден'
            });
        }

        // Удаляем сотрудника
        await Employee.deleteOne({ _id: employeeId });

        return {
            success: true,
            message: 'Сотрудник успешно удален',
            deletedId: employeeId
        };

    } catch (error: any) {
        // Если ошибка уже создана через createError, пробрасываем её
        if (error.statusCode) {
            throw error;
        }

        // Обработка ошибок валидации MongoDB
        if (error.name === 'CastError') {
            throw createError({
                statusCode: 400,
                message: 'Неверный формат ID сотрудника'
            });
        }

        // Обработка ошибок с зависимостями
        if (error.code === 23503) { // foreign key violation
            throw createError({
                statusCode: 409,
                message: 'Невозможно удалить сотрудника, так как он имеет связанные записи'
            });
        }

        // Общая ошибка
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка при удалении сотрудника'
        });
    }
});