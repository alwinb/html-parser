const { tokenTypes:T } = require ('./lexer')
const { defaultInfo, info:elementInfo }  = require ('./schema.js')

class StartTag {
  constructor (name) {
    this[0] = T.StartTag
    this.name = name
    // this.selfClosing = false // may be added later
    // this.attributes may be added later
  }
}

class EndTag {
  constructor (name) {
    this.name = name
    this[0] = T.EndTagStart
    this.selfClosing = false
  }
  toString () {
    return `</${this.name}>`
  }
}

// The 'DOM'
// ---------

const flagsS = Symbol ()

class Document {
  constructor () {
    this.name = '<#document>'
    this[flagsS] = defaultInfo
    this.children = []
  }
  push (x) {
    this.children[this.children.length] = x
  }
}

class Leaf {
  constructor (tag) {
    this.name = tag.name
    this[flagsS] = tag.name in elementInfo ? elementInfo [tag.name] : defaultInfo
    if (tag.attributes) this.attributes = tag.attributes
    if (tag.selfClosing) this.selfClosing = tag.selfClosing
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes||[]].map (a => `${a[0]}=${a[1]}`)] .join (' ')}`
  }
  toString () { return `<${this[Symbol.toStringTag]()}${this.selfClosing ? ' /' : ''}>`}
}

class Mark extends Leaf {}
class UnMark extends Leaf { toString () { return `</${this.name}>`} }

class Node extends Leaf {
  constructor (tag) {
    super (tag)
    this.children = []
  }
  push (x) {
    this.children[this.children.length] = x
  }
}

// Restrictions on comment data:
// must not start with ">", nor start with "->", 
// must not contain "<!--", "-->", or "--!>", 
// must not end with "<!-".

// Comment uses TokenBuilder.Compound

module.exports = {
  Document, Leaf, Mark, UnMark, Node,
  StartTag, EndTag, flagsS
}