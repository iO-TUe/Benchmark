import { startFlow } from 'lighthouse';
import { basename } from 'path';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup, usage } from './utils';

const base = `./tmp/${basename(__filename).split('.')[0]}`
setup(flows, base)

async function flows(name, url, config) {
    const browser = await launch(config)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url)

    const [usg, n] = usage()

    await flow.startTimespan({ name: 'Add' })
    await page.click('[role=feed]')
    await page.waitForFunction(() => document.querySelectorAll("[role=feed]").length === 16_383, { timeout: 0 })
    await flow.endTimespan()

    saveResults(base, name, flow, n, usg)

    await browser.close()
}

