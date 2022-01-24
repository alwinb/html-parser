
// The 'DOM'
// ---------

const htmlns =
  'http://www.w3.org/1999/xhtml'

// OK I need to figure out if I want to use the same
// names in the API as in browsers

function Document () {
  Object.defineProperties (this, {
    name: { value:'#document' },
    head: { writable:true },
    body: { writable:true },
  })
  this.children = []
}

// Instead of start tags, produce nodes right away

function Node (name, attrs) {
  this.name = name
  if (attrs) this.attrs = attrs
  this.children = []
}

function MDecl () {
  this.type = 'MDecl'
  this.name
}

function EndTag (name) {
  this.type = 'EndTag'
  this.name = name
}

// REVIEW Shall I use MDecl for Comments?
// Restrictions on comment data:
// must not start with ">", nor start with "->", 
// must not contain "<!--", "-->", or "--!>", 
// must not end with "<!-".


// Exports
// -------

export { htmlns, Document, Node, MDecl, EndTag }