import { spawn } from "child_process"
import { resolve } from "path"
import { Command } from "./index"
import { readFileSync, rmSync, writeFileSync } from "fs"
import { errorIsFileNotExists } from "./utils"

const ENTRYPOINT = resolve(__dirname, "index.js")
export function runInBackground(command: Command, cacheDir: string) {
  const bgProcess = spawn(
    process.execPath,
    [ENTRYPOINT, `--command=${command}`, "--background"],
    {
      detached: true,
      stdio: "ignore",
    }
  )
  bgProcess.unref()

  if (bgProcess.pid === undefined) {
    console.error(`Failed to spawn background task ${command}`)
    return
  }
  const taskFile = getTaskFile(command, cacheDir)
  const data: RunningTaskFile = {
    startedAt: Date.now(),
    pid: bgProcess.pid,
  }
  writeFileSync(taskFile, JSON.stringify(data))
  console.error(`Spawned background task ${command} ${bgProcess.pid}`)
}

type RunningTaskFile = {
  startedAt: number
  pid: number
}

function getTaskFile(command: Command, cacheDir: string) {
  // If this changes and becomes nested make sure to mkdir manually
  return resolve(cacheDir, `background_task_${command}.json`)
}
export function isRunning(command: Command, cacheDir: string): boolean {
  const taskFile = getTaskFile(command, cacheDir)

  try {
    const content = readFileSync(taskFile, { encoding: "utf-8" })
    const parsed = JSON.parse(content) as RunningTaskFile
    try {
      process.kill(parsed.pid, 0)
      return true
    } catch (_) {
      // not running
      return false
    }
  } catch (err) {
    if (errorIsFileNotExists(err)) {
      return false
    }
    console.error(`Error while getting task file ${taskFile}: ${err}`)
    rmSync(taskFile, { force: true })
    return false
  }
}
