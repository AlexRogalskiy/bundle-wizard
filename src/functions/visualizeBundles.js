const fs = require('fs-extra')
const { explore } = require('source-map-explorer')
const path = require('path')
const handler = require('serve-handler')
const http = require('http')
const open = require('open')
const getPort = require('get-port')
const processSourceMapExplorerData = require('./processSourceMapExplorerDataIntoTreemap')

const visualizeBundles = async ({
  bundles,
  coverageFilePath,
  url,
  scriptsWithoutSourcemapsDict,
  priorities,
  longTasks
}) => {
  console.log(`\n🖼️   Generating visualization...\n`)

  try {
    const data = await explore(bundles, {
      output: {
        format: 'json'
      },
      coverage: coverageFilePath
    })

    const tempFolder = path.join(__dirname, '..', '..', 'temp')
    const distFolder = path.join(__dirname, '..', '..', 'dist')
    const processedData = processSourceMapExplorerData(
      data.bundles,
      scriptsWithoutSourcemapsDict
    )
    const fileName = `${tempFolder}/treeData.json`

    const getFileName = url => (url ? url.split(/\//g).slice(-1)[0] : '')

    processedData.children.forEach(bundle => {
      bundle.request = priorities.find(priority => {
        if (!priority.url) return
        return (
          priority.url === bundle.name ||
          getFileName(priority.url) === bundle.name
        )
      })
      const bundleLongTasks = longTasks.filter(task => {
        return (
          task.attributableURLs.find(n => n === bundle.name) ||
          task.attributableURLs.map(getFileName).find(n => n === bundle.name)
        )
      })
      if (bundleLongTasks.length) {
        // just take  the longest
        bundle.longTask = bundleLongTasks
          .map(task => task.duration)
          .reduce((acc, curr) => {
            if (curr > acc) return curr
            return acc
          }, 0)
      }
    })

    Object.assign(processedData, { url })

    fs.writeFileSync(fileName, JSON.stringify(processedData))
    fs.copySync(fileName, `${distFolder}/treeData.json`)
    fs.copySync(
      `${tempFolder}/originalFileMapping.json`,
      `${distFolder}/originalFileMapping.json`
    )
    fs.copySync(`${tempFolder}/originalFiles`, `${distFolder}/originalFiles`)
    fs.copySync(`${tempFolder}/screenshot.png`, `${distFolder}/screenshot.png`)

    const server = http.createServer((request, response) => {
      return handler(request, response, {
        public: distFolder
      })
    })

    const port = await getPort({ port: [3000, 3001, 3002, 3003] })

    server.listen(port, async () => {
      console.log(
        `🎊  Done! A visualization is running at: http://localhost:${port}\n`
      )
      open(`http://localhost:${port}`)

      console.log(
        `If you wish to save or share them, the visualization files can be found in the following directory:\n\n📂 ${distFolder}`
      )
    })
  } catch (e) {
    console.error('⚠️  Failed to generate source map visualization')
    console.error(e)
  }
}

module.exports = visualizeBundles
