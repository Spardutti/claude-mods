import { expect, test } from 'claude-code/testing'

import { askedCommandsOf } from './asked'

const PUSH = 'git -C /home/me/game push origin --delete feat/knight'

for (const [desc, reply] of [
  ['on its own line', `What you do now: run this one:\n\n! ${PUSH}\n\nThen tell me.`],
  ['indented in a list', `1. Run it:\n   ! ${PUSH}`],
  ['inside backticks', `Type \`! ${PUSH}\` in the prompt.`],
  ['inside a code block', `Run:\n\`\`\`\n! ${PUSH}\n\`\`\``],
] as const) {
  test(`a reply asking for a command ${desc} gives that command`, () => {
    expect(askedCommandsOf(reply)).toEqual([PUSH])
  })
}

test('a reply asking for two commands gives both in order', () => {
  expect(askedCommandsOf('! git fetch\nthen\n! git pull')).toEqual(['git fetch', 'git pull'])
})

test('two quoted commands on one line give both in order', () => {
  expect(askedCommandsOf('Run `! git fetch` and then `! git pull`.')).toEqual(['git fetch', 'git pull'])
})

for (const [desc, reply] of [
  ['no bang line', 'All done. Nothing to do.'],
  ['a bang with no space', '!important'],
  ['a bang mid-sentence', 'That worked! great'],
  ['a bang with nothing after it', '! '],
] as const) {
  test(`a reply with ${desc} gives nothing`, () => {
    expect(askedCommandsOf(reply)).toEqual([])
  })
}
