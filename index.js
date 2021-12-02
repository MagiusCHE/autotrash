const fs = require('fs')
const path = require('path')
const autotrash = require('./autotrash')
const cmdlineOptions = [
    {
        name: 'help', alias: 'h', type: Boolean
        , description: 'Print this usage guide.'
    }
    , {
        name: 'days', alias: 'd',
        type: Number,
        description: 'Days after that file/dir will be trashed.',
        required: true
    }
    , {
        name: 'src', alias: 's', type: String,
        description: 'Path of the directory to scan.',
        typeLabel: '{underline dir} (default: {bold curdir})'
    }
]
const cmdLineUsageBlockOptions = {
    header: 'Options',
    optionList: cmdlineOptions
}
const cmdLineUsageOptions = [
    {
        header: 'Auto Trash Script',
        content: 'Purge files and directories if they pass specified days.'
    },
    {
        header: 'Examples',
        content: [
            {
                desc: 'Trash all files/dirs if they pass 10 days.',
                example: '$ autotrash {bold --days} {underline 10} [{bold --src} {underline /some/path}]'
            }
        ]
    },
    cmdLineUsageBlockOptions
];

(async () => {
    try {
        let cmdline, commandLineUsage
        try {
            commandLineUsage = require('command-line-usage')(cmdLineUsageOptions);
            cmdline = require('command-line-args')(cmdlineOptions);
            if (Object.keys(cmdline).length == 0) {
                throw new Error('Missing arguments')
            }
        } catch (err) {
            console.error('!Error:', err.message)
            commandLineUsage = require('command-line-usage')(cmdLineUsageOptions, {});
            console.log(commandLineUsage)
            return
        }

        const src = path.resolve(cmdline.src || '.')
        const days = cmdline.days
        const help = cmdline.help

        if (days <= 0) {
            throw new Error(`Invalid days argument. It must be greater than 0, passed ${days}`)
        }

        if (help) {
            console.log(commandLineUsage)
            return
        }
        if (!fs.existsSync(src)) {
            throw new Error(`Directory not exists: "${src}"`)
        }
        if (!fs.statSync(src).isDirectory()) {
            throw new Error(`Invalid directory "${src}"`)
        }

        await autotrash({
            src, days
        })
    } catch (err) {
        console.error(err)
        process.exitCode = 1
    }
})();