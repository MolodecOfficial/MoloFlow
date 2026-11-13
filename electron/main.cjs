
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { fork, spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')
const http = require('node:http')
const https = require('node:https')

const isDev = !app.isPackaged

let serverProc = null
let win = null
let downloadedInstallerPath = null

const FIXED_PORT = 31415
const GITHUB_REPO = 'MolodecOfficial/MoloFlow'

// ────────── Squirrel events ──────────

function handleSquirrelEvent() {
    if (process.platform !== 'win32') return false

    const command = process.argv[1]

    if (!command || !command.startsWith('--squirrel-')) {
        return false
    }

    const appFolder = path.resolve(
        path.dirname(process.execPath),
        '..'
    )

    const updateExe = path.join(appFolder, 'Update.exe')
    const exeName = path.basename(process.execPath)

    function runUpdate(args) {
        if (!fs.existsSync(updateExe)) {
            console.warn('[MoloFlow] Update.exe не найден:', updateExe)
            return
        }

        const child = spawn(updateExe, args, {
            detached: true,
            stdio: 'ignore'
        })

        child.on('error', error => {
            console.error('[MoloFlow] Ошибка Squirrel:', error)
        })

        child.unref()
    }

    switch (command) {
        case '--squirrel-install':
        case '--squirrel-updated':
            runUpdate(['--createShortcut', exeName])
            break

        case '--squirrel-uninstall':
            runUpdate(['--removeShortcut', exeName])
            break

        case '--squirrel-obsolete':
            break

        default:
            console.warn('[MoloFlow] Неизвестное событие Squirrel:', command)
    }

    app.quit()
    return true
}

// ────────── Environment ──────────

function loadEnvironment() {
    const envPaths = [
        path.join(app.getPath('userData'), '.env'),
        path.join(process.resourcesPath || '', '.env'),
        path.join(path.dirname(process.execPath || ''), '.env'),
        path.join(__dirname, '..', '.env')
    ]

    for (const envFile of envPaths) {
        if (!fs.existsSync(envFile)) continue

        try {
            const content = fs.readFileSync(envFile, 'utf8')

            for (const line of content.split(/\r?\n/)) {
                const trimmed = line.trim()

                if (!trimmed || trimmed.startsWith('#')) continue

                const match = trimmed.match(
                    /^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/
                )

                if (!match) continue

                const key = match[1]
                let value = match[2].trim()

                if (
                    (value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'")) ||
                    (value.startsWith('`') && value.endsWith('`'))
                ) {
                    const quote = value[0]
                    value = value.slice(1, -1)

                    if (quote === '"') {
                        value = value
                            .replace(/\\n/g, '\n')
                            .replace(/\\r/g, '\r')
                            .replace(/\\"/g, '"')
                    }
                } else {
                    value = value.replace(/\s+#.*$/, '').trim()
                }

                if (process.env[key] === undefined) {
                    process.env[key] = value
                }
            }

            console.log(`[MoloFlow] Загружена конфигурация: ${envFile}`)
            return
        } catch (error) {
            console.error(
                `[MoloFlow] Ошибка чтения ${envFile}:`,
                error.message
            )
        }
    }

    console.warn('[MoloFlow] Файл .env не найден')
}

// ────────── Server ──────────

function getServerPort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer()

        srv.once('error', () => {
            const fallback = net.createServer()

            fallback.once('error', reject)

            fallback.listen(0, '127.0.0.1', () => {
                const { port } = fallback.address()
                fallback.close(() => resolve(port))
            })
        })

        srv.listen(FIXED_PORT, '127.0.0.1', () => {
            srv.close(() => resolve(FIXED_PORT))
        })
    })
}

function waitForServer(port, timeoutMs = 45000) {
    const start = Date.now()

    return new Promise((resolve, reject) => {
        const tick = () => {
            const request = http.get(
                {
                    host: '127.0.0.1',
                    port,
                    path: '/'
                },
                res => {
                    res.resume()
                    resolve()
                }
            )

            request.on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    reject(
                        new Error(
                            'Сервер Nuxt не ответил за отведенное время'
                        )
                    )
                } else {
                    setTimeout(tick, 300)
                }
            })
        }

        tick()
    })
}

async function startServer() {
    const outputDir = isDev
        ? path.join(__dirname, '..', '.output')
        : path.join(process.resourcesPath, '.output')

    const serverEntry = path.join(outputDir, 'server', 'index.mjs')

    if (!fs.existsSync(serverEntry)) {
        throw new Error(`Серверный файл не найден: ${serverEntry}`)
    }

    const port = await getServerPort()

    const logDir = app.getPath('userData')

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
    }

    const logStream = fs.createWriteStream(
        path.join(logDir, 'server.log'),
        { flags: 'a' }
    )

    serverProc = fork(serverEntry, [], {
        cwd: logDir,
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_ENV: 'production',
            NITRO_HOST: '127.0.0.1',
            NITRO_PORT: String(port),
            HOST: '127.0.0.1',
            PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    serverProc.stdout.on('data', data => {
        logStream.write(`[STDOUT] ${data}`)

        if (isDev) {
            console.log('[server]', data.toString())
        }
    })

    serverProc.stderr.on('data', data => {
        logStream.write(`[STDERR] ${data}`)

        if (isDev) {
            console.error('[server]', data.toString())
        }
    })

    serverProc.on('error', error => {
        logStream.write(`[PROCESS ERROR] ${error.stack || error}\n`)
    })

    serverProc.on('exit', code => {
        logStream.write(`[EXIT] код ${code}\n`)
        logStream.end()
    })

    await waitForServer(port)

    return port
}

function killServer() {
    if (!serverProc) return

    try {
        if (process.platform === 'win32') {
            spawn('taskkill', [
                '/pid',
                String(serverProc.pid),
                '/f',
                '/t'
            ], {
                windowsHide: true,
                stdio: 'ignore'
            })
        } else {
            serverProc.kill('SIGTERM')
        }
    } catch (error) {
        console.error('[MoloFlow] Ошибка остановки сервера:', error)
    }

    serverProc = null
}

function resolveAppIcon() {
    const candidates = [
        path.join(process.resourcesPath || '', 'public', 'favicon.ico'),
        path.join(__dirname, '..', 'public', 'favicon.ico'),
        path.join(__dirname, 'public', 'favicon.ico')
    ]

    return candidates.find(file => fs.existsSync(file)) || undefined
}

// ────────── GitHub updater ──────────

function fetchJson(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            return reject(new Error('Слишком много перенаправлений GitHub API'))
        }

        https.get(
            url,
            {
                headers: {
                    'User-Agent': 'MoloFlow-Updater',
                    Accept: 'application/vnd.github+json'
                }
            },
            res => {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location
                ) {
                    res.resume()

                    return resolve(
                        fetchJson(res.headers.location, redirectCount + 1)
                    )
                }

                if (res.statusCode !== 200) {
                    res.resume()

                    return reject(
                        new Error(`GitHub API вернул статус ${res.statusCode}`)
                    )
                }

                let data = ''

                res.setEncoding('utf8')

                res.on('data', chunk => {
                    data += chunk
                })

                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data))
                    } catch (error) {
                        reject(error)
                    }
                })
            }
        ).on('error', reject)
    })
}

function downloadFile(fileUrl, destPath, onProgress, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 10) {
            return reject(new Error('Слишком много перенаправлений при скачивании'))
        }

        const options = {
            headers: {
                'User-Agent': 'MoloFlow-Updater'
            }
        }

        const handleResponse = res => {
            if (
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                res.resume()

                return downloadFile(
                    res.headers.location,
                    destPath,
                    onProgress,
                    redirectCount + 1
                ).then(resolve, reject)
            }

            if (res.statusCode !== 200) {
                res.resume()

                return reject(
                    new Error(`Ошибка скачивания файла: ${res.statusCode}`)
                )
            }

            const totalBytes = parseInt(
                res.headers['content-length'] || '0',
                10
            )

            let receivedBytes = 0

            const fileStream = fs.createWriteStream(destPath)

            res.on('data', chunk => {
                receivedBytes += chunk.length

                if (totalBytes > 0) {
                    const percent = Math.round(
                        (receivedBytes / totalBytes) * 100
                    )

                    onProgress({
                        percent,
                        transferredBytes: receivedBytes,
                        totalBytes
                    })
                }
            })

            res.on('error', error => {
                fileStream.destroy()
                fs.unlink(destPath, () => {})
                reject(error)
            })

            fileStream.on('finish', () => {
                fileStream.close(() => resolve(destPath))
            })

            fileStream.on('error', error => {
                fs.unlink(destPath, () => {})
                reject(error)
            })

            res.pipe(fileStream)
        }

        https.get(fileUrl, options, handleResponse).on('error', error => {
            fs.unlink(destPath, () => {})
            reject(error)
        })
    })
}

// ────────── Updater IPC ──────────

ipcMain.handle('updater:check', async () => {
    try {
        const release = await fetchJson(
            `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
        )

        const tagName = release.tag_name || ''
        const remoteVersion = tagName.replace(/^v/, '')
        const currentVersion = app.getVersion()

        const exeAsset = (release.assets || []).find(asset =>
            asset.name.toLowerCase().endsWith('.exe')
        )

        return {
            hasUpdate: remoteVersion !== currentVersion,
            latestVersion: remoteVersion,
            notes: release.body || '',
            downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
            fileName: exeAsset ? exeAsset.name : null,
            fileSize: exeAsset ? exeAsset.size : 0
        }
    } catch (error) {
        return {
            error: error.message
        }
    }
})

ipcMain.handle('updater:download', async (_, downloadUrl) => {
    if (!downloadUrl) {
        throw new Error('URL скачивания не указан')
    }

    const tempDir = app.getPath('temp')

    const fileName = path.basename(
        new URL(downloadUrl).pathname
    ) || 'MoloFlow-Setup.exe'

    const targetPath = path.join(tempDir, fileName)

    try {
        await downloadFile(downloadUrl, targetPath, progress => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('updater:progress', progress)
            }
        })

        downloadedInstallerPath = targetPath

        if (win && !win.isDestroyed()) {
            win.webContents.send('updater:complete', {
                path: targetPath
            })
        }

        return {
            success: true,
            path: targetPath
        }
    } catch (error) {
        if (win && !win.isDestroyed()) {
            win.webContents.send('updater:error', error.message)
        }

        throw error
    }
})

ipcMain.handle('updater:install', async () => {
    if (
        !downloadedInstallerPath ||
        !fs.existsSync(downloadedInstallerPath)
    ) {
        throw new Error('Файл установщика не найден')
    }

    const installer = spawn(downloadedInstallerPath, [], {
        detached: true,
        stdio: 'ignore'
    })

    installer.on('error', error => {
        console.error('[MoloFlow] Ошибка запуска установщика:', error)
    })

    installer.unref()

    app.quit()
})

// ────────── Window ──────────

async function createWindow() {
    try {
        const port = await startServer()

        win = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1024,
            minHeight: 700,
            show: false,
            backgroundColor: '#14121c',
            icon: resolveAppIcon(),
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                webviewTag: true
            }
        })

        win.removeMenu()

        win.once('ready-to-show', () => {
            win.show()
        })

        await win.loadURL(`http://127.0.0.1:${port}`)
    } catch (error) {
        const logPath = path.join(
            app.getPath('userData'),
            'server.log'
        )

        dialog.showErrorBox(
            'Ошибка запуска MoloFlow',
            `${error.message}\n\nПодробный лог сохранен в:\n${logPath}`
        )

        app.quit()
    }
}

// ────────── App lifecycle ──────────

const squirrelHandled = handleSquirrelEvent()

if (!squirrelHandled) {
    loadEnvironment()

    app.whenReady().then(createWindow)

    app.on('window-all-closed', () => {
        killServer()
        app.quit()
    })

    app.on('before-quit', killServer)
}
