import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { generateReport, startFlow } from 'lighthouse';
import { computeMedianRun } from "lighthouse/core/lib/median-run";
import { spawnSync } from 'node:child_process';
import { launch } from 'puppeteer';
import { afterAll, beforeAll, bench } from "vitest";

const runs = {};

[ // TOOD: Extract this list as an common resource
    ["React", "https://io-2imc05.web.app/"],
    ["Qwik", "https://qwiiik.web.app/"],
].forEach(([name, url]) => {
    runs[name] = [];
    bench(name, async () => await flows(name, url), { iterations: 1, warmupIterations: 0 });
})

beforeAll(() => {
    rmSync('./tmp', { recursive: true, force: true })
    mkdirSync('./tmp')
    mkdirSync('./tmp/lighthouse')
    spawnSync('taskkill', ['/fi', 'ImageName eq chrome.exe', '/F']);
})

afterAll(() => {
    console.log(runs)
    Object.values(runs).forEach(computeMedianRun)
})

async function flows(name, url) {
    const browser = await launch({ headless: 'new' })
    const page = await browser.newPage()

    const flow = await startFlow(page, {
        config: {
            extends: 'lighthouse:default',
            settings: {
                onlyCategories: ['performance'],
                skipAudits: [
                    'screenshot-thumbnails',
                    'final-screenshot',
                    'non-composited-animations',
                    'cumulative-layout-shift'
                ],
                disableFullPageScreenshot: true,
                skipAboutBlank: true,
                usePassiveGathering: true
            }
        }
    })

    await flow.navigate(url)

    // console.log("BeforeRecurse")
    await flow.startTimespan({ name: 'BeforeRecurse' })
    await page.$('button[aria-label=add').then(el => el && el.click())
    await page.waitForFunction('document.querySelector(".value").textContent === "96"')
    await flow.endTimespan()

    // console.log("Recurse")
    await flow.startTimespan({ name: 'Recurse' })
    await page.click('[role=insertion]')
    await page.waitForTimeout(3000)
    await flow.endTimespan()

    // console.log("AfterRecurse")
    await flow.startTimespan({ name: 'AfterRecurse' })
    await page.$('button[aria-label=sub').then(el => el && el.click(), { timeout: 0 })
    await page.waitForFunction('document.querySelector(".value").textContent === "95"', { timeout: 0 })
    await flow.endTimespan()

    // console.log("Get CPU usages")
    usage().forEach(([pid, mem, cpu]) => appendFileSync(`./tmp/${name}CPU.csv`, `${pid};${mem};${cpu}\n`))

    // console.log("Generating report")
    const now = new Date().getTime(), json = await flow.createFlowResult()
    writeFileSync(`./tmp/lighthouse/${name + now}.json`, JSON.stringify(json.steps
        .reduce((acc, { lhr: { audits }, name }) => ({ ...acc, [name]: { ...audits } }), {}), null, '\t'))
    writeFileSync(`./tmp/lighthouse/${name + now}.html`, generateReport(json, 'html'))
    runs[name].push(json.steps[0].lhr)
    log(runs[name], json.steps[0].lhr)

    await browser.close()
}

function usage() {
    let usage = spawnSync('tasklist', ['/fi', 'ImageName eq chrome.exe', '/fo', 'csv', '/v'], { encoding: 'utf-8' }).stdout
    return usage.split('\n').map(s => s.replaceAll('"', '').split(',')).map(a => [a[1], a[4], a[7]]).filter(a => {
        const cpu = a[2]?.slice(1, -1).split(':')
        return cpu && (cpu[0] > 0 || cpu[1] > 0 || cpu[2] > 10)
    })
}
