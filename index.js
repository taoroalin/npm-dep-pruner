const fetch = require('node-fetch')
const fs = require('fs')
const promisify = require('util').promisify
const AbortController = require('abort-controller');
const http = require('http')
const process = require('process')

let deprecated = {}

const getNpm = (package, version, callback) => {
  // console.log(package)
  if (version) {
    let res
    fetch(`http://registry.npmjs.org/${package}/${version}`).then(res => {
      if (res.status === 200) {
        res.json().then(json => callback(json)).catch(callback)
      } else callback()
    })
  } else {
    fetch(`http://registry.npmjs.org/${package}`).then(res => {
      if (res.status === 200) {
        res.json().then(json => {
          const latest = json["dist-tags"].latest
          // console.log(latest)
          callback(json.versions[latest])
        }).catch(callback)
      } else callback()
    }).catch(callback)
  }
}

const getGithub = (url, branch, callback) => {
  if (!branch) {
    branch = "master"
  }
  url = `http://raw.githubusercontent.com/${url.match(/github.com\/(([^\/]+)\/([^\/]+))/)[1]}/${branch}/package.json`
  fetch(url).then(res => {
    if (res.status === 200) {
      res.json().then(json => callback(json)).catch(callback)
    }
  }).catch(callback)
}

const analyzePackageJson = (package, callback) => {
  const packages = {}
  let outstanding = 1
  let done = 0
  const analyze = (package) => {
    console.log(`${outstanding} ${done}`)
    packages[package.name] = { in: [], out: [] }
    if (package.deprecated) {
      packages[package.name].deprecated = true
    }
    if (package.dependencies) {
      const depsobj = package.dependencies
      for (let key in depsobj) {
        packages[package.name].out.push(key)
        if (!(key in packages)) {
          const version = depsobj[key]
          // const cleaned = semver.coerce(version)
          // console.log(`cleaned ${cleaned}`)
          outstanding++
          getNpm(key, undefined, (dep) => {
            if (dep) {
              analyze(dep)
              if (packages[key])
                packages[key].in.push(package.name)
            }
            done++
            if (done >= outstanding) {
              callback(packages)
              process.exit()
            }
          })
          // let dep
          // if (version.match(/^\^\d+\.\d+\.\d+$/)) {
          //   dep = await getNpm(key)
          // } else if (version.match(/^\d+\.\d+\.\d+$/)) {
          //   dep = await getNpm(key, version)
          // } else if (version.match(/^https?:\/\//)) {
          // }
          // console.log(dep)
        } else
          packages[key].in.push(package.name)
      }
    }
  }
  analyze(package)
  done += 1
  if (done >= outstanding) {
    callback(packages)
    process.exit()
  }
  setInterval(() => callback(packages), 1000)
}

const analyze = (package) => {
  analyzePackageJson(package, res => {
    const found = find(res)
    fs.writeFileSync(`./.output/${package.name}/deps.json`, JSON.stringify(res))
  })
}
const analyzeNpm = (name) => {
  getNpm(name, undefined, analyze)
}
const analyzeGithub = (url) => {
  getGithub(url, undefined, analyze)
}
// analyzeNpm('cheerio')
analyzeGithub("https://github.com/lesswrong2/Lesswrong2")


const find = (packages) => {
  const result = {}
  for (let name in packages) {
    const p = packages[name]
    if (p.in.length <= 1) {
      result[name] = p
    }
  }
  return result
}