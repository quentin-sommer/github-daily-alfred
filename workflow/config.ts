import type { Maybe } from "./utils"

type ConfigFields =
  | "githubToken"
  | "githubUsername"
  | "alfredWorkflowCache"
  | "alfredWorkflowData"
  | "alfredDebug"
  | "customQuickLinks"

type ConfigType = Record<ConfigFields | "appName", string>
type ConfigArg = Record<ConfigFields, Maybe<string>>

function valOrThrow(record: ConfigArg, field: ConfigFields): string {
  const value = record[field]
  if (value === undefined) {
    throw new Error(`Expected value ${field} but got undefined`)
  } else {
    return value
  }
}

class Config {
  private readonly config: ConfigType

  constructor(args: ConfigArg) {
    this.config = {
      appName: "github-daily",
      alfredDebug:
        args["alfredDebug"] === undefined ? "0" : args["alfredDebug"],
      alfredWorkflowCache: valOrThrow(args, "alfredWorkflowCache"),
      alfredWorkflowData: valOrThrow(args, "alfredWorkflowData"),
      githubToken: valOrThrow(args, "githubToken"),
      githubUsername: valOrThrow(args, "githubUsername"),
      customQuickLinks: valOrThrow(args, "customQuickLinks"),
    }
  }
  get(): ConfigType {
    return this.config
  }
}

let config: Config | null = null

export function getConfig(): ConfigType {
  if (config !== null) {
    return config.get()
  } else {
    config = new Config({
      alfredDebug: process.env["alfred_debug"],
      alfredWorkflowCache: process.env["alfred_workflow_cache"],
      alfredWorkflowData: process.env["alfred_workflow_data"],
      githubToken: process.env["GITHUB_TOKEN"],
      githubUsername: process.env["GITHUB_USERNAME"],
      customQuickLinks: process.env["QUICK_LINKS"],
    })
    return config.get()
  }
}
