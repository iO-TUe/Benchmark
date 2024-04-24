import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup, usage } from './utils';

setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url)

    const [usg, n] = usage(5)

    await flow.startTimespan({ name: 'Add' })
    await page.click('[role=feed]')
    await page.waitForFunction(() => document.querySelectorAll("[role=feed]").length == 2047, { timeout: 0 })
    await flow.endTimespan()

    saveResults(base, name, flow, n, usg)

    await browser.close()
}

