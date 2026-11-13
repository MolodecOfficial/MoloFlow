export async function resolveLatestWheel(pkgName: string): Promise<{ version: string; wheelUrl: string }> {
    const res = await fetch(`https://pypi.org/pypi/${pkgName}/json`)
    if (!res.ok) throw new Error(`Пакет ${pkgName} не найден в PyPI`)
    const data = await res.json()
    const version = data.info.version
    
    // Ищем чистый pure-python wheel (*-py3-none-any.whl)
    const releases = data.urls || []
    const wheel = releases.find((r: any) => 
        r.packagetype === 'bdist_wheel' && r.filename.includes('py3-none-any')
    ) || releases.find((r: any) => r.packagetype === 'bdist_wheel')

    return {
        version,
        wheelUrl: wheel?.url || ''
    }
}