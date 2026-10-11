const path = require('node:path')

const iconPath = path.resolve(__dirname, 'public/favicon.ico')

module.exports = {
    packagerConfig: {
        asar: true,
        name: 'MoloFlow',
        icon: iconPath,
        ignore: (file) => {
            if (!file) return false
            if (file === '/node_modules') return false
            const keep = [
                '/package.json',
                '/electron',
                '/preload.cjs',
                '/node_modules/dotenv',
                '/node_modules/electron-squirrel-startup',
                '/node_modules/debug',
                '/node_modules/ms'
            ]
            return !keep.some(k => file === k || file.startsWith(k + '/'))
        },
        extraResource: ['./.output', './.env']
    },
    rebuildConfig: { onlyModules: [] },
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