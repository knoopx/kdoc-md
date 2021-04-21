/* eslint-disable no-plusplus */
const parse = require("comment-parser")
const PARSERS = require("comment-parser/parsers")

const { skipWhiteSpace } = require("./support")

function parseName(str, data) {
  if (data.errors && data.errors.length) {
    return null
  }

  let pos = skipWhiteSpace(str)
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

      const [_name, isDefault] = match

      name = _name
      if (isDefault) res.default = isDefault
      else if (isDefault === "") {
        res.default = isDefault
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

function parseInlineTags(block) {
  return block.replace(/\{@[^\s]+\s+([^}]+)\}/g, "`$1`")
}

function parseDecl(data, content) {
  let end = -1
  const lines = content.split("\n")

  for (let i = data.line; i < lines.length - 1; i++) {
    if (lines[i].match(/\s*\*\//)) {
      end = i + 1
      break
    }
  }

  if (end > 0) {
    let line = lines[end].trim()
    while (line[0] === "@") {
      line = lines[end++].trim()
    }
    return line
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
      parseName,
      PARSERS.parse_description,
    ],
  }).map((data) => {
    const decl = parseDecl(data, content)
    const type = parseSignature(decl)

    data.decl = decl
    data.type = type
    data.name = data.type.pop()
    data.description = parseInlineTags(data.description)

    data.tags.forEach((tag) => {
      tag.description = parseInlineTags(tag.description)
    })

    if (data.name === "constructor") {
      data.name = data.type.pop()
    }

    while (data.name && data.name[0] === "@") {
      data.name = data.type.pop()
    }

    return data
  })
}

module.exports = {
  parseDocBlocks,
}
