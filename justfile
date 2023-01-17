export alfred_workflow_data := "./tmp/data"
export alfred_workflow_cache := "./tmp/cache"
export alfred_workflow_bundleid := "qsmr-debug-github-daily"
export alfred_debug := "1"
export GITHUB_TOKEN := `cat github_token.txt`
export GITHUB_USERNAME := `cat github_username.txt`

clean:
  rm -rf dist

# Compile with ncc. Package with pkg
build analyze-bundle="false": clean
  ./node_modules/.bin/ncc build \
    --minify \
    --target=es2021 \
    {{ if analyze-bundle == "true" { "--stats-out=dist/stats.json" } else { "" } }} \
    index.ts
  # Extra files created by pino
  rm dist/file.js \
    dist/worker.js \
    dist/worker1.js \
    dist/worker-pipeline.js
  cp package.compile.json dist/package.json
  cd dist && ../node_modules/.bin/pkg . --targets node18-macos-arm64

dev: clean
  ./node_modules/.bin/ncc build --source-map --watch index.ts

run *args:
  /usr/bin/time -h node ./dist/index.js {{args}}

run-bg-task command:
  node ./dist/index.js --command={{command }} --background

# Run packaged app
run-prod *args:
  /usr/bin/time ./dist/github-daily {{args}}

analyze: (build "true")
  ./node_modules/.bin/webpack-bundle-analyzer dist/stats.json

