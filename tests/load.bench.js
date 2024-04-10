import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

setup(flows, __filename)

async function flows(base, name, url, config) {
    const browser = await launch(config)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url + '/load')

    saveResults(base, name, flow)

    await browser.close()
}

