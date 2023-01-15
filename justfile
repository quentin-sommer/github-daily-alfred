export alfred_workflow_data := "./tmp/data"
export alfred_workflow_cache := "./tmp/cache"
export alfred_workflow_bundleid := "qsmr-debug-github-daily"
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
  cp compile.package.json dist/package.json
  cd dist && ../node_modules/.bin/pkg .


dev: clean
  ./node_modules/.bin/ncc build --source-map --watch index.ts

run *args:
  /usr/bin/time -h node ./dist/index.js {{args}}

run-bg-task command:
  alfred_debug=1 node ./dist/index.js --command={{command }} --background

run-standalone *args: build
  /usr/bin/time -h ./dist/github-daily {{args}}


analyze: (build "generate-cache=false")
  ./node_modules/.bin/webpack-bundle-analyzer dist/stats.json