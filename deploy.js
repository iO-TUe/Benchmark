import { spawnSync } from "child_process";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const path = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Deploy all projects in the parent folder
 */
readdirSync(path).forEach(dir => {
    if (dir && !['benchmark', 'astro'].includes(dir)) {
        spawnSync('npm.cmd', ['run', 'deploy'], {
            env: process.env,
            cwd: join(path, dir),
            stdio: 'inherit'
        })
    }
})
