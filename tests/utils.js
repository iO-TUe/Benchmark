import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { defaultConfig, generateReport } from 'lighthouse';
import { computeMedianRun } from 'lighthouse/core/lib/median-run';
import { spawnSync } from 'node:child_process';
import { basename } from 'path';
import { afterAll, beforeAll, bench } from "vitest";

/** @type {'h' | 'd' | 'v'} */
const hdlss = 'v'
const iterations = 8
const warmupIterations = 0
// const implementations = ['Next', 'Nuxt', 'Qwik', 'React', 'Solid', 'Svelte', 'Vue'],
const implementations = ['Svelte'],
    runs = Object.fromEntries(implementations.map(($) => [$, []]))

/**
 * Starts a Puppeteer browser instance on {@link url} and runs some {@link import('lighthouse).UserFlow}.
 * 
 * Launch options can be provided via {@link options} and {@link flowConfig} is used for flow configration.
 * @callback Flows
 * @param {string} base 
 * @param {string} name 
 * @param {string} url 
 * @param {import('puppeteer').PuppeteerLaunchOptions} options 
*/

/**
 * Uses {@link defaultConfig}.
 * 
 * To speed up tests the RootCauses & TraceElements artifacts should manually be disabled 
 * in the depency itself. Unfortunetely, this cannot be done automatically without forking the library.
 * 
 * @type {import('lighthouse').UserFlow.Options}
*/
const flowConfig = {
    config: {
        extends: 'lighthouse:default',
        settings: {
            throttling: {
                cpuSlowdownMultiplier: 1
            },
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
        },
    },
    flags: {
        screenEmulation: { disabled: true }
    }
}

/**
 * Runs a benchmark of {@link fn} for all {@link implementations} provided. 
 * 
 * Sample size is set by {@link iterations} after {@link warmupIterations} warmup runs.
 * 
 * Before the benchmark, the tmp dir is cleared and all chrome processes are closed.
 * 
 * @param {Flows} fn The benchmark function.
 * @param {string} base Current file
*/
function setup(fn, base) {
    base = `./tmp/${basename(base).split('.')[0]}`
    implementations.forEach((name) => bench(name, () => fn(base, name, `https://io-tue.web.app/${name.toLowerCase()}`,
        { headless: hdlss == 'h', devtools: hdlss == 'd', protocolTimeout: 240_000 }), { iterations, warmupIterations }))

    beforeAll(() => {
        if (!existsSync('./tmp')) mkdirSync('./tmp')
        rmSync(base, { recursive: true, force: true })
        mkdirSync(base)
        mkdirSync(`${base}/lighthouse`)
        if (hdlss == 'h') spawnSync('taskkill', ['/fi', 'ImageName eq chrome.exe', '/F']);
    })

    afterAll(() => Object.entries(runs).forEach(([name, results]) => {
        const warmup = runs[name].length - iterations
        if (results.length === 0) return
        const lhr = results.slice(warmup).map(flow => flow.steps[0].lhr)
        if (lhr[0].gatherMode == 'navigation') {
            const lhri = warmup + lhr.indexOf(computeMedianRun(lhr))
            writeFileSync(`${base}/${name}LHR - [${lhri}].json`, JSON.stringify(results[lhri].steps, null, '\t'))
            writeFileSync(`${base}/${name}LHR - [${lhri}].html`, generateReport(results[lhri], 'html'))
        }

        let usage = readFileSync(`${base}/${name}CPU.csv`, { encoding: 'utf-8' }).split('\n')
        if (usage.length === 2) return
        usage = usage.slice(1 + warmup, -1)
        const [mCpu, mMem] = computeMedianUsage(usage)
        const usagei = warmup + usage.findIndex(s =>
            +s.split(';')[2] === mCpu && +s.split(';')[1].replace(' K', '') === mMem)
        renameSync(`${base}/${name}CPU.csv`, `${base}/${name}CPU - [${usagei}].csv`)
    }))
}

/**
 * Use Tasklist to retrieve all chrome.exe processes that have used at least {@link threshold}s of CPU time.
 * The process Status=unknown is used to filter out visible UI threads.
 * @param {number} threshold 
 * @returns {[Array, number]} Tuples of PID, Mem. usage and CPU time. And the value of the threshold used.
*/
function usage(threshold = 10) {
    return [spawnSync('tasklist', ['/fo', 'csv', '/v',
        '/fi', 'ImageName eq chrome.exe',
        '/fi', 'Status eq unknown'
    ], { encoding: 'utf-8' }).stdout.split('\n').slice(1, -1)
        .map(s => s.replaceAll('"', '').split(','))
        .map(a => [a[1], a[4], a[7].split(':')
            .reduce((t, s, i, a) => t += i + 1 < a.length ? +s * 60 : +s, 0)])
        .filter(a => +a[2] > threshold), threshold]
}

/**
 * Save results of this run to the filesystem. 
 * 
 * To get the differnce between two moments, a previous call to 
 * {@link usage ()}
 *  can be provided as final argument.
 * @param {string} base
 * @param {string} name
 * @param {import("lighthouse").UserFlow} flow
 * @param {number} threshold The minimum of CPU Time to filter on
 * @param {Array} usg Previous call to {@link usage ()}
 */
async function saveResults(base, name, flow, threshold = undefined, usg = undefined) {
    const iter = runs[name].length

    if (usg) usg = usg.reduce((obj, [pid, mem, cpu]) => ({ ...obj, [pid]: [mem, cpu] }), {})

    if (iter === 0) {
        writeFileSync(`${base}/${name}CPU.csv`, 'PID;Memory Usage;CPU;i\n')
        writeFileSync(`${base}/${name}PRF.csv`, 'Load;Hydrate;Interact;Total\n')
    }
    usage(threshold)[0].forEach(([pid, mem, cpu]) => {
        if (usg && usg[pid]) {
            mem += ` (${(+mem.split(' ')[0] * 1000 - +usg[pid][0].split(' ')[0] * 1000) / 1000} K)`
            cpu -= usg[pid][1]
        }
        appendFileSync(`${base}/${name}CPU.csv`, `${pid};${mem};${cpu};${iter}\n`);
    })

    const json = await flow.createFlowResult()
    writeFileSync(`${base}/lighthouse/${name + iter}.json`, JSON.stringify(json.steps, null, '\t'))
    writeFileSync(`${base}/lighthouse/${name + iter}.html`, generateReport(json, 'html'))
    runs[name].push(json)
}

/**
 * Calculate the run closest to the median of CPU Time and Memory Usage. 
 * The calculation is made using the Euclidean distance of normalized values.
 * 
 * @param {string[]} usage CSV output of {@link usage()}
 * @returns {[number, number]} The median CPU and memory usage pair
*/
function computeMedianUsage(usage) {
    const [maxCpu, maxMem, normalCpuMem] = normalize(usage.map(s =>
        [+s.split(';')[2], +s.split(';')[1].replace(' K', '')]))

    const medianCpu = median(normalCpuMem.map(t => t[0]))
    const medianMem = median(normalCpuMem.map(t => t[1]))

    const nCpuMem = normalCpuMem.sort((a, b) => computeMedianDistance(a, medianCpu, medianMem) -
        computeMedianDistance(b, medianCpu, medianMem))[0]

    // console.log(usage)
    // console.log(nCpuMem)

    // Values are denormalized using the max values of the original array
    return [nCpuMem[0] * maxCpu, nCpuMem[1] * maxMem]
}

/**
 * Normalize elements of given nested array
 * 
 * @param {[number, number][]} array 
 * @returns {[number, number, Array]} Normalized array
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

/**
 * Wait until an {@link event} is attached to an {@link element}.
 * 
 * By default it looks for a click event on the document & button element.
 * 
 * @param {import('puppeteer').CDPSession} cdp
 * @param {string} event 
 * @param {string} element
 */
async function waitForEventListener(cdp, event = 'click', element = 'button') {
    const { result: { objectId: docId } } = await cdp.send('Runtime.evaluate', { expression: 'document' })
    const { result: { objectId: butId } } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector("${element}")` })

    while (!(await cdp.send('DOMDebugger.getEventListeners', { objectId: docId })).listeners.concat(
        (await cdp.send('DOMDebugger.getEventListeners', { objectId: butId })).listeners).find(({ type }) => type == event)) { }
}

export { flowConfig, saveResults, setup, usage, waitForEventListener };

