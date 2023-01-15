import pino, { Logger } from "pino"

let fileLogger: Logger

export function initLogger(background: boolean) {
  const destinationOptions = { dest: "/tmp/qsmr/log.txt", sync: true }
  if (background) {
    fileLogger = pino(
      { name: "background" },
      pino.destination(destinationOptions)
    )
  } else {
    fileLogger = pino({ name: "main" }, pino.destination(destinationOptions))
  }
}

export function logger(): Logger {
  return fileLogger
}
