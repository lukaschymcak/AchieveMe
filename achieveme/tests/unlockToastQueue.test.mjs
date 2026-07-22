import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  createToastQueueState,
  enqueueToast,
  takeNextToast,
  markToastIdle
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/unlockToastQueue.ts')).href
)

test('takeNextToast returns null while busy', () => {
  let state = createToastQueueState()
  state = enqueueToast(state, 'a')
  const first = takeNextToast(state)
  assert.equal(first.item, 'a')
  assert.equal(first.state.busy, true)

  const second = takeNextToast(enqueueToast(first.state, 'b'))
  assert.equal(second.item, null)
  assert.equal(second.state.queue.length, 1)
})

test('markToastIdle then takeNextToast drains the queue in order', () => {
  let state = createToastQueueState()
  state = enqueueToast(state, 'one')
  state = enqueueToast(state, 'two')

  const first = takeNextToast(state)
  assert.equal(first.item, 'one')

  state = markToastIdle(first.state)
  const second = takeNextToast(state)
  assert.equal(second.item, 'two')
  assert.deepEqual(second.state.queue, [])
})

test('takeNextToast returns null on empty idle queue', () => {
  const result = takeNextToast(createToastQueueState())
  assert.equal(result.item, null)
  assert.equal(result.state.busy, false)
})
