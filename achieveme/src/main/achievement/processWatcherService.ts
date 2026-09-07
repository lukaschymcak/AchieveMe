import { execFileSync } from 'node:child_process'
import { parseCimProcessList, type ProcessInfo } from '../../shared/processListUtils'

const CIM_COMMAND = [
  '-NoProfile',
  '-Command',
  "Get-CimInstance Win32_Process -Property ProcessId,ExecutablePath | ForEach-Object { '{0}`t{1}' -f $_.ProcessId, $_.ExecutablePath }"
]

/**
 * Lists running processes with executable paths (Windows only).
 * Returns an empty list on non-Windows or on command failure.
 */
export function listRunningProcesses(): ProcessInfo[] {
  if (process.platform !== 'win32') return []

  try {
    const output = execFileSync('powershell.exe', CIM_COMMAND, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8_000,
      maxBuffer: 8 * 1024 * 1024
    })
    return parseCimProcessList(output)
  } catch {
    return []
  }
}
