
// The 'DOM'
// ---------

const htmlns =
  'http://www.w3.org/1999/xhtml'

// OK I need to figure out if I want to use the same
// names in the API as browsers do.
// --- I guess that makes sense, though it is less minimalistic,
// and I will NOT do parent and sibling pointers for sure.

const writable = true

function Document () {
  Object.defineProperties (this, {
    head: { writable },
    body: { writable },
    // doctype, documentElement
  })
  this.children = []
}

// Instead of start tags, produce elements right away

function Element (name, attrs) {
  this.name = name
  if (attrs) this.attrs = attrs
  this.children = []
}

function Doctype () {
  this.type = 'Doctype'
  this.data = []
}

function Comment () {
  this.type = 'Comment'
  this.data = []
}

function EndTag (name) {
  this.type = 'EndTag'
  this.name = name
}

// Restrictions on comment data:
// must not start with ">", nor start with "->", 
// must not contain "<!--", "-->", or "--!>", 
// must not end with "<!-".


// Exports
// -------

export { htmlns, Document, Element, EndTag, Doctype, Comment }