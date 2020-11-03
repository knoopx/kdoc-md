#!/usr/bin/env node

const util = require("util")
const fs = require("fs")
const path = require("path")
const glob = require("fast-glob");
const { argv } = require("process");
const { generateMarkdown, parseDocBlocks } = require("./lib/support")

const indent = (text, w, char = " ") => {
    return text.split("\n").map(line => char.repeat(w) + line).join("\n")
}

const [, , ...params] = argv;

(async (sourcePath, destPath) => {
    const tree = {}
    const globExpr = path.join(sourcePath, '**/*.kt')
    console.log(`Searching ${globExpr}...`)
    const stream = glob.stream([globExpr]);

    for await (const file of stream) {
        console.log(`Processing ${file}`)
        const data = parseDocBlocks(fs.readFileSync(file, "utf8"))

        if (data.length === 0) {
            console.log("  no doc blocks found.")
            continue;
        }

        data.forEach(doc => {
            const leading = doc.type.includes("class") ? "  " : "    "
            console.log(`${leading}${doc.type.map(util.inspect).join(" ")} ${doc.name}`)
            doc.tags.forEach(tag => {
                console.log(`${leading}@${tag.tag} ${util.inspect(tag.name)} ${tag.description}`)
            })
            console.log(indent(doc.description, leading.length) + "\n")
        })

        const parentDir = path.dirname(path.resolve(file).slice(path.resolve(sourcePath).length + 1))
        const basename = path.basename(file, path.extname(file)) + ".md"

        if (!tree[parentDir]) tree[parentDir] = []
        tree[parentDir].push({
            doc: path.join(parentDir, basename),
            source: path.join(parentDir, path.basename(file))
        })

        const targetPath = path.join(destPath, path.join(parentDir, basename))
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        const markdown = `# ${path.join(parentDir, path.basename(file))}\n\n` + generateMarkdown(data)
        fs.writeFileSync(targetPath, markdown)
        console.log()
    }

    let data = "# Files\n\n"

    Object.keys(tree).sort().reverse().forEach((dirname) => {
        tree[dirname].sort().forEach((entry) => {
            data += `* [${entry.source}](${entry.doc})\n`
        })
    })
    const targetPath = path.join(destPath, "README.md")
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, data)
})(...params)
