const { tokenTypes:T } = require ('./lexer')
const { defaultInfo, info:elementInfo }  = require ('./schema.js')

// The 'DOM'
// ---------

class Document {
  constructor () {
    Object.defineProperties (this, {
      name: { value:'<#document>' },
      head: { value:null, writable:true },
      body: { value:null, writable:true },
    })
    this.children = []
  }
  push (x) {
    this.children[this.children.length] = x
  }
}

class Leaf {
  constructor (tag) {
    const flags = tag.name in elementInfo ? elementInfo [tag.name] : defaultInfo
    Object.defineProperties (this, {
      name: { value:tag.name, enumerable:true },
      info: { value:flags },
    })
    if (tag.attributes) this.attributes = tag.attributes
    if (tag.selfClosing) this.selfClosing = tag.selfClosing
  }
}

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

module.exports = {
  Document, Leaf, Node,
}