import { defineEventHandler, getRouterParam, createError } from 'h3'
import archiver from 'archiver'
import { PassThrough } from 'stream'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')

    if (!enterpriseId) {
        throw createError({ statusCode: 400, statusMessage: 'Не указан ID предприятия' })
    }

    // 1. Параллельный сбор всех сущностей компании из базы данных
    const [enterprise, folders, documents, tabs, directories, modules] = await Promise.all([
        // Замените вызовы на ваши методы моделей/ORM (Mongoose, Prisma или Drizzle):
        event.context.db?.enterprises?.findById(enterpriseId),
        event.context.db?.workspaceFolders?.find({ enterpriseId }),
        event.context.db?.workspaceDocuments?.find({ enterpriseId }),
        event.context.db?.tabs?.find({ enterpriseId }),
        event.context.db?.directoryItems?.find({ enterpriseId }),
        event.context.db?.dynamicModules?.find({ enterpriseId })
    ])

    if (!enterprise) {
        throw createError({ statusCode: 404, statusMessage: 'Предприятие не найдено' })
    }

    // 2. Формирование ZIP-архива на лету в потоке
    const archive = archiver('zip', { zlib: { level: 9 } })
    const stream = new PassThrough()

    event.node.res.setHeader('Content-Type', 'application/zip')
    event.node.res.setHeader(
        'Content-Disposition',
        `attachment; filename="enterprise_${enterprise.inn || enterpriseId}_export.zip"`
    )

    archive.pipe(stream)

    // Главный манифест со всеми таблицами и связями
    const exportManifest = {
        exportDate: new Date().toISOString(),
        enterprise,
        schema: {
            tabs,
            directories,
            modules
        },
        workspace: {
            folders,
            documentsMeta: documents.map(({ data, ...meta }: any) => meta)
        }
    }

    archive.append(JSON.stringify(exportManifest, null, 2), { name: 'manifest.json' })

    // Выгрузка рабочих файлов и документов по папкам
    for (const doc of documents) {
        const ext = doc.type === 'excel' ? 'json' : doc.type === 'word' ? 'html' : 'bin'
        const content = typeof doc.data === 'object' ? JSON.stringify(doc.data, null, 2) : String(doc.data || '')
        archive.append(content, { name: `workspace_files/${doc.name || doc._id}.${ext}` })
    }

    await archive.finalize()
    return stream
})