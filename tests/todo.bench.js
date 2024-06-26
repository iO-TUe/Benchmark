import { appendFileSync } from "fs";
import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';
setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    let p = performance.now()
    await flow.startTimespan({ name: 'LoadInteract' })
    await page.goto(url + '/todo', { waitUntil: 'domcontentloaded' })
    let l = performance.now() - p

    await page.type('#input', "Item", { delay: 100 })
    await page.click('#input', { count: 3 })
    let f = performance.now() - p - l

    await page.waitForListener('#input', 'keyup')
    let h = performance.now() - p - l - f

    for (let i = 0; i < 5; i++) {
        await page.type('#input', "Item " + i, { delay: 100 })
        await page.keyboard.press('Enter', { delay: 300 })
        await page.$eval(`li[data-id="Item ${i}"]`, (el, i) =>
            el.childNodes[0].textContent == `Item ${i}`, i)
    }
    let i = performance.now() - p - l

    while (await page.$eval('.list', (el) => el.childElementCount > 0)) {
        await page.click(`li[data-id] button`)
    }
    await flow.endTimespan()

    let e = performance.now() - p

    saveResults(base, name, flow)
    appendFileSync(`${base}/${name}PRF.csv`, `${l};${i};${e}\n`)

    await browser.close()
}

