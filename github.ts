import { Octokit } from "octokit"

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_USERNAME = process.env.GITHUB_USERNAME
const ghClient = new Octokit({
  auth: GITHUB_TOKEN,
  userAgent: "qsmr-github-daily",
})

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
  const response = (await ghClient.graphql(myPrsQuery)) as MyPrsQueryResponse

  if (response.viewer.pullRequests.totalCount > PRS_RESULTS_TO_FETCH) {
    console.error(
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
    query: "is:pr state:open involves:${GITHUB_USERNAME} sort:updated"
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
  const res2 = (await ghClient.graphql(
    involvedPrsQuery
  )) as InvolvedPrsQueryResponse

  const prs = res2.search.nodes
  if (res2.search.issueCount > PRS_RESULTS_TO_FETCH) {
    console.error(
      `Only returning first ${PRS_RESULTS_TO_FETCH} results of ${res2.search.issueCount}`
    )
  }
  return prs.map((pr) => ({
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
    const res = (await ghClient.graphql(
      getReposQuery(cursor)
    )) as ReposQueryResponse
    const data = res.viewer.repositories
    repos.push(...data.nodes)
    cursor = data.pageInfo.endCursor
    hasNextPage = data.pageInfo.hasNextPage
    console.error(data.pageInfo)
  }

  return repos
}
