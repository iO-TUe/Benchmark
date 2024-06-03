import { readFileSync, readdirSync } from "fs";
import { plot } from "nodeplotlib";

const base = './archive'
const dir = base + '/astro'
const sampleCount = JSON.parse(readFileSync(base + '/bench.json').toString()).files[0].groups[0].benchmarks[0].sampleCount
// parseLHR(base)
// calcMedian(dir)
// parseMedian(dir)
parseBench(base)
// parseAverage(dir)
// boxplot(dir)

function boxplot(dir) {
    const data = []
    groupAndSlice(dir).forEach(([name, arr]) => {
        Object.keys(arr[0]).forEach((metric, idx) => {
            if (!data[idx]) data[idx] = []

            data[idx].push({
                y: arr.map(o => o[metric]),
                x: arr.map(() => metric),
                hoverinfo: 'y',
                name,
                type: 'box'
            })
        })
    })

    const idx = data.length
    JSON.parse(readFileSync(`${base}/bench.json`).toString()).files
        .find(({ groups: [{ fullName }] }) => fullName.slice(6).split('.')[0] == dir.split('/')[2])
        .groups[0].benchmarks.forEach(({ name, samples }) => {
            if (!data[idx]) data[idx] = []

            data[idx].push({
                y: samples,
                x: samples.map(() => 'bench'),
                hoverinfo: 'y',
                name,
                type: 'box'
            })
        })

    const cpuIdx = idx + 1
    const memIdx = idx + 2
    readdirSync(dir).filter(f => f.endsWith('.csv')).forEach(file => {
        const mem = []
        const cpu = []
        const arr = readFileSync(`${dir}/${file}`).toString().split('\n')

        arr.slice(arr.length - sampleCount - 1).map(l => l.split(';')).forEach(line => {
            if (line[0]) {
                mem.push(line[1].replace(' K', ''))
                cpu.push(line[2])
            }
        })

        if (!data[cpuIdx]) data[cpuIdx] = []
        if (!data[memIdx]) data[memIdx] = []

        const name = file.split('CPU')[0].toUpperCase()

        data[cpuIdx].push({
            y: cpu,
            x: cpu.map(() => 'cpu-time'),
            hoverinfo: 'y',
            name,
            type: 'box'
        })

        data[memIdx].push({
            y: mem,
            x: mem.map(() => 'memory-usage'),
            hoverinfo: 'y',
            name,
            type: 'box'
        })

    })

    data.forEach((md, idx) => plot(md, {
        // title: { text: dir.slice(dir.lastIndexOf('/') + 1) },
        yaxis: { title: idx == memIdx ? 'size in KB' : 'duration in ms' },
        boxmode: 'group'
    }))
}

function parseAverage(dir) {
    const averaged = {}
    // AVG klopt wss, maar paar outliers verpesten resultaat
    groupAndSlice(dir).forEach(([name, arr]) => {
        averaged[name] = arr.reduce((avg, obj, _, { length }) => {
            Object.entries(obj).forEach(([key, value]) => avg[key] += value / length);
            return avg
        }, Object.fromEntries(Object.keys(arr[0]).map(key => [key, 0])))
    })
}

function parseLHR(dir) {
    readdirSync(dir).filter(d => d.startsWith('lh_')).forEach(subdir => {
        console.log('\n', subdir)
        readdirSync(`${dir}/${subdir}`).filter(f => f.endsWith('.json')).forEach(file => {
            JSON.parse(readFileSync(`${dir}/${subdir}/${file}`).toString()).forEach(logMetrics)
            const split = file.split('LHR - [')
            split[1] = split[1].split('].json')[0]
            parseCPU(`${dir}/${subdir}`, split)
        })
    })
}

function parseCPU(dir, split) {
    readdirSync(dir).filter(f => f.startsWith(split[0]) && f.endsWith('.csv')).forEach(file => {
        let [mem, cpu] = readFileSync(`${dir}/${file}`).toString().split('\n')
            .map(l => l.split(';')).find((l) => l[3] == split[1]).slice(1, 3)
        console.log('  Memory: ', +mem.split('K')[0])
        console.log('  CPU: ', +cpu)
    });
}

function parseMedianCPU(dir, i) {
    readdirSync(dir).filter(f => f.endsWith('].csv')).forEach(file => {
        const split = file.split('CPU - [')
        split[1] = split[1].split('].csv')[0]
        JSON.parse(readFileSync(`${dir}/lighthouse/${split[0]}${split[1]}.json`).toString()).forEach(logMetrics)
        let [mem, cpu] = readFileSync(`${dir}/${file}`).toString().split('\n')
            .map(l => l.split(';')).find((l) => l[3] == split[1]).slice(1, 3)
        console.log('  Memory: ', +mem.split('K')[0])
        console.log('  CPU: ', +cpu)
    });
}


function calcMedian(dir) {
    groupAndSlice(dir).forEach(([name, arr]) => {
        // Median LHR
        const metrics = Object.fromEntries(Object.entries(arr[0]).map(([key]) => [key, []]))
        arr.map(o => Object.entries(o).forEach(([key, val]) => {
            metrics[key].push(val);
        }))

        // Median System
        const file = readdirSync(dir).filter(f => f.toUpperCase().startsWith(name) && f.endsWith('].csv'))[0]
        const split = file.split('CPU - [')
        split[1] = split[1].split('].csv')[0]
        let [mem, cpu] = readFileSync(`${dir}/${file}`).toString().split('\n')
            .map(l => l.split(';')).find((l) => l[3] == split[1]).slice(1, 3)

        console.group(name)

        computeMedianLHR(metrics).forEach(([name, median]) => console.log(`${name}:`, median))

        console.log('Memory: ', +mem.split('K')[0])
        console.log('CPU: ', +cpu)
        console.groupEnd()
    })

}

function parseBench(dir) {
    JSON.parse(readFileSync(`${dir}/bench.json`).toString()).files
        .forEach(({ groups: [{ fullName, benchmarks }] }) => {
            console.info(fullName.slice(6).split('.')[0].toUpperCase())
            // console.table(benchmarks.reduce((obj, { name, ...val }) =>
            //     ({ ...obj, [name]: val }), {}), ['min', 'max', 'median', 'mean', 'moe', 'rme'])
            benchmarks.forEach(({ name, mean }) => {
                console.log(name, mean)
            })
        })
}


/**
 * @param {import('lighthouse').FlowResult.Step} step  
 */
function logMetrics(step) {
    const { name, metrics } = getMetrics(step)
    console.groupCollapsed(name);
    metrics.forEach(m => console.log(`${Object.keys(m)[0]}`, Object.values(m)[0]))
    console.groupEnd()
}

/**
 * @param {import('lighthouse').FlowResult.Step} step 
 * @returns {{name: string, metrics: Record<string, number>[]}}
 */
function getMetrics({ lhr }) {
    const obj = { name: lhr.finalDisplayedUrl.split('-')[1].split('.')[0].toUpperCase(), metrics: [] };

    [
        'first-contentful-paint',
        // 'largest-contentful-paint',
        'interactive',
        'interaction-to-next-paint',
        'total-blocking-time',
        'max-potential-fid',
        'mainthread-work-breakdown',
        'bootup-time',
    ].forEach(metric => {
        if (lhr.audits[metric])
            obj.metrics.push({ [lhr.audits[metric].id]: lhr.audits[metric].numericValue })
    })

    return obj
}

/**
 * Groups metrics by implementation name + removes warmup runs
 * 
 * @param {string} dir
 */
function groupAndSlice(dir) {
    const grouped = {}
    readdirSync(`${dir}/lighthouse`).filter(f => f.endsWith('.json')).forEach(file => {
        const { name, metrics } = getMetrics(JSON.parse(readFileSync(`${dir}/lighthouse/${file}`).toString())[0])
        if (!grouped[name]) grouped[name] = []
        grouped[name].push(Object.fromEntries(metrics.flatMap(Object.entries)))
    })

    return Object.entries(grouped).map(([name, arr]) => [name, arr.slice(arr.length - sampleCount)])
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
 * Normalize elements of given array
 * 
 * @param {number[]} array 
 * @returns {[number, Array]} Normalized array
*/
function normalize(array) {
    const max = Math.max(...array)
    return [max, array.map(n => n / max)]
}

/**
 * @param {{ [s: string]: number[]; }} metrics
 */
function computeMedianLHR(metrics) {
    /** 
     * Normalize each metric to a range of 0..1
     * @type {[number, number[]][]} 
     * */
    const normMetrics = Object.values(metrics).map(normalize)
    /**
     * Calculate median value for all metrics
     * @type {number[]}
     */
    const medians = []
    normMetrics.forEach(metric => {
        medians.push(median(metric[1].slice()))
    })

    /**
     * Create a transposed matrix of metrics grouped by iteration
     * @type {number[][]}
     */
    let matrix = normMetrics.map(metric => metric[1])
    matrix = matrix[0].map((_, i) => matrix.map(row => row[i]))
    matrix.sort((a, b) => computeMedianDistance(a, medians) - computeMedianDistance(b, medians))

    return matrix[0].map((val, idx) => [Object.keys(metrics)[idx], +val * normMetrics[idx][0]])
}

/**
 * Calculate the distance of the CPU and memory pair to the median.
 * @param {number[]} array
 * @param {number[]} medians
 * @returns {number} Distance to the median CPU and Mem
 */
function computeMedianDistance(array, medians) {
    const distances = []
    for (let i = 0; i < medians.length; i++) {
        distances.push(medians[i] - array[i])
    }

    return distances.reduce((agg, dis) => agg += dis ** 2, 0)
}
