import type { Maybe } from "./utils"

type ConfigFields =
  | "githubToken"
  | "githubUsername"
  | "alfredWorkflowCache"
  | "alfredWorkflowData"

type ConfigType = Record<ConfigFields, string>
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
      alfredWorkflowCache: valOrThrow(args, "alfredWorkflowCache"),
      alfredWorkflowData: valOrThrow(args, "alfredWorkflowData"),
      githubToken: valOrThrow(args, "githubToken"),
      githubUsername: valOrThrow(args, "githubUsername"),
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
      alfredWorkflowCache: process.env["alfred_workflow_cache"],
      alfredWorkflowData: process.env["alfred_workflow_data"],
      githubToken: process.env["GITHUB_TOKEN"],
      githubUsername: process.env["GITHUB_USERNAME"],
    })
    return config.get()
  }
}
