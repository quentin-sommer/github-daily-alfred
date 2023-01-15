import { getInvolvedPrs, getMyPrs, getRepos } from "./github"
import { Cache } from "./cache"
import cleanStack from "clean-stack"
import Fuse from "fuse.js"
import { Command } from "./index"
import { isRunning, runInBackground } from "./background"
import { Maybe } from "./utils"

function minutesDuration(minutes: number) {
  return minutes * 60 * 1000
}

const CACHE_DIR = process.env.alfred_workflow_cache
const MAX_ITEMS_TO_RETURN = 100

export async function executeFetchCommand(
  command: Command,
  runningInBackground: boolean,
  cacheTTLMs: number,
  filter: Maybe<string>,
  fetcher: () => Promise<Item[]>
) {
  if (CACHE_DIR === undefined) {
    outputError("alfred_workflow_data is not set")
    process.exit(1)
  }
  const cache = new Cache<Item[]>(CACHE_DIR)
  let shouldRerun = false
  let items: Item[]

  if (runningInBackground) {
    items = await fetcher()
    cache.set(command, items, cacheTTLMs)
  } else {
    const cached = cache.get(command)
    if (cached !== undefined) {
      items = cached.value
      if (cached.stale) {
        shouldRerun = true
        if (isRunning(command, CACHE_DIR)) {
          console.error(`Already updating in the background`)
        } else {
          console.error(`Updating stale ${command} in background.`)
          runInBackground(command, CACHE_DIR)
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
      runInBackground(command, CACHE_DIR)
      console.error(`Fetching ${command} in background.`)
      return
    }
  }

  if (!filter) {
    output(items.slice(0, MAX_ITEMS_TO_RETURN), shouldRerun)
    return
  }

  console.error("Filtering with " + filter)
  const options: Fuse.IFuseOptions<Item> = {
    keys: ["title"],
    includeScore: true,
    shouldSort: true,
    sortFn: (a, b) => b.score - a.score,
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
      const prs = await getInvolvedPrs()
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

type Item = {
  uid?: string
  title: string
  subtitle: string
  arg?: string
  icon: {
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

export async function menu(runningInBackground: boolean, _filter?: string) {}

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
