export alfred_workflow_data := "./tmp/data"
export alfred_workflow_cache := "./tmp/cache"
export alfred_workflow_bundleid := "qsmr-debug-github-daily"
export GITHUB_TOKEN := `cat github_token.txt`
export GITHUB_USERNAME := `cat github_username.txt`

build:
  ./node_modules/.bin/ncc build --minify --v8-cache index.ts
  cp compile.package.json dist/package.json
  cd dist && ../node_modules/.bin/pkg .


dev:
  ./node_modules/.bin/ncc build --source-map --v8-cache --watch index.ts

run *args:
  alfred_debug=1 node ./dist/index.js {{args}}

run-prod *args: build
  alfred_debug=1 ./dist/github-daily {{args}}
