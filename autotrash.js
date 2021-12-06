const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync;


let root
const deletedCount = {
    files: 0,
    dirs:0
}
module.exports = async function(opts) {
    console.log('>> Begin purge process for %o with %o days.', opts.src, opts.days)
    const files = {}
    root = path.resolve(opts.src, './')
    console.log(' - Root: %o', root)
    await recoursereaddir(opts.src, files, async (file) => {
        if (file.isDirectory()) {
            return //ignore directory for now
        }
        const bestmod = new Date(file.mtime > file.birthtime ? file.mtime : file.birthtime)
        const diff = (new Date() - bestmod) / 1000 / 60 / 60 / 24
        //
        /*if (file.fpath.indexOf('dfgdfgd') > -1) {
            console.log(`%o`,file)
            console.log(`${diff}-${opts.days}`)
            process.exit(0)
        }*/
        if (diff > opts.days) {
            if (!file.isSymbolicLink()) {
                await purgeFile(files, file.fpath)
            } else {
                console.log(` %o cannot be deleted couse it is symbolic link.`, file.fpath)
            }

            //console.log(`%o need to be deleted.`, file.fpath)
        }
    })

    //console.log(files)

    let deleted = 1
    let cycles = 0
    while (deleted > 0 && cycles < 2) {
        //console.log(`Cycle %o`, cycles++)
        deleted = 0
        for (const dir in files) {
            const stat = files[dir]
            if (!stat.isDirectory()) {
                continue
            }
            if (stat.files > 0) {
                //skip is not empty
                console.log(`%o is not empty`, dir)
                continue
            }
            if (!stat.isSymbolicLink()) {
                if (await purgeDir(files, dir)) {
                    deleted++
                }
            } else {
                console.log(` %o cannot be deleted couse it is symbolic link.`, dir)
            }
        }
    }
    console.log(`Delete %o files and %o directories`, deletedCount.files, deletedCount.dirs)
    //console.log(files)
    //console.log('days %o', days)
}

const purgeDir = async (all, src) => {
    if (path.resolve(src).substr(0, root.length) != root) {
        throw new Error(`Cannot delete out of root dir ${src}`)
    }
    const atcfg = path.join(src, '.autotrash')
    let cfginfo = {
        directives: []
    }
    if (fs.existsSync(atcfg)) {
        const infostr = fs.readFileSync(atcfg).toString()
        try {
            const json = JSON.parse(infostr)
            cfginfo = json
        } catch (err) {
            if (infostr.indexOf('{') > -1) {
                throw err
            } else {
                cfginfo.directives = infostr.trim().split('\n')
            }
        }
    }
    if (cfginfo.directives.indexOf('donotdeleteme') == -1) {
        const mdir = path.dirname(src)
        if (all[mdir]) {
            all[mdir].files--
        }
        console.log(`%o dir deleted.`, src)        
        delete all[src]
        deletedCount.dirs++
        rawDeleteFolder(src)
        return true //deleted
    }
}

const purgeFile = async (all, src) => {
    if (path.resolve(src).substr(0, root.length) != root) {
        throw new Error(`Cannot delete out of root file ${src}`)
    }
    const basename = path.basename(src)
    if (basename == '.autotrash') {
        throw new Error(`Cannon delete ${src}`)
    }
    const mdir = path.dirname(src)

    if (all[mdir]) {
        all[mdir].files--
    }

    delete all[src]
    console.log(`%o deleted. Parent: %o`, src, all[mdir]?.files)
    deletedCount.files++
    rawDeleteFile(src)
}

const rawDeleteFile = async (src) => {
    fs.unlinkSync(src)
    //execSync(`kioclient move '${src}' trash:/`);
    //
}

const rawDeleteFolder = async (src) => {
    fs.rmdirSync(src)
    //execSync(`kioclient move '${src}' trash:/`);
}

const recoursereaddir = async (src, ret, cb) => {
    //console.log('Saan dir %o',src)
    const dirs = fs.readdirSync(src)
    //console.log(` %o contains %o elements`,src, dirs.length)
    let stopbyuser = false
    if (ret[src]) {
        ret[src].files = dirs.length
    }
    for (const f of dirs) {
        if (f == '.autotrash') {
            if (ret[src]) {
                ret[src].files--
            }
            continue
        }
        const full = path.join(src, f)
        let file
        try {
            file = fs.statSync(full)
        } catch (err) {
            const mstat = fs.lstatSync(full)
            if (mstat.isSymbolicLink()) {
                console.log('%o this is broken symbolic link. delete it', full)
                ret[src].files--
                await purgeFile(ret, full)
                continue
            }
        }

        file.fpath = full

        if (cb) {
            if (await cb(file) === false) {
                stopbyuser = true
                break
            }
        }
        ret[full] = file
        file.parent = ret[src]

        if (file.isDirectory() && !file.isSymbolicLink()) {
            if (await recoursereaddir(full, ret, cb) === false) {
                stopbyuser = true
                break
            }
        }
    }
    if (stopbyuser) {
        return false
    }
}