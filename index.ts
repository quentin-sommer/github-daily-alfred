import { menu, outputError, prs, repos, reviews } from "./cli"
import { detailed } from "yargs-parser"
import type { Maybe } from "./utils"
import { initLogger, logger } from "./logger"
import { getConfig } from "./config"

const commands = ["prs", "reviews", "repos", "menu"] as const
export type Command = (typeof commands)[number]

const commandsToFns: Record<
  Command,
  (runningInBackground: boolean, filter?: string) => Promise<void>
> = {
  prs: prs,
  reviews: reviews,
  repos: repos,
  menu: menu,
}

function parseArgs(args: string[]): {
  command: Command
  filter: string | undefined
  runningInBackground: boolean | undefined
} {
  const parsed = detailed(args, {
    coerce: {
      command: (arg) => {
        if (commands.includes(arg)) {
          return arg
        }
        throw new Error(`command should be one of ${commands.join(", ")}`)
      },
      // Filter will always be provided but empty when no value is passed
      filter: (arg) => (arg === "" ? undefined : arg),
      background: (arg) => {
        if (typeof arg === "boolean") {
          return arg
        }
        throw new Error("background should be a boolean")
      },
    },
  })
  if (parsed.error !== null) {
    outputError(parsed.error)
    process.exit(1)
  }
  if (parsed.argv["command"] === undefined) {
    outputError(new Error("--command is mandatory"))
    process.exit(1)
  } else {
    return {
      command: parsed.argv["command"] as Command,
      filter: parsed.argv["filter"] as Maybe<string>,
      runningInBackground: parsed.argv["background"] as Maybe<boolean>,
    }
  }
}
export async function backGroundEntrypoint(command: Command) {
  logger().debug(`Running ${command} in background`)

  await commandsToFns[command](true)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.runningInBackground) {
    initLogger(true)
  } else {
    initLogger(false)
  }

  getConfig()
  logger().debug({ msg: "Arguments", args })
  logger().debug({
    msg: `Will cache data in ${getConfig().alfredWorkflowCache}`,
  })
  try {
    if (args.runningInBackground) {
      return backGroundEntrypoint(args.command)
    }
    return commandsToFns[args.command](false, args.filter)
  } catch (err) {
    logger().error({ err })
  }
}

void main()
