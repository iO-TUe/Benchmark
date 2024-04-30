import { spawnSync } from "child_process";
import { readdirSync } from "fs";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";

const path = dirname(fileURLToPath(import.meta.url))

/**
 * Deploy all projects in the parent folder
 */
readdirSync(dirname(path)).forEach(dir => {
    if (dir && dir != basename(path)) {
        spawnSync('npm.cmd', ['run', 'deploy'], {
            env: process.env,
            cwd: join(dirname(path), dir),
            stdio: 'inherit'
        })
    }
})
