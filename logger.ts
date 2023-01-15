import pino, { Logger } from "pino"
import SonicBoom from "sonic-boom"
import { getConfig } from "./config"

let fileLogger: Logger | null = null

export function initLogger(background: boolean) {
  const filepath = `${getConfig().alfredWorkflowCache}/log.txt`
  const fileDestination = pino.destination({
    dest: filepath,
    sync: true,
  })

  if (background) {
    fileLogger = pino({ name: "Background", base: null }, fileDestination)
  } else {
    // Log to stderr + background file
    fileLogger = pino(
      { name: "Foreground", base: null },
      pino.multistream([
        { stream: fileDestination },
        { stream: new SonicBoom({ fd: process.stderr.fd, sync: true }) },
      ])
    )
    fileLogger.info(`Background tasks log will be saved to ${filepath}`)
  }
}

export function logger(): Logger {
  if (fileLogger === null) {
    throw new Error("Logger not yet initialized")
  }
  return fileLogger
}
