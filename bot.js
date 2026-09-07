import 'dotenv/config'
import { Telegraf } from 'telegraf'
import OpenAI from 'openai'

// ──────────────────────────────────────────────────────────────
// НАСТРОЙКА
// ──────────────────────────────────────────────────────────────

import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const GROQ_API_KEY = process.env.GROQ_API_KEY
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'


const agent = process.env.HTTP_PROXY
    ? new HttpsProxyAgent(process.env.HTTP_PROXY)
    : undefined

if (!BOT_TOKEN || !GROQ_API_KEY) {
    console.error('Не заданы TELEGRAM_BOT_TOKEN или GROQ_API_KEY в .env')
    process.exit(1)
}

// Если хотите ограничить бота только собой — впишите свой Telegram user id
// (узнать его можно у бота @userinfobot) через запятую в .env
const ALLOWED_IDS = (process.env.ALLOWED_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

if (!BOT_TOKEN || !GROQ_API_KEY) {
    console.error('Не заданы TELEGRAM_BOT_TOKEN или GROQ_API_KEY в .env')
    process.exit(1)
}

// Groq отдаёт OpenAI-совместимый API — можно использовать обычный SDK openai,
// просто поменяв baseURL
const ai = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
})

const bot = new Telegraf(BOT_TOKEN, {
    telegram: {
        agent: agent,
        apiTimeout: 60000, // увеличиваем таймаут
        // apiRoot: 'https://api.telegram.org' // стандартный URL (можно не указывать)
    }
})
// Какие расширения считаем текстовыми/кодом (остальное — пропускаем)
const TEXT_EXT = new Set([
    '.vue', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt',
    '.py', '.go', '.java', '.css', '.scss', '.html', '.yml', '.yaml',
    '.env.example', '.sql', '.php', '.rb', '.sh'
])

// Ограничения, чтобы не улететь за пределы бесплатного лимита
const MAX_TOTAL_CHARS = 400_000       // ~100k токенов, с запасом под контекст 131k
const CHUNK_CHARS = 60_000            // ~15k токенов на один запрос суммаризации

// ──────────────────────────────────────────────────────────────
// ХРАНИЛИЩЕ СОБРАННЫХ ФАЙЛОВ (в памяти, на процесс)
// Для реальной нагрузки с несколькими пользователями стоит
// вынести в Redis/БД — но для личного/командного бота хватит и так.
// ──────────────────────────────────────────────────────────────

/** @type {Map<number, {files: {name:string, content:string}[], busy:boolean}>} */
const sessions = new Map()

function getSession(chatId) {
    if (!sessions.has(chatId)) {
        sessions.set(chatId, { files: [], busy: false })
    }
    return sessions.get(chatId)
}

function isAllowed(ctx) {
    if (ALLOWED_IDS.length === 0) return true
    return ALLOWED_IDS.includes(String(ctx.from.id))
}

function getExt(filename) {
    const i = filename.lastIndexOf('.')
    return i === -1 ? '' : filename.slice(i).toLowerCase()
}

// ──────────────────────────────────────────────────────────────
// ЗАГРУЗКА ФАЙЛА ИЗ TELEGRAM КАК ТЕКСТА
// ──────────────────────────────────────────────────────────────

async function downloadFileAsText(ctx, fileId) {
    const link = await ctx.telegram.getFileLink(fileId)
    const res = await fetch(link.href)
    if (!res.ok) throw new Error(`Не удалось скачать файл (${res.status})`)
    return await res.text()
}

// ──────────────────────────────────────────────────────────────
// РАЗБИВКА НА ЧАНКИ (map) + ФИНАЛЬНАЯ СБОРКА (reduce)
// Нужно, если суммарный объём кода не помещается в один запрос
// ──────────────────────────────────────────────────────────────

function buildChunks(files) {
    const chunks = []
    let current = []
    let currentSize = 0

    for (const f of files) {
        const block = `\n\n### Файл: ${f.name}\n\`\`\`\n${f.content}\n\`\`\`\n`
        if (currentSize + block.length > CHUNK_CHARS && current.length > 0) {
            chunks.push(current)
            current = []
            currentSize = 0
        }
        current.push({ ...f, block })
        currentSize += block.length
    }
    if (current.length) chunks.push(current)
    return chunks
}

async function summarizeChunk(chunkFiles, projectHint) {
    const filesText = chunkFiles.map(f => f.block).join('\n')

    const { choices } = await ai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'Ты технический писатель. По присланным файлам проекта коротко и по делу ' +
                    'опиши: назначение каждого файла/компонента, его входы (props/параметры), ' +
                    'что он делает, с чем взаимодействует. Пиши на русском, в виде списка. ' +
                    'Не придумывай того, чего нет в коде.'
            },
            {
                role: 'user',
                content:
                    (projectHint ? `Контекст проекта: ${projectHint}\n\n` : '') +
                    `Опиши следующие файлы:\n${filesText}`
            }
        ]
    })

    return choices[0].message.content
}

async function buildFinalDocs(summaries, projectHint) {
    const { choices } = await ai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
            {
                role: 'system',
                content:
                    'Ты технический писатель. На основе кратких описаний файлов проекта ' +
                    'составь связную документацию в формате Markdown на русском языке. ' +
                    'Структура: 1) Обзор проекта (1-2 абзаца), 2) Структура и назначение ' +
                    'компонентов/модулей (сгруппируй логически, не просто списком файлов), ' +
                    '3) Как всё взаимодействует между собой, 4) На что обратить внимание ' +
                    'при доработке. Пиши только на основе данных ниже, ничего не выдумывай.'
            },
            {
                role: 'user',
                content:
                    (projectHint ? `Контекст проекта: ${projectHint}\n\n` : '') +
                    `Вот описания файлов проекта:\n\n${summaries.join('\n\n---\n\n')}`
            }
        ]
    })

    return choices[0].message.content
}

async function generateDocumentation(files, projectHint, onProgress) {
    const totalChars = files.reduce((s, f) => s + f.content.length, 0)

    if (totalChars <= CHUNK_CHARS) {
        // Маленький проект — обходимся одним запросом
        onProgress?.('Файлов немного, отправляю всё одним запросом…')
        const summary = await summarizeChunk(
            files.map(f => ({ ...f, block: `\n\n### Файл: ${f.name}\n\`\`\`\n${f.content}\n\`\`\`\n` })),
            projectHint
        )
        return await buildFinalDocs([summary], projectHint)
    }

    // Проект большой — делаем map-reduce
    const chunks = buildChunks(files)
    onProgress?.(`Файлов много, разбиваю на ${chunks.length} частей и обрабатываю по очереди…`)

    const summaries = []
    for (let i = 0; i < chunks.length; i++) {
        onProgress?.(`Анализирую часть ${i + 1} из ${chunks.length}…`)
        const summary = await summarizeChunk(chunks[i], projectHint)
        summaries.push(summary)
    }

    onProgress?.('Собираю финальную документацию из всех частей…')
    return await buildFinalDocs(summaries, projectHint)
}

// ──────────────────────────────────────────────────────────────
// ХЭНДЛЕРЫ БОТА
// ──────────────────────────────────────────────────────────────

bot.start(ctx => {
    ctx.reply(
        'Привет! Я собираю документацию по коду.\n\n' +
        '1. Пришли мне файлы проекта (можно по одному, можно несколько подряд).\n' +
        '2. Когда закончишь — напиши /generate.\n' +
        '3. Я верну готовую документацию в виде .md файла.\n\n' +
        'Команды:\n' +
        '/generate — сгенерировать документацию по собранным файлам\n' +
        '/list — показать, что уже собрано\n' +
        '/reset — очистить список файлов\n\n' +
        'Необязательно: после /generate можешь одним сообщением описать, ' +
        'что это за проект — я учту это как контекст.'
    )
})

bot.command('reset', ctx => {
    sessions.delete(ctx.chat.id)
    ctx.reply('Список файлов очищен.')
})

bot.command('list', ctx => {
    const session = getSession(ctx.chat.id)
    if (session.files.length === 0) {
        return ctx.reply('Пока ничего не собрано — пришли файлы.')
    }
    const list = session.files.map((f, i) => `${i + 1}. ${f.name}`).join('\n')
    ctx.reply(`Собрано файлов: ${session.files.length}\n\n${list}`)
})

// Приём файлов
bot.on('document', async ctx => {
    if (!isAllowed(ctx)) return ctx.reply('Доступ к этому боту ограничен.')

    const session = getSession(ctx.chat.id)
    if (session.busy) return ctx.reply('Подожди, сейчас идёт генерация документации.')

    const doc = ctx.message.document
    const ext = getExt(doc.file_name || '')

    if (!TEXT_EXT.has(ext)) {
        return ctx.reply(`Пропускаю «${doc.file_name}» — это не текстовый/код-файл, я умею читать только код и текст.`)
    }

    const totalSize = session.files.reduce((s, f) => s + f.content.length, 0)
    if (totalSize > MAX_TOTAL_CHARS) {
        return ctx.reply('Достигнут лимит объёма для одного прогона (~100k токенов). Напиши /generate, чтобы обработать уже собранное, или /reset и начни новый набор.')
    }

    try {
        const content = await downloadFileAsText(ctx, doc.file_id)
        session.files.push({ name: doc.file_name, content })
        ctx.reply(`Добавил «${doc.file_name}» (${content.length} симв.). Всего файлов: ${session.files.length}.`)
    } catch (e) {
        console.error(e)
        ctx.reply(`Не смог прочитать «${doc.file_name}»: ${e.message}`)
    }
})

// Запуск генерации
bot.command('generate', async ctx => {
    if (!isAllowed(ctx)) return ctx.reply('Доступ к этому боту ограничен.')

    const session = getSession(ctx.chat.id)
    if (session.files.length === 0) {
        return ctx.reply('Сначала пришли файлы проекта, потом вызывай /generate.')
    }
    if (session.busy) {
        return ctx.reply('Уже генерирую, подожди немного.')
    }

    session.busy = true
    const statusMsg = await ctx.reply('Начинаю анализ…')

    const updateStatus = (text) => {
        ctx.telegram
            .editMessageText(ctx.chat.id, statusMsg.message_id, undefined, text)
            .catch(() => {})
    }

    try {
        const markdown = await generateDocumentation(session.files, null, updateStatus)

        // Отправляем результат файлом, чтобы не упереться в лимит длины сообщения Telegram
        await ctx.replyWithDocument(
            { source: Buffer.from(markdown, 'utf-8'), filename: 'DOCUMENTATION.md' },
            { caption: 'Готово! Документация сформирована по присланным файлам.' }
        )

        // И коротко — превью в чат (первые ~3000 символов)
        const preview = markdown.length > 3000 ? markdown.slice(0, 3000) + '\n\n…(полный текст в файле выше)' : markdown
        await ctx.reply(preview)
    } catch (e) {
        console.error(e)
        await ctx.reply(`Ошибка при генерации: ${e.message}\n\nЕсли это лимит запросов Groq — подожди минуту и попробуй ещё раз.`)
    } finally {
        session.busy = false
    }
})

bot.catch((err, ctx) => {
    console.error(`Ошибка у ${ctx.updateType}:`, err)
    ctx.reply('Что-то пошло не так, попробуй ещё раз.').catch(() => {})
})

bot.launch()
console.log('Бот запущен. Модель:', MODEL)

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))