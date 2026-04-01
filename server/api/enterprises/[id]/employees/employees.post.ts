import Employee from "~~/server/models/employee.model";
import User from "~~/server/models/user.model";
import Point from "~~/server/models/point.model";

import bcrypt from "bcrypt";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const body = await readBody(event);
    const {
        userId, name, password, role,
        position, department, pointId, contacts
    } = body;

    // Валидация общих полей
    if (!position) {
        throw createError({
            statusCode: 400,
            message: 'Заполните обязательное поле: должность'
        });
    }

    try {
        let user;

        // Случай 1: Добавление существующего пользователя
        if (userId) {
            user = await User.findById(userId);
            if (!user) {
                throw createError({
                    statusCode: 404,
                    message: 'Пользователь не найден'
                });
            }

            // Обновляем телефон существующего пользователя, если он передан
            if (contacts?.phone) {
                // Очищаем телефон от форматирования
                const cleanPhone = contacts.phone.replace(/\D/g, '');
                user.phone = cleanPhone;
                await user.save();
            }
        }
        // Случай 2: Создание нового пользователя
        else {
            if (!name || !password) {
                throw createError({
                    statusCode: 400,
                    message: 'Заполните обязательные поля: имя, пароль'
                });
            }

            // Очищаем телефон от форматирования
            const cleanPhone = contacts?.phone ? contacts.phone.replace(/\D/g, '') : '';

            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({
                name,
                password: hashedPassword,
                role: role || 'Сотрудник',
                phone: cleanPhone // Добавляем телефон
            });

            await user.save();
        }

        // Проверяем, не привязан ли уже пользователь к этому предприятию
        const existingEmployee = await Employee.findOne({
            enterpriseId,
            userId: user._id
        });

        const selectedPoint = await Point.findById(pointId);
        if (selectedPoint) {
            if (position && !selectedPoint.positions?.includes(position)) {
                throw createError({
                    statusCode: 400,
                    message: `Должность "${position}" не доступна для выбранной точки`
                });
            }
            if (department && !selectedPoint.departments?.includes(department)) {
                throw createError({
                    statusCode: 400,
                    message: `Отдел "${department}" не доступен для выбранной точки`
                });
            }
        }

        if (existingEmployee) {
            throw createError({
                statusCode: 400,
                message: 'Пользователь уже является сотрудником этого предприятия'
            });
        }

        // Создаем запись в Employee
        const newEmployee = new Employee({
            enterpriseId,
            userId: user._id,
            position,
            department,
            role,
            pointId: pointId || null,
            contacts: {
                phone: contacts?.phone || user.phone || '',
                emergencyPhone: contacts?.emergencyPhone || ''
            },
            hireDate: new Date(),
            status: 'Активен'
        });

        await newEmployee.save();

        return {
            statusCode: 200,
            message: 'Сотрудник успешно добавлен',
            employee: {
                ...newEmployee.toObject(),
                user: {
                    _id: user._id,
                    name: user.name,
                    role: user.role,
                    phone: user.phone
                }
            }
        };
    } catch (error: any) {
        if (error.code === 11000) {
            throw createError({
                statusCode: 400,
                message: 'Пользователь с таким именем уже существует'
            });
        }
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message
        });
    }
});