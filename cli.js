#!/usr/bin/env node
const fs = require('fs')
const [, , ...args] = process.argv
const child_process = require('child_process')

console.log("hello")
const getPkg = (path, callback) => {
  fs.readFile(`./node_modules/${path}/package.json`, 'utf-8', (err, data) => {
    if (err) {
      callback()
      return
    }
    const json = JSON.parse(data)
    callback(json)
  })
}
const cat = (arr) => {
  for (let i = 1; i < arr.length; i++) {
    arr[0].push(...arr[i])
  }
  return arr[0]
}
const escape = (str) => {
  return str.replace("/", "\\/")
}
let onexit = () => { }
process.on('exit', () => onexit())
fs.readFile('./package.json', 'utf-8', (err, data) => {
  if (err) console.log("no package.json in ./")
  const json = JSON.parse(data)
  const rootName = json.name
  const packages = {}
  let outstanding = 0
  const findImports = (name, callback) => {
    const package = packages[name]
    for (let key of package.in) {
      if (key === rootName) {
        // promises.push(rg(`./`, `from (\\"|')${escape(name)}(\\"|')`).catch((e) => console.log(e)))
      } else {
        child_process.exec((`rg --json -u 'from .${name}.' -g '!./node_modules/${key}/**.js'`), (err, stdout, stderr) => {
          if (err) {
            console.log(stderr)
            callback()
          } else {
            const result = []
            for (let match of stdout.matchAll(/[^\n]+/g)) {
              const json = JSON.parse(match[0])
              if (json.type === "match") {
                result.push({ path: json.data.path, line_number: json.data.line_number, text: json.data.lines.text })
              }
            }
            callback(result)
          }
        })
      }
    }
  }
  const finishReadingPackages = () => {
    onexit = () => {
      fs.writeFileSync(`./.npm-dep-pruner.json`, JSON.stringify(promising, null, "\t"))
      fs.writeFileSync(`./.npm-dep-pruner-dump.json`, JSON.stringify(packages, null, "\t"))
    }
    const promising = []
    let outstanding = 0
    for (let name in packages) {
      const package = packages[name]
      if (package.in.length === 1) {
        outstanding += 1
        findImports(name, imports => {
          if (imports) {
            if (imports.length > 0) {
              promising.push(imports)
            }
          }
          outstanding--
          console.log(`outstanding ${outstanding}`)
          if (outstanding === 0) {
            console.log('writing')
            fs.writeFileSync(`./.npm-dep-pruner.json`, JSON.stringify(promising, null, "\t"))
          }
        })
      }
    }
  }
  const readModule = (name) => {
    packages[name] = { in: [], out: [] }
    getPkg(name, (json) => {
      if (json) {
        for (let key in json.dependencies) {
          packages[name].out.push(key)
          if (!(key in packages)) {
            outstanding++
            readModule(key)
          }
          packages[key].in.push(json.name)
        }
      }
      outstanding--
      if (outstanding === 0) {
        finishReadingPackages()
      }
    })
  }
  packages[json.name] = { in: [], out: [] }
  for (let key in json.dependencies) {
    outstanding++
    packages[json.name].out.push(key)
    readModule(key)
    packages[key].in.push(rootName)
  }
})