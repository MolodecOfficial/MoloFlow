// scripts/run-bot.js
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const botDir = join(root, 'bot')
const venvDir = join(botDir, '.venv')

const isWin = process.platform === 'win32'
const pyBin = isWin
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python')
const pipCmd = [pyBin, '-m', 'pip']

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
    if (r.status !== 0) {
        console.error(`\n❌ Команда упала: ${cmd} ${args.join(' ')}`)
        process.exit(r.status ?? 1)
    }
}

// 1. Проверяем/создаём venv
if (!existsSync(pyBin)) {
    console.log('📦 Создаю виртуальное окружение bot/.venv …')
    const sysPython = isWin ? 'python' : 'python3'
    run(sysPython, ['-m', 'venv', venvDir])
}

// 2. Проверяем наличие aiogram (маркер того, что зависимости стоят)
const check = spawnSync(
    pyBin,
    ['-c', 'import aiogram, openai, dotenv, aiohttp_socks'],
    { stdio: 'ignore' }
)
if (check.status !== 0) {
    console.log('📥 Устанавливаю зависимости из bot/requirements.txt …')
    run(pipCmd[0], [...pipCmd.slice(1), 'install', '--upgrade', 'pip'])
    run(pipCmd[0], [...pipCmd.slice(1), 'install', '-r', join(botDir, 'requirements.txt')])
}

// 3. Запускаем бота
console.log('🚀 Запускаю Telegram-бота …\n')
const bot = spawn(pyBin, [join(botDir, 'main.py')], {
    stdio: 'inherit',
    cwd: root,           // важно: .env ищем от корня проекта
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
})

bot.on('exit', code => process.exit(code ?? 0))