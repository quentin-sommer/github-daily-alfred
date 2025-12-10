# Github daily

## Installation

See [releases](https://github.com/quentin-sommer/github-daily-alfred/releases) to download workflow file.

⚠️ before running you need to manually allow the binary to be executed.
You must mark the workflow (and the contained) as runnable like this: 

```bash
xattr -cr ~/Downloads/github-daily-arm64.alfredworkflow 
```

## Configuration

### User configuration

**GITHUB_TOKEN**: Create a GitHub API token (make sure to make it
permanent) [here](https://github.com/settings/tokens/new?description=GitHub%20Daily%20Alfred%20workflow&scopes=repo)

**QUICK_LINKS**: Custom URLs that will be shown when you run `gh`. You could add the URL to a GitHub project you visit
often for example. Format: JSON array like
`[{"title": "My title", "arg": "https://destination.com"}]`

### Running the workflow

#### Usage

**Commands**

- `gh`: list of common GitHub pages
- `repos`: list of all repos you have access to
- `prs`: list of the PRs you created
- `involved`: list of the PRs where you are involved, but did not create (tagged, asked for review, commented)
- `reviews`: list of the PRs where you are involved, but did not approve ✅ yet

**Filtering**: `repos`, `prs`, `reviews` all support filtering with fuzzy search

**Action**: The action associated to every results is opening the URL in the default browser.

## Development

This project uses bun.sh to package a JS cli into an executable
