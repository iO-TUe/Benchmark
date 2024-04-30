import { appendFileSync } from "fs";
import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const cdp = await page.createCDPSession()
    const flow = await startFlow(page, flowConfig)

    let p = performance.now()
    await flow.startTimespan({ name: 'Interact' })
    await page.goto(url + '/load', { waitUntil: 'domcontentloaded' })
    let l = performance.now() - p

    const { result: { objectId: docId } } = await cdp.send('Runtime.evaluate', { expression: 'document' })
    const { result: { objectId: butId } } = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("button")' })
    while (!(await cdp.send('DOMDebugger.getEventListeners', { objectId: docId })).listeners.concat(
        (await cdp.send('DOMDebugger.getEventListeners', { objectId: butId })).listeners)
        .find(({ type }) => type == 'click')) { }
    let h = performance.now() - p - l

    let value
    while ((value = await page.$eval("[class*=value]", el => +el.textContent)) < 60) {
        await page.click('button[aria-label="+"]')
        await page.waitForFunction((value) => +document.querySelector("[class*=value]").textContent == ++value, {}, value)
    }
    const i = performance.now() - p - l - h
    await flow.endTimespan()

    const e = performance.now() - p

    saveResults(base, name, flow)
    appendFileSync(`${base}/${name}PRF.csv`, `${l};${h};${i};${e}\n`)

    await browser.close()
}

