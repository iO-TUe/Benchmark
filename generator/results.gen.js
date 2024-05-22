import { readFileSync, readdirSync } from "fs";
import { plot } from "nodeplotlib";

const sampleCount = JSON.parse(readFileSync('./tmp/bench.json').toString()).files[0].groups[0].benchmarks[0].sampleCount
// parseLHR('./tmp')
// parseMedian('./tmp/todo')
// parseBench('./tmp')
// parseAverage('./tmp/interact')
boxplot('./tmp/addition')

function boxplot(dir) {
    const data = []
    Object.entries(group(dir)).forEach(([name, arr]) => {
        // Remove warmup run results
        arr.splice(0, arr.length - sampleCount)

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

    data.forEach(md => plot(md, { title: { text: dir.slice(6) }, yaxis: { title: 'duration in ms' }, boxmode: 'group' }))

}

function parseAverage(dir) {
    const averaged = {}
    // AVG klopt wss, maar paar outliers verpesten resultaat
    Object.entries(group(dir)).forEach(([name, arr]) => {
        // Remove warmup run results
        arr.splice(0, arr.length - sampleCount)

        averaged[name] = arr.reduce((avg, obj, _, { length }) => {
            Object.entries(obj).forEach(([key, value]) => avg[key] += value / length);
            return avg
        }, Object.fromEntries(Object.keys(arr[0]).map(key => [key, 0])))


    })
}

function parseLHR(dir) {
    readdirSync(dir).filter(d => d.startsWith('lh_')).forEach(subdir => {
        console.group(subdir)
        readdirSync(`${dir}/${subdir}`).filter(f => f.endsWith('.json')).forEach(file => {
            JSON.parse(readFileSync(`${dir}/${subdir}/${file}`).toString()).forEach(logMetrics)
        })
        console.groupEnd()
    })
}

function parseMedian(dir) {
    readdirSync(dir).filter(f => f.endsWith('].csv')).forEach(file => {
        const split = file.split('CPU - [')
        split[1] = split[1].split('].csv')[0]
        JSON.parse(readFileSync(`${dir}/lighthouse/${split[0]}${split[1]}.json`).toString()).forEach(logMetrics)
        let [mem, cpu] = readFileSync(`${dir}/${file}`).toString().split('\n').map(l => l.split(';')).find((l) => l[3] == split[1]).slice(1, 3)
        console.log('  Memory: ', mem.split('K')[0])
        console.log('  CPU: ', +cpu)
    });
}

function parseBench(dir) {
    JSON.parse(readFileSync(`${dir}/bench.json`).toString()).files
        .forEach(({ groups: [{ fullName, benchmarks }] }) => {
            console.info(fullName.slice(6).split('.')[0].toUpperCase())
            console.table(benchmarks.reduce((obj, { name, ...val }) =>
                ({ ...obj, [name]: val }), {}), ['min', 'max', 'mean', 'sd', 'rme', 'sem'])
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
        'largest-contentful-paint',
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
 * @param {string} dir
 */
function group(dir) {
    const grouped = {}
    readdirSync(`${dir}/lighthouse`).filter(f => f.endsWith('.json')).forEach(file => {
        const { name, metrics } = getMetrics(JSON.parse(readFileSync(`${dir}/lighthouse/${file}`).toString())[0])
        if (!grouped[name]) grouped[name] = []
        grouped[name].push(Object.fromEntries(metrics.flatMap(Object.entries)))
    })

    return grouped
}
