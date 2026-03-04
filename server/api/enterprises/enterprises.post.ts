// server/api/enterprises/enterprise.post.ts
import Enterprise from "~~/server/models/enterprise.model";
import bcrypt from "bcrypt";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {enterpriseName, inn, kpp, ogrn, legalAddress, actualAddress, phone, email, director, okved, keypass, ownershipForm} = body

    if (!body) {
        return createError({ statusCode: 400, message: 'Ошибка: тело запроса не может быть пустым.' });
    }

    const existingEnterprise = await Enterprise.findOne({ enterpriseName })

    if (existingEnterprise) {
        throw createError({ statusCode: 400, message: "Предприятие уже существует в базе" })
    }

    const hashedKeypass = await bcrypt.hash(keypass, 10)

    const newEnterprise = new Enterprise({
        enterpriseName,
        inn,
        kpp,
        ogrn,
        legalAddress,
        actualAddress,
        phone,
        email,
        director,
        okved,
        keypass: hashedKeypass,
        ownershipForm
    })

    try {
        await newEnterprise.save()
        return {
            statusCode: 200,
            message: "Предприятие успешно добавлено в базу. Можете приступать к работе!",
            enterprise: {
                _id: newEnterprise._id,
                enterpriseName: newEnterprise.enterpriseName,
                inn: newEnterprise.inn,
                kpp: newEnterprise.kpp,
                ogrn: newEnterprise.ogrn,
                legalAddress: newEnterprise.legalAddress,
                actualAddress: newEnterprise.actualAddress,
                phone: newEnterprise.phone,
                email: newEnterprise.email,
                director: newEnterprise.director,
                okved: newEnterprise.okved,
                ownershipForm: newEnterprise.ownershipForm,
            }
        }
    } catch (error: any) {
        console.error('Ошибка при создании предприятия', error)

        // Проверяем на ошибки валидации Mongoose
        if (error.name === 'ValidationError') {
            // Создаем объект с переведенными сообщениями
            const translatedErrors: Record<string, string> = {};

            // Словарь для перевода названий полей
            const fieldNames: Record<string, string> = {
                inn: 'ИНН',
                kpp: 'КПП',
                ogrn: 'ОГРН',
                okved: 'ОКВЭД',
                enterpriseName: 'Название предприятия',
                legalAddress: 'Юридический адрес',
                actualAddress: 'Фактический адрес',
                phone: 'Телефон',
                email: 'Email',
                director: 'Руководитель',
                keypass: 'Ключ доступа',
                ownershipForm: 'Форма собственности'
            };

            // Обрабатываем каждое поле с ошибкой
            Object.keys(error.errors).forEach(field => {
                const fieldError = error.errors[field];
                const fieldName = fieldNames[field] || field;

                // Переводим тип ошибки
                if (fieldError.kind === 'required') {
                    translatedErrors[field] = `Поле "${fieldName}" обязательно для заполнения`;
                } else if (fieldError.kind === 'minlength') {
                    translatedErrors[field] = `Поле "${fieldName}" должно содержать минимум ${fieldError.minlength} символов`;
                } else if (fieldError.kind === 'maxlength') {
                    translatedErrors[field] = `Поле "${fieldName}" должно содержать максимум ${fieldError.maxlength} символов`;
                } else if (fieldError.kind === 'Number') {
                    translatedErrors[field] = `Поле "${fieldName}" должно быть числом`;
                } else {
                    translatedErrors[field] = `Поле "${fieldName}" заполнено некорректно`;
                }
            });

            // Возвращаем структурированную ошибку
            throw createError({
                statusCode: 400,
                message: "Ошибка валидации данных, проверьте формат введённых данных в сравнении с подсказками!",
                data: {
                    validationErrors: translatedErrors,
                    originalErrors: error.errors
                }
            });
        }

        throw createError({ statusCode: 500, message: error.message || "Произошла ошибка при создании" });
    }
})