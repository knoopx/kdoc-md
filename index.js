#!/usr/bin/env node
/* eslint-disable no-console */

const util = require("util")
const fs = require("fs")
const Path = require("path")
const { argv } = require("process")

const firstBy = require("thenby")
const glob = require("fast-glob")

const { parseDocBlocks } = require("./lib/parsing")
const { packageNameFromPath, indent, render } = require("./lib/support")

const [, , ...params] = argv

;((sourcePath, destPath) => {
  const treeMap = {}
  const packageMap = {}

  const globExpr = Path.join(sourcePath, "**/*.kt")
  console.log(`Searching ${globExpr}...`)

  glob.sync([globExpr]).forEach((file) => {
    console.log(`Processing ${file}`)
    const identifiers = parseDocBlocks(fs.readFileSync(file, "utf8"))

    if (identifiers.length) {
      const parentDir = Path.dirname(
        Path.resolve(file).slice(Path.resolve(sourcePath).length + 1),
      )
      const name = Path.basename(file, Path.extname(file))
      const basename = `${name}.md`
      const path = Path.join(parentDir, basename)
      const source = Path.join(parentDir, Path.basename(file))
      const packageName = packageNameFromPath(parentDir)

      if (!packageMap[parentDir]) {
        packageMap[parentDir] = {
          name: packageName,
          path,
          source,
          types: {},
        }
      }

      identifiers.forEach((doc) => {
        if (doc.type.includes("class")) {
          packageMap[parentDir].types[doc.name] = {
            name: doc.name,
            path,
            source,
            summary: doc.description.split("\n").filter(Boolean)[0],
            packageName,
          }
        }

        console.log(`  ${doc.type.map(util.inspect).join(" ")} ${doc.name}`)
        doc.tags.forEach((tag) => {
          console.log(
            `  @${tag.tag} ${util.inspect(tag.name)} ${tag.description}`,
          )
        })
        console.log(indent(doc.description, 2))
      })

      if (!treeMap[parentDir]) treeMap[parentDir] = []
      treeMap[parentDir].push({
        name: Path.basename(source),
        path,
        source,
        packageName: packageNameFromPath(parentDir),
      })

      const targetPath = Path.join(destPath, Path.join(parentDir, basename))
      fs.mkdirSync(Path.dirname(targetPath), { recursive: true })

      const markdown = render(
        Path.join(__dirname, "templates/PACKAGE.md.ejs"),
        {
          identifiers,
        },
      )

      fs.writeFileSync(targetPath, markdown)
      console.log()
    } else {
      console.log("  no doc blocks found.\n")
    }
  })

  const data = render(Path.join(__dirname, "templates/README.md.ejs"), {
    files: Object.values(treeMap)
      .flatMap((x) => x)
      .sort(firstBy("packageName").thenBy("name")),
    packages: Object.values(packageMap)
      .map((pkg) => ({
        ...pkg,
        types: Object.values(pkg.types),
      }))
      .filter(({ types }) => types.length > 0)
      .sort(firstBy("packageName").thenBy("name")),
  })

  const targetPath = Path.join(destPath, "README.md")
  fs.mkdirSync(Path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, data)
})(...params)
