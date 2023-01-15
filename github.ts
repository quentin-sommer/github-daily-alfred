import { logger } from "./logger"
import { getConfig } from "./config"
import https, { RequestOptions } from "https"

async function graphqlRequest(query: string): Promise<unknown> {
  const payload = JSON.stringify({ query })
  const options: RequestOptions = {
    hostname: "api.github.com",
    port: 443,
    path: "/graphql",
    method: "POST",
    headers: {
      authorization: `Bearer ${getConfig().githubToken}`,
      "User-Agent": "qsmr-github-daily",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  }

  const response = await new Promise<string>((resolve, reject) => {
    let body = ""
    const req = https.request(options, (res) => {
      res.setEncoding("utf8")
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () => {
        if (res.statusCode !== undefined && res.statusCode < 400) {
          resolve(body)
        } else {
          reject(body)
        }
      })
    })
    req.on("error", (e) => reject(e))
    req.write(payload)
    req.end()
  })

  return JSON.parse(response).data
}

const PRS_RESULTS_TO_FETCH = 100
const REPOS_RESULTS_TO_FETCH = 100
const myPrsQuery = `{
  viewer {
    pullRequests(
      first: ${PRS_RESULTS_TO_FETCH}
      states: OPEN
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      totalCount
      nodes {
        title
        number
        repository {
          nameWithOwner
        }
        url
      }
    }
  }
}`

type PrPartialResponse = {
  title: string
  number: number
  repository: {
    nameWithOwner: string
  }
  url: string
}

type MyPrsQueryResponse = {
  viewer: {
    pullRequests: {
      totalCount: number
      nodes: PrPartialResponse[]
    }
  }
}

type Prs = {
  title: string
  number: number
  repositoryFullName: string
  url: string
}[]
export async function getMyPrs(): Promise<Prs> {
  const response = (await graphqlRequest(myPrsQuery)) as MyPrsQueryResponse

  if (response.viewer.pullRequests.totalCount > PRS_RESULTS_TO_FETCH) {
    logger().info(
      `Only returning first ${PRS_RESULTS_TO_FETCH} results of ${response.viewer.pullRequests.totalCount}`
    )
  }
  return response.viewer.pullRequests.nodes.map((pr) => ({
    url: pr.url,
    title: pr.title,
    repositoryFullName: pr.repository.nameWithOwner,
    number: pr.number,
  }))
}

const involvedPrsQuery = `{
  search(
    first: ${PRS_RESULTS_TO_FETCH}
    query: "is:pr state:open involves:${
      getConfig().githubUsername
    } sort:updated"
    type: ISSUE    
  ) {
    issueCount
    nodes {
      ... on PullRequest {
        title
        number
        repository {
          nameWithOwner
        }
        url
      }
    }
  }
}`

type InvolvedPrsQueryResponse = {
  search: {
    issueCount: number
    nodes: PrPartialResponse[]
  }
}
export async function getInvolvedPrs(): Promise<Prs> {
  const res = (await graphqlRequest(
    involvedPrsQuery
  )) as InvolvedPrsQueryResponse
  if (res.search.issueCount > PRS_RESULTS_TO_FETCH) {
    logger().info(
      `Only returning first ${PRS_RESULTS_TO_FETCH} results of ${res.search.issueCount}`
    )
  }

  return res.search.nodes.map((pr) => ({
    title: pr.title,
    repositoryFullName: pr.repository.nameWithOwner,
    number: pr.number,
    url: pr.url,
  }))
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
    )) as ReposQueryResponse

    const data = res.viewer.repositories
    repos.push(...data.nodes)
    cursor = data.pageInfo.endCursor
    hasNextPage = data.pageInfo.hasNextPage
    logger().info(data.pageInfo)
  }

  return repos
}
