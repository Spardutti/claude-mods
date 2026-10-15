import { expect, test } from 'claude-code/testing'

import { START_MS, STOP_MS, isBusy, listeningPorts, statusOf } from './running'

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
  expect(statusOf(true, { startedAt: 1_000 }, 2_000)).toBe('running')
})

test('a port never started and not listening is stopped', () => {
  expect(statusOf(false, {}, 2_000)).toBe('stopped')
})

test('a start is still starting exactly at the limit', () => {
  expect(statusOf(false, { startedAt: 0 }, START_MS)).toBe('starting')
})

test('a start that is not listening one moment past the limit failed', () => {
  expect(statusOf(false, { startedAt: 0 }, START_MS + 1)).toBe('failed')
})

test('a listening port is stopping exactly at the stop limit', () => {
  expect(statusOf(true, { stoppingAt: 0 }, STOP_MS)).toBe('stopping')
})

test('a port still listening one moment past the stop limit shows running again', () => {
  expect(statusOf(true, { stoppingAt: 0 }, STOP_MS + 1)).toBe('running')
})

test('a stopped port is stopped even while the stop is pending', () => {
  expect(statusOf(false, { stoppingAt: 0 }, 1_000)).toBe('stopped')
})

test('a press is busy exactly at its limit', () => {
  expect([isBusy({ startedAt: 0 }, START_MS), isBusy({ stoppingAt: 0 }, STOP_MS)]).toEqual([true, true])
})

test('a press one moment past its limit no longer blocks the buttons', () => {
  expect([isBusy({ startedAt: 0 }, START_MS + 1), isBusy({ stoppingAt: 0 }, STOP_MS + 1), isBusy({}, 0)]).toEqual([false, false, false])
})
