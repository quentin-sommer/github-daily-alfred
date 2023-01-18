# Github daily

## Installation

See [releases](https://github.com/quentin-sommer/github-daily-alfred/releases) to download workflow file.

## Configuration

### User configuration

**GITHUB_TOKEN**: Create a GitHub API token (make sure to make it
permanent) [here](https://github.com/settings/tokens/new?description=GitHub%20Daily%20Alfred%20workflow&amp;amp;scopes=repo)

**QUICK_LINKS**: Custom URLs that will be shown when you run `gh`. You could add the URL to a GitHub project you visit
often for example. Format: JSON array like
```[{"title": "My title", "arg": "https://destination.com"}]```

### Running the workflow

#### First run

⚠️ The first time you'll run the workflow you will get a warning from Apple saying that the binary cannot be run.
You must mark the binary as runnable like this: right click on the `dist/github-daily` file and click "open". It will
run with an error because it expects options but now Apple will allow you to run it.

The binary is in the `dist` folder inside the workflow directory. To open the workflow directory: right click the
workflow in the list -&gt; open in finder

#### Usage

**Commands**

- `gh`: list of common GitHub pages
- `repos`: list of all repos you have access to
- `prs`: list of the PRs you created
- `reviews`: list of the PRs where you are involved, but did not create (tagged, asked for review, commented)

**Filtering**: `repos`, `prs`, `reviews` all support filtering with fuzzy search

**Action**: The action associated to every results is opening the URL in the default browser.