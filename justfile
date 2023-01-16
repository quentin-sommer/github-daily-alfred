export alfred_workflow_data := "./tmp/data"
export alfred_workflow_cache := "./tmp/cache"
export alfred_workflow_bundleid := "qsmr-debug-github-daily"
export alfred_debug := "1"
export GITHUB_TOKEN := `cat github_token.txt`
export GITHUB_USERNAME := `cat github_username.txt`

clean:
  rm -rf dist

build generate-cache="true": clean
  ./node_modules/.bin/ncc build \
    {{ if generate-cache == "true" { "--v8-cache" } else { "" } }} \
    --minify \
    --target=es2020 \
    --stats-out=dist/stats.json \
    index.ts

dev: clean
  ./node_modules/.bin/ncc build --source-map --watch index.ts

run *args:
  /usr/bin/time -h node ./dist/index.js {{args}}

run-bg-task command:
  alfred_debug=1 node ./dist/index.js --command={{command }} --background

analyze: (build "generate-cache=false")
  ./node_modules/.bin/webpack-bundle-analyzer dist/stats.json