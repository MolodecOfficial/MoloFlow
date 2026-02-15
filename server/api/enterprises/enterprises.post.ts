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

    const newEnterprise = new Enterprise({ enterpriseName, inn, kpp, ogrn, legalAddress, actualAddress, phone, email, director, okved, keypass: hashedKeypass, ownershipForm})
    try {
        await newEnterprise.save()
        return {
            statusCode: 200,
            message: "Предприятие успешно добавлено в базу",
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
        throw createError({ statusCode: 500, message: error.message || "Произошла ошибка при создании" });
    }
})
