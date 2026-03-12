import EnterpriseUser from "~~/server/models/enterprise-user.model";
import User from "~~/server/models/user.model";
import bcrypt from "bcrypt";

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');
    const body = await readBody(event);
    const {
        name, password, role,
        position, department, pointId, salary, contacts
    } = body;

    if (!name || !password || !position) {
        throw createError({
            statusCode: 400,
            message: 'Заполните обязательные поля: имя, пароль, должность'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            password: hashedPassword,
            role: role || 'Сотрудник'
        });

        await newUser.save();

        // 2. Привязываем к предприятию
        const newEnterpriseUser = new EnterpriseUser({
            enterpriseId,
            userId: newUser._id,
            position,
            department,
            pointId,
            salary,
            contacts,
            hireDate: new Date(),
            status: 'Активен'
        });

        await newEnterpriseUser.save();

        return {
            statusCode: 200,
            message: 'Сотрудник успешно добавлен',
            employee: {
                ...newEnterpriseUser.toObject(),
                user: {
                    _id: newUser._id,
                    name: newUser.name,
                    role: newUser.role
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
        throw createError({ statusCode: 500, message: error.message });
    }
});