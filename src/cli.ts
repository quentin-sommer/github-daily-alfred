import {
  getActionableReviews,
  getInvolvedPrs,
  getMyPrs,
  getRepos,
  Pr,
} from "./github"
import { Cache } from "./cache"
import cleanStack from "clean-stack"
import type { Command } from "./index"
import { deleteBackgroundLock, isRunning, runInBackground } from "./background"
import type { Maybe } from "./utils"
import { logger } from "./logger"
import { getConfig } from "./config"
import { fuzzyMatch } from "./fuzzySearch"

const MAX_ITEMS_TO_RETURN = 100

const WARNING_ICON = {
  path: "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns",
}

export async function executeFetchCommand(
  command: Command,
  runningInBackground: boolean,
  cacheTTLMs: number,
  filter: Maybe<string>,
  fetcher: () => Promise<Item[]>
) {
  const cacheDir = getConfig().alfredWorkflowCache
  const cache = new Cache<Item[]>(cacheDir)
  let shouldRerun = false
  let items: Item[]

  if (runningInBackground) {
    try {
      items = await fetcher()
      cache.set(command, items, cacheTTLMs)
      deleteBackgroundLock(command, cacheDir)
      process.exit(0)
    } catch (err) {
      logger().error({ err, msg: `Error while running command ${command}` })
      process.exit(1)
    }
  } else {
    const cached = cache.get(command)
    if (cached !== undefined) {
      items = cached.value
      if (cached.stale) {
        shouldRerun = true
        if (isRunning(command, cacheDir)) {
          logger().debug(`Already updating in the background`)
        } else {
          logger().debug(`Updating stale ${command} in background.`)
          runInBackground(command, cacheDir)
        }
      }
    } else {
      output(
        [
          {
            title: `Fetching ${command}`,
            subtitle: "",
          },
        ],
        true
      )
      runInBackground(command, cacheDir)
      logger().debug(`Fetching ${command} in background.`)
      return
    }
  }

  if (!filter) {
    output(items.slice(0, MAX_ITEMS_TO_RETURN), shouldRerun)
    return
  }

  const filtered = items
    .reduce<{ item: Item; score: number }[]>((acc, item) => {
      const [matched, score] = fuzzyMatch(filter, item.title)
      if (matched) {
        acc.push({ score, item })
      }
      return acc
    }, [])
    .sort((a, b) => b.score - a.score)

  output(
    filtered.slice(0, MAX_ITEMS_TO_RETURN).map((item) => item.item),
    shouldRerun
  )
}

function prItem(pr: Pr): Item {
  const partial: Item = {
    title: pr.title,
    subtitle: `${pr.repositoryFullName} #${pr.number}`,
    arg: pr.url,
    valid: true,
  }
  if (getConfig().disableAlfredReordering === "0") {
    partial.uid = pr.id
  }
  return partial
}

export async function prs(runningInBackground: boolean, filter?: string) {
  await executeFetchCommand(
    "prs",
    runningInBackground,
    5 * 1000,
    filter,
    async () => {
      const prs = await getMyPrs()
      const items: Item[] = prs.map(prItem)

      return items
    }
  )
}

export async function reviews(runningInBackground: boolean, filter?: string) {
  await executeFetchCommand(
    "reviews",
    runningInBackground,
    5 * 1000,
    filter,
    async () => {
      const prs = await getActionableReviews()
      const items: Item[] = prs.map(prItem)

      return items
    }
  )
}

export async function involved(runningInBackground: boolean, filter?: string) {
  await executeFetchCommand(
    "involved",
    runningInBackground,
    5 * 1000,
    filter,
    async () => {
      const prs = await getInvolvedPrs()
      const items: Item[] = prs.map(prItem)

      return items
    }
  )
}

type Item = {
  // Omitted or undefined when we don't want alfred to re-order
  uid?: string | undefined
  title: string
  subtitle: string
  autocomplete?: string
  arg?: string
  icon?: {
    path: string
  }
  text?: Record<string, unknown>
  valid?: boolean
}

export async function repos(runningInBackground: boolean, filter?: string) {
  await executeFetchCommand(
    "repos",
    runningInBackground,
    24 * 3600 * 1000,
    filter,
    async () => {
      const repos = await getRepos()
      const items: Item[] = repos.map((repo) => ({
        uid: getConfig().disableAlfredReordering === "0" ? repo.id : undefined,
        title: repo.nameWithOwner,
        subtitle: repo.url,
        autocomplete: repo.nameWithOwner,
        arg: repo.url,
        valid: true,
      }))

      return items
    }
  )
}

export async function menu(_runningInBackground: boolean, _filter?: string) {
  const items: Item[] = [
    {
      title: "Notifications",
      arg: "https://github.com/notifications?query=is:unread",
      subtitle: "https://github.com/notifications?query=is:unread",
    },
    {
      title: "Pull Requests",
      arg: "https://github.com/pulls",
      subtitle: "https://github.com/pulls",
    },
    {
      title: "Dashboard",
      arg: "https://github.com",
      subtitle: "https://github.com",
    },
    {
      title: "Issues",
      arg: "https://github.com/issues",
      subtitle: "https://github.com/issues",
    },
  ]
  const customItems: Item[] = (
    JSON.parse(getConfig().customQuickLinks) as { title: string; arg: string }[]
  ).map((link) => ({ title: link.title, arg: link.arg, subtitle: link.arg }))
  output(items.concat(customItems))
}

export function output(data: Item[], reRun: boolean = false) {
  if (data.length === 0) {
    data = [
      {
        title: "No results found",
        subtitle: "Try a different query?",
        icon: WARNING_ICON,
        valid: false,
      },
    ]
  }
  const out: { items: Item[]; rerun?: number } = { items: data }
  if (reRun) {
    out.rerun = 1
  }
  console.log(JSON.stringify(out))
}

export function outputError(error: unknown) {
  const parsedError = error instanceof Error ? error.message : String(error)
  const stack = cleanStack(error instanceof Error ? error.stack : undefined)

  const copy = `
\`\`\`
${stack}
\`\`\`
`.trim()

  output([
    {
      title: parsedError,
      subtitle: "Press ⌘L to see the full error and ⌘C to copy it.",
      valid: false,
      text: {
        copy,
        largetype: stack,
      },
      icon: WARNING_ICON,
    },
  ])
}
