import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import prompts from 'prompts'
import semver from 'semver'
import dotenv from 'dotenv'

dotenv.config()

const pkgPath = path.resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
const currentVersion = pkg.version || '1.0.0'

console.log(`\n Текущая версия приложения: \x1b[36mv${currentVersion}\x1b[0m\n`)

const response = await prompts([
    {
        type: 'select',
        name: 'releaseType',
        message: 'Выберите тип обновления версии:',
        choices: [
            { title: `Patch (${semver.inc(currentVersion, 'patch')}) - мелкие фиксы`, value: 'patch' },
            { title: `Minor (${semver.inc(currentVersion, 'minor')}) - новый функционал`, value: 'minor' },
            { title: `Major (${semver.inc(currentVersion, 'major')}) - глобальное обновление`, value: 'major' },
            { title: 'Ввести версию вручную...', value: 'custom' },
            { title: 'Оставить текущую и просто собрать', value: 'same' }
        ]
    },
    {
        type: (prev) => (prev === 'custom' ? 'text' : null),
        name: 'customVersion',
        message: 'Введите новую версию (например, 1.2.0):',
        validate: (val) => semver.valid(val) ? true : 'Некорректный формат версии semver!'
    },
    {
        type: 'text',
        name: 'releaseNotes',
        message: 'Краткое описание изменений для GitHub Releases:',
        initial: 'Улучшения стабильности и исправление ошибок'
    }
])

if (!response.releaseType) {
    console.log('\n❌ Сборка отменена.')
    process.exit(0)
}

let nextVersion = currentVersion

if (response.releaseType === 'custom') {
    nextVersion = response.customVersion
} else if (response.releaseType !== 'same') {
    nextVersion = semver.inc(currentVersion, response.releaseType)
}

// 1. Обновляем package.json
if (nextVersion !== currentVersion) {
    pkg.version = nextVersion
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    console.log(`\n Версия в package.json обновлена на: \x1b[32mv${nextVersion}\x1b[0m\n`)
}

// 2. Сборка Nuxt
console.log('⚡ Компиляция проекта Nuxt...')
execSync('npm run build', { stdio: 'inherit' })

// 3. Сборка и публикация в GitHub Releases
console.log('🚀 Запуск сборки бинарников и публикации на GitHub...')
try {
    execSync('npx electron-forge publish', {
        stdio: 'inherit',
        env: {
            ...process.env,
            GITHUB_TOKEN: process.env.GITHUB_TOKEN
        }
    })
    console.log(`\n🎉 Релиз версии v${nextVersion} успешно опубликован на GitHub!`)
} catch (e) {
    console.error('\n❌ Ошибка во время публикации на GitHub! Проверьте наличие GITHUB_TOKEN в переменных окружения.', e)
    process.exit(1)
}