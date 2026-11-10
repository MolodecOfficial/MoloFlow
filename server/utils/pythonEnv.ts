// server/utils/pythonEnv.ts
import { createError } from 'h3'

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const VERSION_RE = /^[A-Za-z0-9.*+_\-<>=!~^, ]{0,60}$/

export function systemPython(): string {
    return 'cloud-python'
}

export function validateDependencies(deps: Record<string, string>): void {
    for (const [name, version] of Object.entries(deps || {})) {
        if (!NAME_RE.test(name)) {
            throw createError({ statusCode: 400, message: `Некорректное имя pip-пакета: «${name}»` })
        }
        if (version && !VERSION_RE.test(String(version))) {
            throw createError({ statusCode: 400, message: `Некорректная версия пакета ${name}: «${version}»` })
        }
    }
}

export function toPipSpec(name: string, version?: string): string {
    const v = String(version || '').trim()
    if (!v || v === 'latest' || v === '*') return name
    if (v.startsWith('^')) return `${name}>=${v.slice(1)}`
    if (v.startsWith('~') && !v.startsWith('~=')) return `${name}~=${v.slice(1)}`
    if (/^[<>=!~]/.test(v)) return `${name}${v}`
    return `${name}==${v}`
}

export async function ensurePythonEnv(
    _moduleId: string,
    deps: Record<string, string>,
    opts: { force?: boolean; log?: (text: string) => void } = {}
): Promise<string> {
    validateDependencies(deps || {})
    const specs = Object.entries(deps || {}).map(([n, v]) => toPipSpec(n, v))
    opts.log?.(`[MoloDB Cloud] Зависимости синхронизированы в БД: ${specs.join(', ') || 'нет'}`)
    return 'cloud-python'
}