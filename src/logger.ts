import pino, { Logger } from "pino"
import SonicBoom from "sonic-boom"
import { getConfig } from "./config"
import { mkdirSync } from "fs"

let loggerInstance: Logger | null = null

export function initLogger(background: boolean) {
  const config = getConfig()
  mkdirSync(config.alfredWorkflowCache, { recursive: true })
  const filepath = `${config.alfredWorkflowCache}/log.txt`
  const level = config.alfredDebug === "1" ? "debug" : "info"
  const fileDestination = pino.destination({
    dest: filepath,
    sync: true,
  })

  if (background) {
    loggerInstance = pino({ level, base: { name: "bg" } }, fileDestination)
  } else {
    // Log to stderr + background file
    loggerInstance = pino(
      { level, base: { name: "main" } },
      pino.multistream([
        { level, stream: fileDestination },
        { level, stream: new SonicBoom({ fd: process.stderr.fd, sync: true }) },
      ])
    )
    loggerInstance.error(`Background tasks log will be saved to ${filepath}`)
  }
}

export function logger(): Logger {
  if (loggerInstance === null) {
    throw new Error("Logger not yet initialized")
  }
  return loggerInstance
}
