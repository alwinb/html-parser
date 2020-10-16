const { tokenTypes:T } = require ('./lexer')
const { defaultInfo, info:elementInfo }  = require ('./schema.js')

// The 'DOM'
// ---------

// OK I need to figure out if I want to use the same
// names in the API as in browsers

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
    this.name = tag.name
    if (tag.attributes) this.attributes = tag.attributes
    if (tag.selfClosing) this.selfClosing = tag.selfClosing
  }
}

class Node {
  constructor (tag) {
    this.name = tag.name
    if (tag.attributes) this.attributes = tag.attributes
    this.children = []
    if (tag.selfClosing) this.selfClosing = tag.selfClosing
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