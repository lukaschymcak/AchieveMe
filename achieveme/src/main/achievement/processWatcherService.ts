import { spawn } from 'node:child_process'
import type { ProcessListFetchResult } from '../../shared/playtimeSessionUtils'
import { formatProcessListError, parseProcessList } from '../../shared/processListUtils.ts'

export const LIST_TIMEOUT_MS = 4_000

export const GET_PROCESS_COMMAND =
  '$t = [char]9; Get-CimInstance Win32_Process -Property ProcessId,Name,ExecutablePath | ForEach-Object { "$($_.ProcessId)$t$($_.Name)$t$($_.ExecutablePath)" }'

/**
 * True when a PID still exists (Node signal 0). Used for Play PIDs missing from snapshots.
 *
 * @param pid - Process id
 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Runs a PowerShell command and kills it if it exceeds the timeout (Windows SIGTERM is unreliable).
 *
 * @param command - -Command string
 * @param timeoutMs - Kill after this many ms
 */
function runPowershellCommand(
  command: string,
  timeoutMs: number = LIST_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (err: Error | null, output: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) {
        reject(err)
        return
      }
      resolve(output)
    }

    const timer = setTimeout(() => {
      child.kill()
      try {
        if (typeof child.pid === 'number' && child.pid > 0) {
          process.kill(child.pid, 0)
          spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
        }
      } catch {
        // already gone
      }
      finish(Object.assign(new Error('timeout'), { killed: true }), '')
    }, timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (err) => {
      finish(err, '')
    })
    child.on('close', (code) => {
      if (code === 0 || stdout.trim()) {
        finish(null, stdout)
        return
      }
      const message = stderr.trim() || `powershell exited ${code ?? 'null'}`
      finish(new Error(message), '')
    })
  })
}

/**
 * Lists running processes (Windows). Failures return `{ ok: false }` so the
 * tracker can keep the last snapshot and still overlay live Play PIDs.
 */
export async function listRunningProcesses(): Promise<ProcessListFetchResult> {
  if (process.platform !== 'win32') {
    return { ok: true, processes: [] }
  }

  try {
    const stdout = await runPowershellCommand(GET_PROCESS_COMMAND)
    return { ok: true, processes: parseProcessList(stdout) }
  } catch (err) {
    return { ok: false, processes: [], error: formatProcessListError(err) }
  }
}
