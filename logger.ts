import pino, { Logger } from "pino"
import SonicBoom from "sonic-boom"
import { getConfig } from "./config"

let fileLogger: Logger | null = null

export function initLogger(background: boolean) {
  const config = getConfig()
  const filepath = `${config.alfredWorkflowCache}/log.txt`
  const level = config.alfredDebug === "1" ? "debug" : "info"
  const fileDestination = pino.destination({
    dest: filepath,
    sync: true,
  })

  if (background) {
    fileLogger = pino({ level, base: { name: "bg" } }, fileDestination)
  } else {
    // Log to stderr + background file
    fileLogger = pino(
      { level, base: { name: "main" } },
      pino.multistream([
        { stream: fileDestination },
        { stream: new SonicBoom({ fd: process.stderr.fd, sync: true }) },
      ])
    )
    fileLogger.debug(`Background tasks log will be saved to ${filepath}`)
  }
}

export function logger(): Logger {
  if (fileLogger === null) {
    throw new Error("Logger not yet initialized")
  }
  return fileLogger
}
