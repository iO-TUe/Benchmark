import { readFileSync } from "fs";

const dir = './generator/tmp'
// readdirSync(dir).filter(f => f.endsWith('].csv')).forEach(file => {
//     const split = file.split('CPU - [')
//     split[1] = split[1].split('].csv')[0]
//     JSON.parse(readFileSync(`${dir}/lighthouse/${split[0]}${split[1]}.json`).toString()).forEach(metrics)
//     let [mem, cpu] = readFileSync(`${dir}/${file}`).toString().split('\n').map(l => l.split(';')).find((l) => l[3] == split[1]).slice(1, 3)
//     console.log(split[0], mem.split('K')[0], +cpu)
// });

// readdirSync(dir).filter(f => f.endsWith('.json')).forEach(file => {
//     readFile(`${dir}/${file}`, (_, json) => JSON.parse(json.toString()).forEach(metrics))
// });


JSON.parse(readFileSync(`${dir}/bench.json`).toString()).files
    .forEach(({ groups: [{ fullName, benchmarks }] }) => {
        console.info(fullName.slice(6).split('.')[0].toUpperCase())
        console.table(benchmarks.reduce((obj, { name, ...val }) =>
            ({ ...obj, [name]: val }), {}), ['min', 'max', 'mean', 'sd', 'rme', 'sem'])
    })


/**
 * @param {import('lighthouse').FlowResult.Step} step 
 */
function metrics({ lhr }) {
    console.groupCollapsed(lhr.finalDisplayedUrl.split('-')[1].split('.')[0].toUpperCase());
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
            console.log(`${lhr.audits[metric].id}`, lhr.audits[metric].numericValue)
    })
    console.groupEnd();
}
