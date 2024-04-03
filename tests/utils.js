import { appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { UserFlow, generateReport } from 'lighthouse';
import { computeMedianRun } from 'lighthouse/core/lib/median-run';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, bench } from "vitest";

const iterations = 5
const warmupIterations = 2
const implementations = ['Qwik', 'React', 'Solid'],
    // const implementations = ['Qwik', 'React', 'Solid', 'Svelte', 'Vue'],
    runs = Object.fromEntries(implementations.map(($) => [$, []]))


const flowConfig = {
    config: {
        extends: 'lighthouse:default',
        settings: {
            throttlingMethod: 'devtools',
            maxWaitForLoad: 90_000,
            onlyCategories: ['performance'],
            skipAudits: [
                'screenshot-thumbnails',
                'final-screenshot',
                'non-composited-animations',
                'cumulative-layout-shift',
                'layout-shift-elements',
                'layout-shifts',
                'uses-long-cache-ttl'
            ],
            disableFullPageScreenshot: true,
            skipAboutBlank: true,
            usePassiveGathering: true
        }
    }
}

/**
 * Runs a benchmark of {@link fn} for all {@link implementations} provided. 
 * 
 * Sample size is set by {@link iterations} after {@link warmupIterations} warmup runs.
 * 
 * Before the benchmark, the tmp dir is cleared and all chrome processes are closed.
 * 
 * @param {Function} fn The benchmark function.
 * @param {boolean} [dry] Use results of the last benchmark instead of running a new one.
 */
function setup(fn, base, dry = false) {
    implementations.forEach((name) => {
        return bench(name, () => dry || fn(name, `https://io-${name.toLowerCase()}.web.app`), { iterations, warmupIterations });
    })

    if (dry) { // Load results of previous test run
        beforeAll(() => {
            readdirSync(`${base}/lighthouse`).forEach(file => {
                if (file.endswarmupIterationsth('.json')) {
                    let d = file.search(/\d/);
                    runs[file.slice(0, d)][file.slice(d, file.search(/\./))] =
                        (JSON.parse(readFileSync(`${base}/lighthouse/${file}`)));
                }
            })
            readdirSync(base).forEach(file => {
                if (file.endswarmupIterationsth('.csv')) {
                    renameSync(`${base}/${file}`, `${base}/${file.replace(/ - \[\d+\]/, '')}`)
                }
            })
        })
    } else { // Perform new benchmark run
        beforeAll(() => {
            rmSync(base, { recursive: true, force: true })
            mkdirSync(base)
            mkdirSync(`${base}/lighthouse`)
            spawnSync('taskkill', ['/fi', 'ImageName eq chrome.exe', '/F']);
        })
    }

    afterAll(() => Object.entries(runs).forEach(([name, results]) => {
        if (results.length === 0) return
        let lhr = results.slice(warmupIterations).map(flow => flow[0].lhr)
        lhr = warmupIterations + lhr.indexOf(computeMedianRun(lhr))
        // console.log('Median run:', name, iLHR + warmupIterations)

        let usage = readFileSync(`${base}/${name}CPU.csv`,
            { encoding: 'utf-8' }).split('\n').slice(1 + warmupIterations, -1)
        const [mCpu, mMem] = computeMedianUsage(usage)
        usage = warmupIterations + usage.findIndex(s =>
            +s.split(';')[2] === mCpu && +s.split(';')[1].replace(' K', '') === mMem
        )
        // console.log('Median usage:', name, iUSE)
        renameSync(`${base}/${name}CPU.csv`, `${base}/${name}CPU - [${usage}].csv`)
        writeFileSync(`${base}/${name}LHR - [${lhr}].json`, JSON.stringify(results[lhr], null, '\t'))
    }))
}

/**
 * Use Tasklist to retrieve all chrome.exe processes that have used at least {@link threshold}s of CPU time.
 * The process Status=unknown is used to filter out visible UI threads.
 * @param {number} threshold 
 * @returns {string[][]} Tuples of PID, Mem. usage and CPU time.
 */
function usage(threshold) {
    return spawnSync('tasklist', ['/fo', 'csv', '/v',
        '/fi', 'ImageName eq chrome.exe',
        '/fi', 'Status eq unknown'
    ], { encoding: 'utf-8' }).stdout.split('\n').slice(1, -1)
        .map(s => s.replaceAll('"', '').split(','))
        .map(a => [a[1], a[4], a[7].split(':')
            .reduce((t, s, i, a) => t += i + 1 < a.length ? s * 60 : +s, 0)])
        .filter(a => a[2] > threshold)
}

/**
 * Save results of this run to the filesystem. 
 * 
 * To get the differnce between two moments, a previous call to {@link usage()} can be provided as final argument.
 * 
 * @param {string} base 
 * @param {string} name 
 * @param {UserFlow} flow 
 * @param {number} threshold The minimum of CPU Time to filter on
 * @param {Array} usg Previous call to {@link usage()}
 */
async function saveResults(base, name, flow, threshold = 25, usg = undefined) {
    const iter = runs[name].length

    if (usg) usg = usg.reduce((obj, [pid, mem, cpu]) => ({ ...obj, [pid]: [mem, cpu] }), {})

    if (iter === 0) writeFileSync(`${base}/${name}CPU.csv`, 'PID;Memory;CPU;i\n')
    usage(threshold).forEach(([pid, mem, cpu]) => {
        if (usg[pid]) {
            mem = `${(+mem.split(' ')[0] * 1000 - +usg[pid][0].split(' ')[0] * 1000) / 1000} K`
            cpu -= usg[pid][1]
        }
        appendFileSync(`${base}/${name}CPU.csv`, `${pid};${mem};${cpu};${iter}\n`);
    })

    // console.log("Generating reports")
    const json = await flow.createFlowResult()
    writeFileSync(`${base}/lighthouse/${name + iter}.json`, JSON.stringify(json.steps, null, '\t'))
    writeFileSync(`${base}/lighthouse/${name + iter}.html`, generateReport(json, 'html'))
    runs[name].push(json.steps)
}

/**
 * Calculate the run closest to the median of CPU Time and Memory Usage. 
 * The calculation is made using the Euclidean distance of normalized values.
 * 
 * @param {Array<string>} usage CSV output of {@link usage()}
 * @returns {[number, number]} The median CPU and memory usage pair
 */
function computeMedianUsage(usage) {
    const [maxCpu, maxMem, normalCpuMem] = normalize(usage.map(s =>
        [+s.split(';')[2], +s.split(';')[1].replace(' K', '')]))
    const medianCpu = median(normalCpuMem.map(t => t[0]))
    const medianMem = median(normalCpuMem.map(t => t[1]))

    const nCpuMem = normalCpuMem.sort((a, b) => computeMedianDistance(a, medianCpu, medianMem) -
        computeMedianDistance(b, medianCpu, medianMem))[0]

    // Values are denormalized using the max values of the original array
    return [nCpuMem[0] * maxCpu, nCpuMem[1] * maxMem]
}

/**
 * Normalize elements of given nested array
 * 
 * @param {[[number, number]]} array 
 * @returns {[[number, number]]} Normalized array
 */
function normalize(array) {
    const max0 = Math.max(...array.map(t => t[0]))
    const max1 = Math.max(...array.map(t => t[1]))
    return [max0, max1, array.map((t) => [t[0] / max0, t[1] / max1])]
}

/**
 * Compute the median value of the provided array.
 * 
 * @param {Array<number>} array 
 * @returns {number} Median value
 */
function median(array) {
    const sorted = array.sort((a, b) => a - b)
    const half = Math.floor(sorted.length / 2)

    return sorted.length % 2 ? sorted[half]
        : (sorted[half - 1] + sorted[half]) / 2
}

/**
 * Calculate the distance of the CPU and memory pair to the median.
 * 
 * @param {[number, number]} cpu
 * @param {number} medianCpu
 * @param {number} medianMem 
 * @returns {number} Distance to the median CPU and Mem
 */
function computeMedianDistance(cpu, medianCpu, medianMem) {
    const distanceCpu = medianCpu - cpu[0]
    const distanceMem = medianMem - cpu[1]

    return distanceCpu ** 2 + distanceMem ** 2
}


export { computeMedianUsage, flowConfig, saveResults, setup, usage };

