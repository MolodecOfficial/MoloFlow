
const path = require('node:path')

const iconPath = path.resolve(__dirname, 'public/favicon.ico')

const keepFiles = new Set([
    'package.json'
])

const keepDirectories = [
    'electron'
]

module.exports = {
    packagerConfig: {
        asar: true,
        name: 'MoloFlow',
        icon: iconPath,

        ignore: (file) => {
            const raw = String(file)

            const isAbsolute =
                /^[a-zA-Z]:[\\/]/.test(raw) ||
                raw.startsWith('\\\\')

            const relative = isAbsolute
                ? path.relative(__dirname, raw)
                : raw.replace(/^[/\\]+/, '')

            const normalized = relative
                .replace(/\\/g, '/')
                .replace(/^\.\//, '')

            if (
                !normalized ||
                normalized === '..' ||
                normalized.startsWith('../')
            ) {
                return false
            }

            const shouldKeep =
                keepFiles.has(normalized) ||
                keepDirectories.some(dir =>
                    normalized === dir ||
                    normalized.startsWith(dir + '/')
                )

            return !shouldKeep
        },

        extraResource: ['./.output', './.env']
    },

    rebuildConfig: {
        onlyModules: []
    },

    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'MoloFlow',
                setupIcon: iconPath
            }
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['win32']
        }
    ],

    publishers: [
        {
            name: '@electron-forge/publisher-github',
            config: {
                repository: {
                    owner: 'MolodecOfficial',
                    name: 'MoloFlow'
                },
                prerelease: false,
                draft: false
            }
        }
    ]
}
