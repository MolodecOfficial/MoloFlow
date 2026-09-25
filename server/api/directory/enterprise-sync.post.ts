import { defineEventHandler, readBody, createError } from 'h3'
import { DirectoryItem } from '~~/server/models/directoryItem.model'
import { Enterprise } from '~~/server/models/enterprise.model'
import { User } from '~~/server/models/user.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { enterpriseId } = body

    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'enterpriseId обязателен' })
    }

    const enterprise: any = await Enterprise.findById(enterpriseId)
    if (!enterprise) {
        throw createError({ statusCode: 404, message: 'Предприятие не найдено' })
    }

    let importedCount = 0

    // 1. СИНХРОНИЗАЦИЯ УЧАСТНИКОВ В «Должности и отделы» (departments)
    if (Array.isArray(enterprise.members) && enterprise.members.length > 0) {
        // Получаем реальные данные пользователей (имя, телефон)
        const userIds = enterprise.members.map((m: any) => m.userId)
        const users: any[] = await User.find({ _id: { $in: userIds } })
        const userMap = new Map(users.map((u) => [String(u._id), u]))

        for (const member of enterprise.members) {
            const u = userMap.get(String(member.userId))
            const userName = u?.name || 'Без имени'
            const roleName = member.role || 'Сотрудник'

            // Проверяем, есть ли уже этот пользователь в справочнике
            const existing = await DirectoryItem.findOne({
                enterpriseId,
                directorySlug: 'departments',
                'attributes.userId': String(member.userId)
            })

            if (!existing) {
                await DirectoryItem.create({
                    enterpriseId,
                    directorySlug: 'departments',
                    title: `${userName}`,
                    code: member.role,
                    description: `Телефон: ${u?.phone || 'не указан'}`,
                    attributes: {
                        userId: String(member.userId),
                        role: member.role,
                        phone: u?.phone || '',
                        joinedAt: member.joinedAt || new Date().toISOString()
                    }
                })
                importedCount++
            } else {
                // Обновляем роль, если она изменилась (например, стал управляющим)
                existing.title = `${userName}`
                existing.code = member.role
                existing.attributes = {
                    ...existing.attributes,
                    role: member.role,
                    phone: u?.phone || ''
                }
                await existing.save()
            }
        }
    }

    // 2. СИНХРОНИЗАЦИЯ БАНКОВСКИХ СЧЕТОВ (bank_accounts)
    if (Array.isArray(enterprise.bankAccounts)) {
        for (const acc of enterprise.bankAccounts) {
            const exists = await DirectoryItem.findOne({
                enterpriseId,
                directorySlug: 'bank_accounts',
                code: acc.accountNumber || acc.bik
            })

            if (!exists) {
                await DirectoryItem.create({
                    enterpriseId,
                    directorySlug: 'bank_accounts',
                    title: acc.bankName || 'Банковский счет',
                    code: acc.accountNumber || acc.bik || '',
                    description: `БИК: ${acc.bik || '—'}, Корр: ${acc.corrAccount || '—'}`,
                    attributes: { ...acc }
                })
                importedCount++
            }
        }
    }

    // 3. СИНХРОНИЗАЦИЯ РЕКВИЗИТОВ САМОГО ПРЕДПРИЯТИЯ (counterparties)
    const selfExists = await DirectoryItem.findOne({
        enterpriseId,
        directorySlug: 'counterparties',
        code: enterprise.inn
    })

    if (!selfExists && enterprise.inn) {
        await DirectoryItem.create({
            enterpriseId,
            directorySlug: 'counterparties',
            title: `${enterprise.enterpriseName || 'Организация'} (Наша компания)`,
            code: enterprise.inn,
            description: `КПП: ${enterprise.kpp || '—'}, ОГРН: ${enterprise.ogrn || '—'}`,
            attributes: {
                isSelf: true,
                inn: enterprise.inn,
                kpp: enterprise.kpp,
                address: enterprise.legalAddress
            }
        })
        importedCount++
    }

    return { success: true, importedCount }
})