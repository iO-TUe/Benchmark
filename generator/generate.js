import { generate } from "./counter.gen.js";

// generate('next', 'tsx', ['<>', '</>'],
//     'export default (props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
//     'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
// generate('nuxt', 'tsx', ['<>', '</>'],
//     'export default (props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
//     'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('qwik', 'tsx', ['<>', '</>)'], ['/**', '*/'],
    "\nimport { component$ } from '@builder.io/qwik'",
    'export default component$((props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
    'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('react', 'tsx', ['<>', '</>'], ['/**', '*/'], '',
    'export default (props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
    'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('solid', 'tsx', ['<>', '</>'], ['/**', '*/'], '',
    'export default (props: { initialValue: number, maxValue: number, recurse: boolean }) =>',
    'initialValue={props.initialValue} maxValue={props.maxValue} recurse={props.recurse}')
generate('svelte', 'svelte', ['', ''], ['<!--', '-->'], '<script lang="ts">',
    'export let initialValue: number;\nexport let maxValue: number;\nexport let recurse: boolean;\n</script>',
    'initialValue={initialValue} maxValue={maxValue} recurse={recurse}')
generate('vue', 'vue', ['<template>', '</template>'], ['<!--', '-->'], '<script setup lang="ts">',
    'const props = defineProps<{ initialValue: number, maxValue: number, recurse: boolean }>()\n</script>\n',
    ':initialValue="props.initialValue" :maxValue="props.maxValue" :recurse="props.recurse"')
