export alfred_workflow_data := justfile_directory() / "tmp/data"
export alfred_workflow_cache := justfile_directory() / "tmp/cache"
export alfred_workflow_bundleid := "qsmr-debug-github-daily"
export alfred_debug := "1"
export GITHUB_TOKEN := `cat github_token.txt`
export GITHUB_USERNAME := `cat github_username.txt`
export QUICK_LINKS := `cat quick_links.json`

build_directory := justfile_directory() / "workflow" / "dist"

clean:
  rm -rf {{build_directory}} tmp

build-arm: (_build "arm64")

build-x64: (_build "x64")

build: lint build-arm

package: (_package "arm64") (_package "x64")

lint:
  bun tsc --noEmit

dev: clean
  mkdir -p {{build_directory}}
  bun --watch src/index.ts -- \
    --command=menu \
    --filter=""

run *args:
  bun src/index.ts {{args}}

run-bg-task command:
  bun src/index.ts --command={{command}} --background

# Run packaged app
run-prod *args:
  /usr/bin/time -h {{build_directory}}/github-daily {{args}}

# Compile with bun
_build arch: clean
  mkdir -p {{build_directory}}
  bun build ./src/index.ts \
    --compile \
    --minify \
    --target=bun-darwin-{{arch}} \
    --outfile={{build_directory}}/github-daily

# Create alfred workflow export file
_package arch: (_build arch)
  rm -rf tmp/workflow-{{arch}}
  mkdir -p tmp

  rsync -r \
    --exclude=prefs.plist \
    workflow/* tmp/workflow-{{arch}}

  # re-ignore to be extra safe
  cd tmp/workflow-{{arch}} && zip -x prefs.plist -r github-daily.alfredworkflow *

  mv tmp/workflow-{{arch}}/github-daily.alfredworkflow \
    github-daily-{{arch}}.alfredworkflow
