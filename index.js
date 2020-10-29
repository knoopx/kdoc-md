#!/usr/bin/env node

const util = require("util")
const fs = require("fs")
const path = require("path")
const glob = require("fast-glob");
const { argv } = require("process");

const TAGS = {
    author: ["Name"],
    version: ["Current Version"],
    param: ["Parameter Name", "Description"],
    "return": ["Returned Value"],
    exception: ["Exception", "Description"],
    throws: ["Exception", "Description"],
    see: ["Reference"],
    link: ["Reference"],
    since: ["Version"],
    deprecated: ["Deprecation"]
}

function parsePhrase(phrase) {
    let tag = phrase.shift();
    if ((tag == "see" || tag == "link") && phrase.length == 2) {
        let strings = phrase.shift().split("#");
        return "[" + phrase.join(" ") + "](" + "#" + strings[1] + ")";
    } else {
        phrase.shift();
        return phrase.join(" ");
    }
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
        const matches = Array.from(signature.matchAll(/(([A-Za-z0-9\.\@](\<[^\>]+\>)?)+)/g)).map(x => x[0].trim())
        type = type.concat(matches);

        let doc = {
            name: type.pop(),
            description: "",
            type: type,
        };

        let tag = null;
        let lines = matchText.split("\n");
        for (let i in lines) {
            let line = lines[i].replace(/(\s)*(\*)(\s)*/g, "");
            if (line.startsWith("@")) {
                let spaceIndex = line.search(/[ \t]/);
                tag = line.substring(1, spaceIndex);
                line = line.substring(spaceIndex + 1);
                let phrase = null;
                if (TAGS[tag]) {
                    let object = {
                        template: TAGS[tag],
                        values: []
                    };

                    let words = line.split(/[ \t]{1,}/g);
                    for (let word in words) {
                        if (phrase) {
                            if (words[word].endsWith("}")) {
                                phrase.push(words[word].substring(0, words[word].length - 1));
                                object.values[object.values.length - 1] += " " + parsePhrase(phrase);
                                phrase = null;
                            } else {
                                phrase.push(words[word]);
                            }
                        } else if (words[word].startsWith("{")) {
                            phrase = [words[word].substring(1)];
                        } else {
                            if (object.values.length < TAGS[tag].length)
                                object.values.push(words[word]);
                            else object.values[object.values.length - 1] += " " + words[word];
                        }
                    }

                    if (doc[tag])
                        doc[tag].push(object);
                    else doc[tag] = [object];
                } else tag = null;
            } else if (tag) {
                let object = doc[tag][doc[tag].length - 1];
                let words = line.split(/[ \t]{1,}/g);
                for (let word in words) {
                    if (object.values.length < TAGS[tag].length)
                        object.values.push(words[word]);
                    else object.values[object.values.length - 1] += " " + words[word];
                }
            } else {
                if (line.trim().length > 0) {
                    let words = line.trim().split(/[\s]{1,}/g);
                    let phrase = null;
                    for (let word in words) {
                        if (phrase !== null) {
                            if (words[word].includes("}")) {
                                phrase.push(words[word].substring(0, words[word].indexOf("}")));
                                doc.description += parsePhrase(phrase);
                                phrase = null;
                            } else {
                                phrase.push(words[word]);
                            }
                        } else if (words[word].startsWith("{@")) {
                            phrase = [words[word].substring(2)];
                        } else {
                            doc.description += words[word] + " ";
                        }
                    }
                }

                doc.description += "\n";
            }
        }

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
                let isTable = TAGS[tag].length > 1;
                if (isTable) {
                    markdown += "\n| " + TAGS[tag].join(" | ") + " |\n";
                    markdown += "|" + "-----|".repeat(TAGS[tag].length) + "\n";
                } else markdown += "\n**" + TAGS[tag][0] + ":** ";

                for (let item in data[i][tag]) {
                    if (isTable)
                        markdown += "| " + data[i][tag][item].values.map(x => x.trim()).join(" | ") + " |\n";
                    else markdown += data[i][tag][item].values[0] + "\n\n";
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
        // console.log(`  ${data.length} documentation blocks found`)
        if (data.length === 0) {
            console.log("  no doc blocks found.")
            continue;
        } 

        data.forEach(doc => {
            console.log(`  ${doc.type.map(util.inspect).join(" ")} ${doc.name}`)
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
