import { existsSync, mkdirSync, readFile, rmSync, writeFile } from "fs"

const duplicates = 50
const comp = 'counter'
const path = 'src/components'

/**
 * @param {string} name
 * @param {string} props
 * @param {string} component
 * @param {string[]} tags
 * @param {string} ext
 * @param {string[]} amble
 */
export function generate(name, ext, tags, amble, component, props) {
    const fullpath = `../${name}/${path}/${comp}`
    const fullpathExt = `${fullpath}.${ext}`
    readFile(fullpathExt, (err, file) => {
        if (err) throw (err)

        if (existsSync(fullpath)) rmSync(fullpath, { recursive: true, force: true })
        mkdirSync(fullpath)

        let oc = file.toString().replaceAll('./', '../')
        for (let i = 0; i < duplicates; i++) {
            writeFile(`${fullpath}/${comp}${i}.${ext}`, oc, writeCB)
        }

        writeFile(fullpath + '.gen.' + ext, `${amble[0] ?? ''}
${duplicate((i) => `import ${comp.toUpperCase()}${i} from './${comp}/${comp}${i}${ext != 'tsx' ? `.${ext}` : ''}'`)}

${component}${amble[1] ?? ' '}${tags[0]}
  ${duplicate((i) => `<${comp.toUpperCase()}${i} ${props} />`)}
${tags[1]}`, writeCB)
    })
}

/** @type {import("fs").NoParamCallback} err */
function writeCB(err) {
    if (err) throw err
}

/** @param {(i: number) => string} str */
function duplicate(str) {
    return [...Array(duplicates).keys()].reduce((p, c, i) => p + str(c) + (i < duplicates - 1 ? '\n' : ''), '')
}

generate('qwik', 'tsx', ['<>', '</>)'], ["\nimport { component$ } from '@builder.io/qwik'"],
    'export default component$((props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
    'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('react', 'tsx', ['<>', '</>'], [],
    'export default (props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
    'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('solid', 'tsx', ['<>', '</>'], [],
    'export default (props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
    'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('svelte', 'svelte', ['', ''], ['<script lang="ts">', '\n</script>\n'],
    'export let initialValue: number;\nexport let maxValue: number;\nexport let recurse: boolean;',
    'initialValue={initialValue} maxValue={maxValue} recurse={recurse}')
generate('vue', 'vue', ['<template>', '</template>'], ['<script setup lang="ts">', '\n</script>\n\n'],
    'const props = defineProps<{ initialValue: number, maxValue: number, recurse: boolean }>()',
    ':initialValue="props.initialValue" :maxValue="props.maxValue" :recurse="props.recurse"')
