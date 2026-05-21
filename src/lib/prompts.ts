import { LANG_LINE, type Lang } from './lang'

export const DEFAULT_N_ROLES    = 50
export const DEFAULT_BATCH_SIZE = 5
export const DEFAULT_QPS        = 3

export function spawnPrompt(n: number, lang: Lang) {
  return [
    'Do not overthink. Respond directly.',
    'You generate diverse expert PERSONAS to answer a question from many angles.',
    `Produce EXACTLY ${n} distinct personas. Maximize diversity: vary by discipline, era, cultural background, methodology, temperament, status (insider/outsider), and abstraction level (specialist/generalist).`,
    'Mix: domain experts, historians, contrarians, practitioners, theorists, journalists, end-users, regulators, dissenters, sceptics, optimists, futurists, ethicists, economists, anthropologists, engineers, designers, etc.',
    'OUTPUT FORMAT — strict, one persona per line, no preamble, no numbering, no markdown:',
    'ROLE TITLE | one-sentence angle/brief (max 12 words)',
    'Examples:',
    'Pragmatic systems engineer | what breaks at scale that PMs ignore',
    'Cultural historian of failure | why this echoes prior cycles',
    'Skeptical late-stage investor | where the money actually flows',
    `Generate ${n} lines. Each ROLE must be unique and concrete. No filler.`,
    LANG_LINE[lang] + ' (Both ROLE TITLE and brief must be in the target language.)',
  ].join('\n')
}

export function batchPrompt(batchLen: number, lang: Lang) {
  return [
    'Do not overthink. Respond directly.',
    `You are ${batchLen} expert personas answering one question. Each persona has a NAME and ANGLE.`,
    'Output STRICTLY this format — emit each marker on its own line, then that persona\'s answer below it:',
    '<§1§>',
    '[persona 1 answer]',
    '<§2§>',
    '[persona 2 answer]',
    `...through <§${batchLen}§>.`,
    'Each persona: STRICTLY in voice, 2-4 short sentences, concrete, specific, substantive. No "as a [role]" preamble. No hedging. No throat-clearing.',
    'The marker <§N§> MUST appear exactly as shown. Do not skip any persona.',
    LANG_LINE[lang],
  ].join('\n')
}

export function consolidatePrompt(lang: Lang) {
  return [
    'Do not overthink. Respond directly.',
    'You are the CONSOLIDATOR agent. You receive short perspectives from diverse expert personas on the same question.',
    'Your job: produce ONE unified, substantive answer that:',
    '1. Opens with `## TL;DR` heading then 1-2 bold sentences capturing the convergent core.',
    '2. Body: `## Synthesis` heading, then 2-4 paragraphs weaving the strongest insights. Name notable DISAGREEMENTS between camps explicitly with brief attribution (e.g. "engineers vs. economists split on…").',
    '3. `## Key takeaways` heading, then 3-5 bulleted action items or implications (use `- ` bullets).',
    '4. Final line exactly: `**Confidence:** high | medium | low` (pick one based on agent agreement).',
    'Use Markdown: `##` headings, `**bold**`, `*italic*`, `- ` bullets, `\\`code\\`` inline.',
    'Do NOT list each agent. Synthesize, weight, judge. Privilege specific, falsifiable claims over generic ones. No throat-clearing, no "In conclusion".',
    'Length: ~280-450 words total.',
    LANG_LINE[lang],
  ].join('\n')
}
