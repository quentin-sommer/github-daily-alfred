import { getInvolvedPrs, getMyPrs, getRepos } from "./github"
import { Cache } from "./cache"
import cleanStack from "clean-stack"
import Fuse from "fuse.js"
import type { Command } from "./index"
import { deleteBackgroundLock, isRunning, runInBackground } from "./background"
import type { Maybe } from "./utils"
import { logger } from "./logger"
import { getConfig } from "./config"

function minutesDuration(minutes: number) {
  return minutes * 60 * 1000
}

const MAX_ITEMS_TO_RETURN = 100

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
    logger().error("here2")

    items = await fetcher()
    logger().error("here3")

    cache.set(command, items, cacheTTLMs)
    logger().error("here4")

    deleteBackgroundLock(command, cacheDir)
    logger().error("here5")

    process.exit(0)
  } else {
    const cached = cache.get(command)
    if (cached !== undefined) {
      items = cached.value
      if (cached.stale) {
        shouldRerun = true
        if (isRunning(command, cacheDir)) {
          logger().info(`Already updating in the background`)
        } else {
          logger().info(`Updating stale ${command} in background.`)
          runInBackground(command, cacheDir)
        }
      }
    } else {
      output(
        [
          {
            title: `Fetching ${command}`,
            subtitle: "",
            icon: { path: "TODO" },
          },
        ],
        true
      )
      runInBackground(command, cacheDir)
      logger().info(`Fetching ${command} in background.`)
      return
    }
  }

  if (!filter) {
    output(items.slice(0, MAX_ITEMS_TO_RETURN), shouldRerun)
    return
  }

  logger().info("Filtering with " + filter)
  const options: Fuse.IFuseOptions<Item> = {
    keys: ["title"],
    includeScore: true,
    shouldSort: true,
    sortFn: (a, b) => b.score - a.score,
    //    threshold: 0.1,
    ignoreLocation: true,
  }

  const fuse = new Fuse(items, options)
  const result = fuse.search(filter)

  output(
    result.slice(0, MAX_ITEMS_TO_RETURN).map((item) => {
      item.item.title = item.score?.toFixed(2) + " " + item.item.title
      return item.item
    }),
    shouldRerun
  )
}

export async function prs(runningInBackground: boolean, filter?: string) {
  await executeFetchCommand(
    "prs",
    runningInBackground,
    minutesDuration(1),
    filter,
    async () => {
      const prs = await getMyPrs()
      const items: Item[] = prs.map((pr) => ({
        uid: pr.number.toString(),
        title: pr.title,
        subtitle: pr.repositoryFullName,
        arg: pr.url,
        icon: {
          path: "icon.png",
        },
        valid: true,
      }))

      return items
    }
  )
}

export async function reviews(runningInBackground: boolean, filter?: string) {
  await executeFetchCommand(
    "reviews",
    runningInBackground,
    minutesDuration(1),
    filter,
    async () => {
      logger().error("inside fetch reviews1")
      const prs = await getInvolvedPrs()
      logger().error("inside fetch reviews2")

      const items: Item[] = prs.map((pr) => ({
        uid: pr.number.toString(),
        title: pr.title,
        subtitle: pr.repositoryFullName,
        arg: pr.url,
        icon: {
          path: "icon.png",
        },
        valid: true,
      }))
      logger().error("inside fetch reviews3")

      return items
    }
  )
}

type Item = {
  uid?: string
  title: string
  subtitle: string
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
    minutesDuration(20),
    filter,
    async () => {
      const repos = await getRepos()
      const items: Item[] = repos.map((repo) => ({
        uid: repo.id,
        title: repo.nameWithOwner,
        subtitle: repo.url,
        arg: repo.url,
        icon: {
          path: "icon.png",
        },
        valid: true,
      }))

      return items
    }
  )
}

export async function menu(_runningInBackground: boolean, _filter?: string) {
  const items: Item[] = [
    {
      title: "Data-science project",
      arg: "https://github.com/orgs/TransitApp/projects/12",
      subtitle: "https://github.com/orgs/TransitApp/projects/12",
    },
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
  output(items)
}

export function output(data: Item[], reRun: boolean = false) {
  if (data.length === 0) {
    data = [
      {
        title: "No results found",
        subtitle: "Try a different query?",
        icon: {
          path: "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertStopIcon.icns",
        },
        uid: "",
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
      icon: {
        path: "",
      },
    },
  ])
}
