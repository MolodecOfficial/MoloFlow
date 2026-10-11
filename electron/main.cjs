const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { fork, spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')
const http = require('node:http')
const https = require('node:https')
const dotenv = require('dotenv')

const isDev = !app.isPackaged
let serverProc = null
let win = null
let downloadedInstallerPath = null

const FIXED_PORT = 31415
const GITHUB_REPO = 'MolodecOfficial/MoloFlow'

function loadEnvironment() {
    const envPaths = [
        path.join(app.getPath('userData'), '.env'),
        path.join(process.resourcesPath || '', '.env'),
        path.join(path.dirname(process.execPath || ''), '.env'),
        path.join(__dirname, '..', '.env')
    ]

    for (const envFile of envPaths) {
        if (fs.existsSync(envFile)) {
            dotenv.config({ path: envFile })
            break
        }
    }
}

loadEnvironment()

function getServerPort() {
    return new Promise((resolve) => {
        const srv = net.createServer()
        srv.once('error', () => {
            const fallback = net.createServer()
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
            http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
                res.resume()
                resolve()
            }).on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    reject(new Error('Сервер Nuxt не ответил за отведенное время'))
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

    const embeddedPython = path.join(process.resourcesPath || '', 'python', 'python.exe')
    const pythonBin = fs.existsSync(embeddedPython) ? embeddedPython : (process.env.PYTHON_BIN || '')

    const logDir = app.getPath('userData')
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    const logStream = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' })

    serverProc = fork(serverEntry, [], {
        cwd: logDir,
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_ENV: 'production',
            NITRO_HOST: '127.0.0.1',
            NITRO_PORT: String(port),
            HOST: '127.0.0.1',
            PORT: String(port),
            ...(pythonBin ? { PYTHON_BIN: pythonBin } : {})
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    serverProc.stdout.on('data', d => {
        logStream.write(`[STDOUT] ${d}`)
        if (isDev) console.log('[server]', d.toString())
    })
    serverProc.stderr.on('data', d => {
        logStream.write(`[STDERR] ${d}`)
        if (isDev) console.error('[server]', d.toString())
    })
    serverProc.on('exit', code => {
        logStream.write(`[EXIT] код ${code}\n`)
    })

    await waitForServer(port)
    return port
}

function killServer() {
    if (!serverProc) return
    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(serverProc.pid), '/f', '/t'])
        } else {
            serverProc.kill('SIGTERM')
        }
    } catch {}
    serverProc = null
}

function resolveAppIcon() {
    const candidates = [
        path.join(process.resourcesPath || '', 'public', 'favicon.ico'),
        path.join(__dirname, '..', 'public', 'favicon.ico'),
        path.join(__dirname, 'public', 'favicon.ico')
    ]
    return candidates.find(p => fs.existsSync(p)) || undefined
}

/* ────────── Загрузчик релизов с GitHub с прогресс-баром ────────── */

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'MoloFlow-Updater' }
        }
        https.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchJson(res.headers.location))
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`GitHub API вернул статус ${res.statusCode}`))
            }
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch (e) {
                    reject(e)
                }
            })
        }).on('error', reject)
    })
}

function downloadFile(fileUrl, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'MoloFlow-Updater' }
        }

        const handleResponse = (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return https.get(res.headers.location, options, handleResponse).on('error', reject)
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Ошибка скачивания файла: ${res.statusCode}`))
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
            let receivedBytes = 0

            const fileStream = fs.createWriteStream(destPath)

            res.on('data', (chunk) => {
                receivedBytes += chunk.length
                if (totalBytes > 0) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100)
                    onProgress({
                        percent,
                        transferredBytes: receivedBytes,
                        totalBytes
                    })
                }
            })

            res.pipe(fileStream)

            fileStream.on('finish', () => {
                fileStream.close(() => resolve(destPath))
            })

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {})
                reject(err)
            })
        }

        https.get(fileUrl, options, handleResponse).on('error', reject)
    })
}

ipcMain.handle('updater:check', async () => {
    try {
        const release = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
        const tagName = release.tag_name || ''
        const remoteVersion = tagName.replace(/^v/, '')
        const currentVersion = app.getVersion()

        const exeAsset = (release.assets || []).find(a => a.name.endsWith('.exe'))

        return {
            hasUpdate: remoteVersion !== currentVersion,
            latestVersion: remoteVersion,
            notes: release.body || '',
            downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
            fileName: exeAsset ? exeAsset.name : null,
            fileSize: exeAsset ? exeAsset.size : 0
        }
    } catch (err) {
        return { error: err.message }
    }
})

ipcMain.handle('updater:download', async (_, downloadUrl) => {
    if (!downloadUrl) throw new Error('URL скачивания не указан')

    const tempDir = app.getPath('temp')
    const fileName = path.basename(new URL(downloadUrl).pathname) || 'MoloFlow-Setup.exe'
    const targetPath = path.join(tempDir, fileName)

    try {
        await downloadFile(downloadUrl, targetPath, (progress) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('updater:progress', progress)
            }
        })

        downloadedInstallerPath = targetPath

        if (win && !win.isDestroyed()) {
            win.webContents.send('updater:complete', { path: targetPath })
        }
        return { success: true, path: targetPath }
    } catch (err) {
        if (win && !win.isDestroyed()) {
            win.webContents.send('updater:error', err.message)
        }
        throw err
    }
})

ipcMain.handle('updater:install', async () => {
    if (!downloadedInstallerPath || !fs.existsSync(downloadedInstallerPath)) {
        throw new Error('Файл установщика не найден')
    }

    spawn(downloadedInstallerPath, [], {
        detached: true,
        stdio: 'ignore'
    }).unref()

    app.quit()
})

/* ────────── Создание окна ────────── */

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
    } catch (e) {
        const logPath = path.join(app.getPath('userData'), 'server.log')
        dialog.showErrorBox(
            'Ошибка запуска MoloFlow',
            `${e.message}\n\nПодробный лог сохранен в:\n${logPath}`
        )
        app.quit()
    }
}

if (require('electron-squirrel-startup')) app.quit()

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { killServer(); app.quit() })
app.on('before-quit', killServer)