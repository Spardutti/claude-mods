import { expect, test } from 'claude-code/testing'

import { START_MS, listeningPorts, statusOf } from './running'

const SS = [
  'LISTEN 0      4096    127.0.0.53%lo:53      0.0.0.0:*',
  'LISTEN 0      4096          0.0.0.0:5185    0.0.0.0:*',
  'LISTEN 0      4096             [::]:5185       [::]:*',
  'LISTEN 0      511       [::ffff:127.0.0.1]:3333  *:*',
  '',
].join('\n')

test('listening ports are read once each, IPv4 and IPv6 alike', () => {
  expect(listeningPorts(SS)).toEqual([53, 5185, 3333])
})

test('no output means nothing is listening', () => {
  expect(listeningPorts('')).toEqual([])
})

test('a listening port is running, even while a start is pending', () => {
  expect(statusOf(true, 1_000, 2_000)).toBe('running')
})

test('a port never started and not listening is stopped', () => {
  expect(statusOf(false, undefined, 2_000)).toBe('stopped')
})

test('a start is still starting exactly at the limit', () => {
  expect(statusOf(false, 0, START_MS)).toBe('starting')
})

test('a start that is not listening one moment past the limit failed', () => {
  expect(statusOf(false, 0, START_MS + 1)).toBe('failed')
})
