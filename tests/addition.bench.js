import { startFlow } from 'lighthouse';
import { basename } from 'path';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup, usage } from './utils';

const base = `./tmp/${basename(__filename).split('.')[0]}`
setup(flows, base)

async function flows(name, url) {
    const browser = await launch({ devtools: false })
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url)

    const usg = usage(5)

    await flow.startTimespan({ name: 'Add' })
    await page.click('[role=feed]')
    await page.waitForFunction(() => document.querySelectorAll("[role=feed]").length === 16383, { timeout: 0 })
    await flow.endTimespan()

    console.log(usg)

    saveResults(base, name, flow, 5, usg)
    await browser.close()
}

