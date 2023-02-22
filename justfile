export alfred_workflow_data := justfile_directory() / "tmp/data"
export alfred_workflow_cache := justfile_directory() / "tmp/cache"
export alfred_workflow_bundleid := "qsmr-debug-github-daily"
export alfred_debug := "1"
export GITHUB_TOKEN := `cat github_token.txt`
export GITHUB_USERNAME := `cat github_username.txt`
export QUICK_LINKS := `cat quick_links.json`

build_directory := justfile_directory() / "workflow" / "dist"

clean:
  rm -rf {{build_directory}}

build-arm: (_build "arm64")

build-x64: (_build "x64")

build: build-arm

package: (_package "arm64") (_package "x64")

dev: clean
  ./node_modules/.bin/ncc build \
    --out={{build_directory}} \
    --source-map \
    --watch \
    src/index.ts

run *args:
  /usr/bin/time -h node {{build_directory}}/index.js {{args}}

run-bg-task command:
  node {{build_directory}}/index.js --command={{command}} --background

# Run packaged app
run-prod *args:
  /usr/bin/time {{build_directory}}/github-daily {{args}}

analyze: build
  ./node_modules/.bin/webpack-bundle-analyzer {{build_directory}}/stats.json

# Compile with ncc. Package with pkg
_build arch: clean
  ./node_modules/.bin/ncc build \
    --minify \
    --target=es2021 \
    --stats-out={{build_directory / "stats.json"}} \
    --out={{build_directory}} \
    src/index.ts
  # Extra files created by pino
  cd {{build_directory}} && rm \
    file.js \
    worker.js \
    worker1.js \
    worker-pipeline.js
  cp package.compile.json {{build_directory}}/package.json
  cd {{build_directory}} && \
    {{justfile_directory()}}/node_modules/.bin/pkg . \
    --targets latest-macos-{{arch}}

# Create alfred workflow export file
_package arch: (_build arch)
  rm -rf tmp/workflow-{{arch}}

  rsync -r \
    --exclude=prefs.plist \
    --exclude=stats.json \
    workflow/* tmp/workflow-{{arch}}

  # re-ignore to be extra safe
  cd tmp/workflow-{{arch}} && zip -x prefs.plist -r github-daily.alfredworkflow *

  mv tmp/workflow-{{arch}}/github-daily.alfredworkflow \
    github-daily-{{arch}}.alfredworkflow
