// server/utils/pythonVendorBundler.ts
import JSZip from 'jszip'

interface PyPiWheelInfo {
    filename: string
    url: string
    version: string
}

// Кэш скачанных wheel-пакетов в памяти процесса: package@version -> Buffer
const WHEEL_BUFFER_CACHE = new Map<string, Buffer>()

/**
 * Ищет подходящий wheel в PyPI API для pure-python библиотек
 */
async function resolvePyPiWheel(pkgName: string, versionSpec: string): Promise<PyPiWheelInfo | null> {
    try {
        const cleanName = pkgName.trim().toLowerCase()
        const res = await fetch(`https://pypi.org/pypi/${cleanName}/json`, {
            headers: { 'User-Agent': 'MoloFlow-WheelResolver/1.0' },
            signal: AbortSignal.timeout(10000)
        })
        if (!res.ok) return null

        const data: any = await res.json()
        const latestVersion = data.info?.version
        const targetVersion = (!versionSpec || versionSpec === 'latest' || versionSpec === '*')
            ? latestVersion
            : versionSpec.replace(/^[^0-9]+/, '')

        // Ищем файлы релиза
        const releases = data.releases?.[targetVersion] || data.urls || []
        
        // Приоритет 1: pure python 3 (py3-none-any.whl)
        let matched = releases.find((r: any) => 
            r.packagetype === 'bdist_wheel' && 
            r.filename && 
            r.filename.includes('none-any.whl')
        )

        // Приоритет 2: любой bdist_wheel
        if (!matched) {
            matched = releases.find((r: any) => r.packagetype === 'bdist_wheel')
        }

        if (!matched && releases.length > 0) {
            matched = releases[0]
        }

        if (matched?.url) {
            return {
                filename: matched.filename,
                url: matched.url,
                version: targetVersion
            }
        }
        return null
    } catch (e) {
        console.warn(`[VendorBundler] Не удалось получить данные PyPI для ${pkgName}:`, e)
        return null
    }
}

/**
 * Скачивает wheel файл по URL с поддержкой кэша в памяти
 */
async function fetchWheelBuffer(info: PyPiWheelInfo): Promise<Buffer | null> {
    const cacheKey = `${info.filename}@${info.version}`
    if (WHEEL_BUFFER_CACHE.has(cacheKey)) {
        return WHEEL_BUFFER_CACHE.get(cacheKey)!
    }

    try {
        const res = await fetch(info.url, {
            headers: { 'User-Agent': 'MoloFlow-WheelResolver/1.0' },
            signal: AbortSignal.timeout(30000)
        })
        if (!res.ok) return null
        const arrayBuf = await res.arrayBuffer()
        const buf = Buffer.from(arrayBuf)
        WHEEL_BUFFER_CACHE.set(cacheKey, buf)
        return buf
    } catch (e) {
        console.warn(`[VendorBundler] Ошибка скачивания wheel ${info.filename}:`, e)
        return null
    }
}

/**
 * Собирает общий zip-архив (vendor.zip) из списка зависимостей в base64
 */
export async function buildVendorZipBase64(dependencies: Record<string, string>): Promise<string> {
    const entries = Object.entries(dependencies || {})
        .filter(([n]) => !['moloflow_db', 'sys', 'os', 'json', 'typing', 'asyncio'].includes(n.toLowerCase()))

    if (entries.length === 0) return ''

    const masterZip = new JSZip()
    let addedCount = 0

    for (const [pkgName, version] of entries) {
        console.log(`[VendorBundler] Резолвинг пакета ${pkgName}@${version} из PyPI...`)
        const wheelInfo = await resolvePyPiWheel(pkgName, version)
        if (!wheelInfo) {
            console.warn(`[VendorBundler] Пакет ${pkgName} не найден в PyPI`)
            continue
        }

        const buf = await fetchWheelBuffer(wheelInfo)
        if (!buf) continue

        try {
            // Wheel — это обычный zip
            const wheelZip = await JSZip.loadAsync(buf)

            for (const [relativePath, zipEntry] of Object.entries(wheelZip.files)) {
                // Пропускаем метаданные dist-info/record, чтобы не раздувать архив
                if (relativePath.includes('.dist-info/') && (relativePath.endsWith('RECORD') || relativePath.endsWith('WHEEL'))) {
                    continue
                }
                if (!zipEntry.dir) {
                    const content = await zipEntry.async('nodebuffer')
                    masterZip.file(relativePath, content)
                }
            }
            addedCount++
            console.log(`[VendorBundler] Пакет ${pkgName} (${wheelInfo.version}) успешно упакован в бандл`)
        } catch (e) {
            console.warn(`[VendorBundler] Ошибка распаковки wheel для ${pkgName}:`, e)
        }
    }

    if (addedCount === 0) return ''

    const finalBuffer = await masterZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return finalBuffer.toString('base64')
}
