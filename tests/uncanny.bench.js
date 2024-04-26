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

    await flow.startTimespan({ name: 'UncannyInteract' })
    await page.goto(url + '/load', { waitUntil: 'domcontentloaded' })
    const { result: { objectId } } = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("button")' })
    while ((await cdp.send('DOMDebugger.getEventListeners', { objectId })).listeners.length == 0) { }

    await page.click('button[aria-label="-"')
    await page.waitForFunction(() => +document.querySelector("[class*=value]").textContent == 49)
    await flow.endTimespan()

    saveResults(base, name, flow)

    await browser.close()
}

