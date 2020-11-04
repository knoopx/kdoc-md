#!/usr/bin/env node
/* eslint-disable no-console */

const util = require("util")
const fs = require("fs")
const path = require("path")
const { argv } = require("process")

const table = require("gfm-table")
const glob = require("fast-glob")

const { generateMarkdown, parseDocBlocks } = require("./lib/support")

const indent = (text, w, char = " ") => {
  return text
    .split("\n")
    .map((line) => char.repeat(w) + line)
    .join("\n")
}

function packageNameFromPath(string) {
  return string.replace(new RegExp(path.sep, "g"), ".")
}

const [, , ...params] = argv

;(async (sourcePath, destPath) => {
  const tree = {}
  const packages = {}

  const globExpr = path.join(sourcePath, "**/*.kt")
  console.log(`Searching ${globExpr}...`)
  const stream = glob.stream([globExpr])

  for await (const file of stream) {
    console.log(`Processing ${file}`)
    const data = parseDocBlocks(fs.readFileSync(file, "utf8"))

    if (data.length === 0) {
      console.log("  no doc blocks found.")
      continue
    }

    const parentDir = path.dirname(
      path.resolve(file).slice(path.resolve(sourcePath).length + 1),
    )
    const basename = `${path.basename(file, path.extname(file))}.md`

    if (!packages[parentDir]) {
      packages[parentDir] = {}
    }

    data.forEach((doc) => {
      if (doc.type.includes("class")) {
        packages[parentDir][doc.name] = {
          doc,
          path: path.join(parentDir, basename),
          source: path.join(parentDir, path.basename(file)),
        }
      }

      const leading = doc.type.includes("class") ? "  " : "    "
      console.log(
        `${leading}${doc.type.map(util.inspect).join(" ")} ${doc.name}`,
      )
      doc.tags.forEach((tag) => {
        console.log(
          `${leading}@${tag.tag} ${util.inspect(tag.name)} ${tag.description}`,
        )
      })
      console.log(`${indent(doc.description, leading.length)}\n`)
    })

    if (!tree[parentDir]) tree[parentDir] = []
    tree[parentDir].push({
      path: path.join(parentDir, basename),
      source: path.join(parentDir, path.basename(file)),
    })

    const targetPath = path.join(destPath, path.join(parentDir, basename))
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    const markdown = `# ${path.join(
      parentDir,
      path.basename(file),
    )}\n\n${generateMarkdown(data)}`
    fs.writeFileSync(targetPath, markdown)
    console.log()
  }

  let data = "# Index\n\n"

  data += "\n\n# Packages\n\n"

  Object.keys(packages)
    .sort()
    .forEach((parentDir) => {
      const types = packages[parentDir]
      const packageName = packageNameFromPath(parentDir)

      if (Object.keys(types).length) {
        data += `## ${packageName}\n\n`
        data += `### Types\n\n`

        const rows = Object.keys(types).map((type) => [
          `[${type}](${types[type].path})`,
          types[type].doc.description.split("\n").filter(Boolean)[0],
        ])
        data += `${table([["Name", "Description"], ...rows])}\n`
      }
    })

  data += "# Files\n\n"

  data += `${table([
    ["Name", "Package"],
    ...Object.keys(tree)
      .sort()
      .flatMap((parentDir) => {
        return tree[parentDir].map((entry) => [
          `[${path.basename(entry.source)}](${entry.path})`,
          packageNameFromPath(parentDir),
        ])
      }),
  ])}\n`

  const targetPath = path.join(destPath, "README.md")
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, data)
})(...params)
