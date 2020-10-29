#!/usr/bin/env node

const util = require("util")
const fs = require("fs")
const path = require("path")
const glob = require("fast-glob");
const { argv } = require("process");

const TAGS = {
    "author": ["Name"],
    "version": ["Current Version"],
    "param": ["Parameter Name", "Description"],
    "property": ["Property Name", "Description"],
    "return": ["Returned Value", "Description"],
    "exception": ["Exception", "Description"],
    "throws": ["Exception", "Description"],
    "see": ["Reference"],
    "link": ["Reference"],
    "since": ["Version"],
    "deprecated": ["Deprecation"]
}

const indent = (text, w, char = " ") => {
    return text.split("\n").map(line => char.repeat(w) + line).join("\n")
}

function parseTags(block) {
    return block.replace(/\{@[^\s]+\s+([^}]+)\}/g, "_$1_")
}

function splitTail(string, regex, max) {
    parts = []

    current = string
    while (parts.length < max - 1) {
        const index = current.search(regex) // ?
        if (index === -1) {
            break
        }
        parts.push(current.substring(0, index));
        current = current.substring(index + 1);
    }

    parts.push(current)

    return parts
}


function parseFile(file) {
    let docs = [];

    let content = fs.readFileSync(file, "utf8");

    let reg = /(?<=\s\/\*\*\s)([\s\S]*?)(?=\s\*\/\s)/g;
    let match;
    while ((match = reg.exec(content)) !== null) {
        let matchText = match[0];
        let startIndex = match.index + match[0].length;
        startIndex += content.substring(startIndex).indexOf("\n") + 1;
        let endIndex = content.substring(startIndex).indexOf("\n")
        if (endIndex == -1) {
            endIndex = content.length - startIndex
        }
        let declaration = content.substring(startIndex, startIndex + endIndex);
        let type = [];

        while (declaration.trim().startsWith("@")) {
            type = type.concat("@" + (/([A-Z0-9a-z]*)/g).exec(declaration.trim().substring(1))[1]);
            startIndex += declaration.length + 1;
            declaration = content.substring(startIndex, startIndex + content.substring(startIndex).indexOf("\n"));
        }

        const signature = declaration.trim().match(/^[^\(]+/)[0] || ""
        const matches = Array.from(signature.matchAll(/(\<[^\>]*\>|[A-Za-z0-9\.\@]+(\<[^\>]*\>)?)+/g)).map(x => x[0].trim())
        type = type.concat(matches);

        let doc = {
            name: type.pop(),
            description: "",
            type,
            ...Object.keys(TAGS).reduce((rest, tag) => ({
                ...rest,
                [tag]: []
            }), {})
        };

        lines = matchText.split("\n")
            .map(l => l.replace(/\s*\*\s*/g, ""))
            .map(line => {
                if (line.startsWith("@")) {
                    const [tag, rest] = splitTail(line.substring(1), /\s/, 2)
                    const parts = splitTail(rest, /\s/, TAGS[tag].length)
                    doc[tag].push(parts);
                } else {
                    return parseTags(line)
                }
            })
            .filter(Boolean)

        doc.description = lines.join("\n").trim()
        docs.push(doc);
    }

    return docs;
}

function generateMarkdown(data) {
    let markdown = "";

    for (let i in data) {
        if (data[i].type.includes("class"))
            markdown += "## ";
        else markdown += "### ";

        markdown += data[i].name + (data[i].type.length > 0 ? " `" + data[i].type.join("` `") + "`" : "") + "\n\n";
        markdown += data[i].description + "\n";

        for (let tag in TAGS) {
            if (data[i][tag] && data[i][tag].length > 0) {
                if (TAGS[tag].length > 1) {
                    markdown += "\n| " + TAGS[tag].join(" | ") + " |\n";
                    markdown += "|" + "-----|".repeat(TAGS[tag].length) + "\n";
                    for (let item in data[i][tag]) {
                        markdown += "| " + data[i][tag][item].map(x => x.trim()).join(" | ") + " |\n";
                    }
                } else {
                    markdown += "\n**" + TAGS[tag][0] + ":** ";
                    markdown += data[i][tag][item][0] + "\n\n";
                }

            }
            markdown += "\n";
        }
    }

    return markdown.replace(/[\n]{2,}/g, "\n\n");
}

const [, , ...params] = argv;

(async (sourcePath, destPath) => {
    const tree = {}
    const globExpr = path.join(sourcePath, '**/*.kt')
    console.log(`Searching ${globExpr}...`)
    const stream = glob.stream([globExpr]);

    for await (const entry of stream) {
        console.log(`Processing ${entry}`)
        const data = parseFile(entry)

        if (data.length === 0) {
            console.log("  no doc blocks found.")
            continue;
        }

        data.forEach(doc => {
            const leading = doc.type.includes("class") ? "  " : "    "
            console.log(`${leading}${doc.type.map(util.inspect).join(" ")} ${doc.name}`)
            Object.keys(TAGS).forEach(tag => {
                if (doc[tag].length) {
                    doc[tag].forEach(([name, desc]) => {
                        console.log(`${leading}@${tag} ${util.inspect(name)} ${desc}`)
                    })
                }
            })
            console.log(indent(doc.description, leading.length) + "\n")
        })

        const parentDir = path.dirname(path.resolve(entry).slice(path.resolve(sourcePath).length + 1))
        const basename = path.basename(entry, path.extname(entry)) + ".md"

        if (!tree[parentDir]) tree[parentDir] = []
        tree[parentDir].push({
            doc: path.join(parentDir, basename),
            source: path.join(parentDir, path.basename(entry))
        })

        const targetPath = path.join(destPath, path.join(parentDir, basename))
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        const markdown = `# ${path.join(parentDir, path.basename(entry))}\n\n` + generateMarkdown(data)
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
