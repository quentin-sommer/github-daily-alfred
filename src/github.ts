import { logger } from "./logger"
import { getConfig } from "./config"
import https, { RequestOptions } from "https"

async function graphqlRequest(query: string): Promise<Record<string, unknown>> {
  const payload = JSON.stringify({ query })
  const appConfig = getConfig()
  const options: RequestOptions = {
    hostname: "api.github.com",
    port: 443,
    path: "/graphql",
    method: "POST",
    headers: {
      authorization: `Bearer ${appConfig.githubToken}`,
      "User-Agent": appConfig.appName,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  }

  const response = await new Promise<{ data: Record<string, unknown> }>(
    (resolve, reject) => {
      let body = ""
      const req = https.request(options, (res) => {
        res.setEncoding("utf8")
        res.on("data", (chunk) => (body += chunk))
        res.on("end", () => {
          if (res.statusCode !== undefined && res.statusCode < 400) {
            resolve(JSON.parse(body))
          } else {
            reject(JSON.parse(body))
          }
        })
      })
      req.on("error", (e) => reject(e))
      req.write(payload)
      req.end()
    }
  )

  return response.data
}

const PRS_RESULTS_TO_FETCH = 100
const REPOS_RESULTS_TO_FETCH = 100
const prsPartialQuery = `{
  id
  title
  number
  repository {
    nameWithOwner
  }
  url
  reviews(
    first: 10
    author: "${getConfig().githubUsername}"
    states: [APPROVED]
  ) {
    nodes {
      state
      author {
        login
      }
    }
  }
}
`
const myPrsQuery = `{
  viewer {
    pullRequests(
      first: ${PRS_RESULTS_TO_FETCH}
      states: OPEN
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      totalCount
      nodes ${prsPartialQuery}
    }
  }
}`

type PrPartialResponse = {
  id: string
  title: string
  number: number
  repository: {
    nameWithOwner: string
  }
  url: string
  reviews: {
    nodes: {
      state: "APPROVED"
      author: {
        login: string
      }
    }[]
  }
}

type MyPrsQueryResponse = {
  viewer: {
    pullRequests: {
      totalCount: number
      nodes: PrPartialResponse[]
    }
  }
}

export type Pr = {
  id: string
  title: string
  number: number
  repositoryFullName: string
  url: string
}
type Prs = Pr[]
export async function getMyPrs(): Promise<Prs> {
  const response = (await graphqlRequest(myPrsQuery)) as MyPrsQueryResponse

  if (response.viewer.pullRequests.totalCount > PRS_RESULTS_TO_FETCH) {
    logger().debug(
      `Only returning first ${PRS_RESULTS_TO_FETCH} results of ${response.viewer.pullRequests.totalCount}`
    )
  }
  return response.viewer.pullRequests.nodes.map((pr) => ({
    id: pr.id,
    url: pr.url,
    title: pr.title,
    repositoryFullName: pr.repository.nameWithOwner,
    number: pr.number,
  }))
}

const involvedPrsQuery = `{
  search(
    first: ${PRS_RESULTS_TO_FETCH}
    query: "is:pr state:open sort:updated -author:${
      getConfig().githubUsername
    } involves:${getConfig().githubUsername}"
    type: ISSUE    
  ) {
    issueCount
    nodes {
      ... on PullRequest ${prsPartialQuery}
    }
  }
}`

type InvolvedPrsQueryResponse = {
  search: {
    issueCount: number
    nodes: PrPartialResponse[]
  }
}

async function internalGetInvolvedPrs() {
  const res = (await graphqlRequest(
    involvedPrsQuery
  )) as InvolvedPrsQueryResponse
  if (res.search.issueCount > PRS_RESULTS_TO_FETCH) {
    logger().debug(
      `Only returning first ${PRS_RESULTS_TO_FETCH} results of ${res.search.issueCount}`
    )
  }

  return res.search.nodes
}

export async function getActionableReviews(): Promise<Prs> {
  return (
    (await internalGetInvolvedPrs())
      // Keep PRs without approved reviews by current user
      .filter((pr) => pr.reviews.nodes.length === 0)
      .map(prMapper)
  )
}

export async function getInvolvedPrs(): Promise<Prs> {
  return (await internalGetInvolvedPrs()).map(prMapper)
}

function getReposQuery(cursor: string | undefined) {
  return `{
  viewer {
    repositories(
      first: ${REPOS_RESULTS_TO_FETCH}
      ${cursor !== undefined ? `after: "${cursor}"` : ""}
      affiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR]
      ownerAffiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR]
      orderBy: {field: PUSHED_AT, direction: DESC}
    ) {
      pageInfo {
        endCursor
        hasNextPage
      }
      totalCount
      nodes {
        nameWithOwner
        url
        id
      }
    }
  }
}`
}
export interface ReposQueryResponse {
  viewer: {
    repositories: {
      pageInfo: {
        endCursor: string
        hasNextPage: boolean
      }
      totalCount: number
      nodes: {
        nameWithOwner: string
        url: string
        id: string
      }[]
    }
  }
}
export type Repos = {
  nameWithOwner: string
  url: string
  id: string
}[]
export async function getRepos(): Promise<Repos> {
  let cursor: string | undefined = undefined
  let hasNextPage = true

  const repos: Repos = []
  while (hasNextPage) {
    const res = (await graphqlRequest(
      getReposQuery(cursor)
    )) as unknown as ReposQueryResponse

    const data = res.viewer.repositories
    repos.push(...data.nodes)
    cursor = data.pageInfo.endCursor
    hasNextPage = data.pageInfo.hasNextPage
    logger().debug({ page: data.pageInfo, msg: "Fetching repos page" })
  }

  return repos
}

function prMapper(pr: PrPartialResponse): Pr {
  return {
    id: pr.id,
    title: pr.title,
    repositoryFullName: pr.repository.nameWithOwner,
    number: pr.number,
    url: pr.url,
  }
}
