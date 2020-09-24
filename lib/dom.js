const { tokenTypes:T } = require ('./lexer')
const { defaultInfo, info:elementInfo }  = require ('./schema.js')

class StartTag {
  constructor (name) {
    this[0] = T.StartTag
    this.name = name
    // this.selfClosing = false // may be added later
    // this.attributes may be added later
  }
  toString () {
    return `<${this.name}${this._printAtts()}${this.selfClosing ? '/' : ''}>` // TODO escape attributes
  }
  _printAtts () {
    if (!this.attributes) return ''
    let r = ''
    for (let [k,v] of this.attributes.entries ())
      r += ' ' + (v == null ? k : k + '=' + v)
    return r
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

// Restrictions on comment data:
// must not start with ">", nor start with "->", 
// must not contain "<!--", "-->", or "--!>", 
// must not end with "<!-".

class Comment {
  constructor (data = '') {
    this[0] = T.Comment
    this.data = data
  }
  toString () {
    return `<!--${this.data}-->`
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

module.exports = {
  Document, Leaf, Mark, UnMark, Node,
  StartTag, EndTag, Comment, 
  flagsS
}