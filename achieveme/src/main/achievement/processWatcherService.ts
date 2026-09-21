import { spawn } from 'node:child_process'
import type { ProcessListFetchResult } from '../../shared/playtimeSessionUtils'
import { formatProcessListError, parseProcessList } from '../../shared/processListUtils.ts'

export const LIST_TIMEOUT_MS = 10_000

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
 * @param args - Full argument array passed to powershell.exe
 * @param timeoutMs - Kill after this many ms
 */
function runPowershellCommand(
  args: string[],
  timeoutMs: number = LIST_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, {
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

const CIM_ARGS = [
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  GET_PROCESS_COMMAND
]

const FALLBACK_COMMAND =
  '$t = [char]9; Get-Process | ForEach-Object { "$($_.Id)$t$($_.ProcessName)$t$($_.Path)" }'

const FALLBACK_ARGS = [
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  FALLBACK_COMMAND
]

/**
 * Primary CIM-based process query.
 */
async function runPrimaryQuery(): Promise<string> {
  return runPowershellCommand(CIM_ARGS)
}

/**
 * Fallback using Get-Process when CIM/WMI is unavailable or times out.
 * Output format is identical (pid\tname\tpath) so parseProcessList handles it.
 */
async function runFallbackQuery(): Promise<string> {
  return runPowershellCommand(FALLBACK_ARGS)
}

/**
 * Runs the CIM query and falls back to Get-Process if it times out or errors.
 * WMI/CIM enumeration can fail intermittently on hosted Windows runners.
 */
async function queryProcesses(): Promise<string> {
  try {
    return await runPrimaryQuery()
  } catch {
    return await runFallbackQuery()
  }
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
    const stdout = await queryProcesses()
    return { ok: true, processes: parseProcessList(stdout) }
  } catch (err) {
    return { ok: false, processes: [], error: formatProcessListError(err) }
  }
}


