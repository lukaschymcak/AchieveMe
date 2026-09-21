import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const {
  isPidAlive,
  LIST_TIMEOUT_MS,
  GET_PROCESS_COMMAND,
  listRunningProcesses
} = await import(
  pathToFileURL(path.join(rootDir, '../src/main/achievement/processWatcherService.ts')).href
)

test('LIST_TIMEOUT_MS is configured for Windows CI process enumeration', () => {
  assert.equal(LIST_TIMEOUT_MS, 10_000)
})

test('GET_PROCESS_COMMAND uses Get-CimInstance Win32_Process with ProcessId, Name, ExecutablePath', () => {
  assert.ok(GET_PROCESS_COMMAND.includes('Get-CimInstance Win32_Process'))
  assert.ok(GET_PROCESS_COMMAND.includes('ProcessId,Name,ExecutablePath'))
  assert.ok(GET_PROCESS_COMMAND.includes('[char]9'))
})

test('isPidAlive returns false for invalid pids', () => {
  assert.equal(isPidAlive(0), false)
  assert.equal(isPidAlive(-1), false)
  assert.equal(isPidAlive(NaN), false)
})

test('isPidAlive returns true for current process pid', () => {
  assert.equal(isPidAlive(process.pid), true)
})

test('listRunningProcesses runs and returns parsed processes on Windows', async () => {
  if (process.platform !== 'win32') return

  const result = await listRunningProcesses()
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.processes))
  assert.ok(result.processes.length > 0)

  // Current process should be in the list
  const self = result.processes.find((p) => p.pid === process.pid)
  assert.ok(self, 'current process found in process list')
  assert.ok(self.name.length > 0)
})
