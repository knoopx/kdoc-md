const parse = require("comment-parser")
const PARSERS = require("comment-parser/parsers")
const table = require("gfm-table")

function skipws(str) {
  let i = 0
  do {
    if (str[i] !== " " && str[i] !== "\t") {
      return i
    }
  } while (++i < str.length)
  return i
}

function parse_name(str, data) {
  if (data.errors && data.errors.length) {
    return null
  }

  let pos = skipws(str)
  let name = ""
  let brackets = 0
  let res = { optional: false }

  // if it starts with quoted group assume it is a literal
  const quotedGroups = str.slice(pos).split('"')
  if (
    quotedGroups.length > 1 &&
    quotedGroups[0] === "" &&
    quotedGroups.length % 2 === 1
  ) {
    name = quotedGroups[1]
    pos += name.length + 2
    // assume name is non-space string or anything wrapped into brackets
  } else {
    while (pos < str.length) {
      brackets += str[pos].match(/[([{<]/)
        ? 1
        : str[pos].match(/[)\]}>]/)
        ? -1
        : 0
      name += str[pos]
      pos++
      if (brackets === 0 && /\s/.test(str[pos])) {
        break
      }
    }

    if (brackets !== 0) {
      throw new SyntaxError("Invalid `name`, unpaired brackets")
    }

    res = { name, optional: false }

    if (name[0] === "[" && name[name.length - 1] === "]") {
      res.optional = true
      name = name.slice(1, -1)

      const match = name.match(/^\s*([^=]+?)(?:\s*=\s*(.*?))?\s*(?=$)/)

      if (!match) throw new SyntaxError("Invalid `name`, bad syntax")

      name = match[1]
      if (match[2]) res.default = match[2]
      // We will throw this later after processing other tags (so we
      //  will collect enough data for the user to be able to fully recover)
      else if (match[2] === "") {
        res.default = match[2]
        res.warning = "Empty `name`, bad syntax"
      }
    }
  }

  res.name = name

  return {
    source: str.slice(0, pos),
    data: res,
  }
}

function parseTags(block) {
  return block.replace(/\{@[^\s]+\s+([^}]+)\}/g, "`$1`")
}

function parseDecl(data, content) {
  const lines = content.split("\n")
  let end = -1

  for (let i = data.line; i < lines.length - 1; i++) {
    if (lines[i].match(/\s*\*\//)) {
      end = i + 1
      break
    }
  }
  if (end > 0) {
    return lines[end].trim()
  }
  return ""
}

function parseSignature(decl) {
  const matches = decl.trim().match(/^[^(]+/)
  if (matches) {
    return Array.from(
      matches[0].matchAll(/(<[^>]*>|[A-Za-z0-9.@]+(<[^>]*>)?)+/g),
    ).map((x) => x[0].trim())
  }
  return []
}

function parseDocBlocks(content) {
  return parse(content, {
    parsers: [
      PARSERS.parse_tag,
      PARSERS.parse_type,
      parse_name,
      PARSERS.parse_description,
    ],
  }).map((data) => {
    const decl = parseDecl(data, content)
    const type = parseSignature(decl)

    data.decl = decl
    data.type = type
    data.name = data.type.pop()

    if (data.name === "constructor") {
      data.name = data.type.pop()
    }

    while (data.name && data.name[0] === "@") {
      data.name = data.type.pop()
    }

    return data
  })
}

function generateMarkdown(data) {
  let markdown = ""

  data.forEach((match) => {
    if (match.type.includes("class")) markdown += "## "
    else markdown += "### "

    markdown += `${
      match.name +
      (match.type.length > 0 ? ` \`${match.type.join("` `")}\`` : "")
    }\n\n`
    markdown += `${parseTags(match.description)}\n\n`

    if (match.tags.length) {
      markdown += `${table([
        ["Type", "Name", "Description"],
        ...match.tags.map((tag) => [
          tag.tag,
          `\`${tag.name}\``,
          parseTags(tag.description),
        ]),
      ])}\n`
    }

    markdown += "\n"
  })

  return markdown
}

module.exports = {
  generateMarkdown,
  parseDocBlocks,
}
