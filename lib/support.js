const fs = require("fs")
const Path = require("path")

const table = require("gfm-table")
const ejs = require("ejs")

const helpers = {
  table,
  link(title, href) {
    return `[${title}](${href})`
  },
  code(string) {
    return `\`${string}\``
  },
}

function skipWhiteSpace(str) {
  let i = 0
  do {
    if (str[i] !== " " && str[i] !== "\t") {
      return i
    }
  } while (++i < str.length)
  return i
}
function indent(text, w, char = " ") {
  return text
    .split("\n")
    .map((line) => char.repeat(w) + line)
    .join("\n")
}

function packageNameFromPath(string) {
  return string.replace(new RegExp(Path.sep, "g"), ".")
}

function render(template, locals) {
  return ejs.render(
    fs.readFileSync(template, "utf8"),
    { ...locals, ...helpers },
    { escape: (x) => x },
  )
}

module.exports = { indent, render, packageNameFromPath, skipWhiteSpace }
