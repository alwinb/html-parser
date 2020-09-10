const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks, tokenTypes:T } = require ('../lib/lexer')
const { StartTag, EndTag, Comment } = require ('../lib/tokens')
const { categories:C, boundaries:B, info:elementInfo, scopes, schema, $, coset, CoSet }  = require ('./schema.js')

B.document = 0 // For the time being


// Handling of Start Tags
// ----------------------

// By default, before any new element is inserted, the stack will be
// serached one or more times, for a specific element in a specific 
// scope to close - to prepare the context for insertion. 

const startTagCloses = {
  dd       : [ C.ditem, B.li, 'p', B.pgroup],
  dt       : [ C.ditem, B.li, 'p', B.pgroup],
  li       : ['li',     B.li, 'p', B.pgroup],
  button   : ['button', B.scope ],
  input    : ['select', B.select],
  keygen   : ['select', B.select],
  textarea : ['select', B.select],
}

// The following open tags will close a p in B.pgroup before being opened, i.e.
// their 'startTagCloses' would be ['p', B.pgroup] (a pGroup is a 'paragraph container').

const pClosers = 
  $ (`address article aside blockquote center details dialog dir div dl fieldset
    figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr listing
    main menu nav ol p plaintext pre section summary table ul xmp`)


// At the moment the behaviour of other open tags is encoded via
// beforeOpen method in the TreeBuilder class below. 


// The 'DOM'
// ---------

class Document extends Array {
  constructor () {
    super ()
    this.name = '<#document>'
    this.flags = 0
  }
}

class Node {
  constructor (tag) {
    this.name = tag.name
    this.flags = tag.name in elementInfo ? elementInfo [tag.name] : 0
    if (tag.attributes) this.attributes = tag.attributes
    this.children = []
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes||[]].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
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
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class Mark {
  constructor (tag) {
    this.name = tag.name
    if (tag.attributes) this.attributes = tag.attributes
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class UnMark {
  constructor ({ name }) {
    this.name = name
  }
  get [Symbol.toStringTag] () { return this.name }
}


// The parser
// ----------

function TreeBuilder () {

  const self = this
  let document, stack, mode, hasHead, afterHead
  restart ()

  assign (this, { restart, write, batchWrite /*end*/ })
  define (this, {
    document: { get: $=> document },
    info: { get: $=> `${afterHead || (hasHead ? 'inHead' : '')}:${stack.map (_ => _.name). reverse () .join (' ')}` },
  })


  // Start/ restart

  function restart () {
    document = new Document ()
    stack = new Stack (document)
    mode = schema ['<#document>']
    hasHead = false
    afterHead = ''
  }

  // Main loop
  function write (tag) {
    batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) {
      if (typeof tag === 'string') {
        const closes = closeForTag (tag, elementInfo [tag.name] || 0)
        if (prepareForInsert (tag)) stack[0].push (tag)
      }
      else switch (tag[0]) {
        case T.StartTag:
          const closes = closeForTag (tag, elementInfo [tag.name] || 0)
          if (prepareForInsert (tag)) open (tag);
        break
        case T.EndTag:  endTag (tag); break
        case T.Space:   stack[0].push (tag[1]); break
        case T.Comment: stack[0].push (tag);    break
      }
    }
    return self
  }

  // OK this works, but I'd like to make it nicer, and it needs to change for the
  // table/ foster parenting to work. 
  
  function prepareForInsert (tag) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '<data>' : tag.name
    //log ('prepareFor', self.info, `:: <${name}>`)

    // FIXME select in body allowes more more content/ cannot be expressed in current schema
    if (tag.name === 'select' && closeOrIgnore ('select', B.select))
      return false

    let fail = false
    while (!fail && !(mode.allowed||{}) .has (name)) {
      if ('paths' in mode) {
        const ins = mode.paths[tag.name] || mode.paths['<default>']
        if (ins) open (new StartTag (ins))
        else fail = true
      }
      else if (mode.default === 'close')
        closeOrIgnore (stack[0].name)
      else fail = true
    }
    if (fail) {
      if (mode.default === 'ignore') {
        // log ('prepare: ignoring tag ' + `<${name}>`)
        return false
      }
      const notAllowed = `TreeBuilder error:\n\t<${name}> is not allowed in context ${self.info}`
      throw new Error (notAllowed)
    }
    else return true
  }


  // endTag handler
  
  function endTag (tag) {
    const { name } = tag
    const flags = tag.name in elementInfo ? elementInfo [tag.name] : 0

    //log (self.info, `:: </${tag.name}>`)

    if (flags & C.formatting) // Stored as On/Off marks in tree order
      return stack[0].push (new UnMark (tag))

    // br gets converted to a start tag, and p may insert a start tag if absent.
    if (name === 'br' || name === 'p' && stack.findInScope ('p', B.pgroup) < 0) {
      const tag_ = new StartTag (name)
      const closes = closeForTag (tag_, flags)
      if (prepareForInsert (tag_)) stack.append (tag_) // NB not opened
      return
    }

    // TODO body, html should set flags to redirect comments and space only to other places. 
    if (!afterHead && (name === 'head' || name === 'body' || name === 'html')) {
      const ins = new StartTag (name)
      prepareForInsert (ins) && (open (ins))
      if (name === 'head') closeOrIgnore (name, B.scope)
      return
    }

    if (flags & C.heading)
      return closeOrIgnore (C.heading, B.scope)

    if (name in scopes)
      return closeOrIgnore (name, scopes[name])

    closeOrIgnore (name, C.special)
  }


  // Stack management
  // ----------------

  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag, flags = elementInfo[tag.name]||0) {
    const node = stack.append (tag, flags)
    const { name } = node
    if (node instanceof Node) {
      stack.unshift (node)
      hasHead = hasHead || name === 'head'
      afterHead = afterHead || (hasHead && name !== 'head' ? '<afterHead>' : '')
      mode = schema [name === 'html' ? 'html' + afterHead : name] || schema ['<default>']
    }
    return node
  }

  // closeForTag: called before inserting a new element. 

  function closeForTag (tag, flags) { // tag must be a StartTag or data
    const name = typeof tag === 'string' ? '<data>' : tag.name
    // log ('closeForTag', self.info, `:: <${name}>`, flags & C.cell)

    if (name in startTagCloses)
      return closeOrIgnore (...startTagCloses [name])

    if (flags & C.heading)
      return closeOrIgnore ('p', B.pgroup, B.heading, B.document)

    // Select // TODO <select> gets treated as an end tag eh?
    if (name === 'option')
      return closeOrIgnore ('option', B.select)

    if (name === 'optgroup') {
      // log ('closeForTag', tag.name, stack.findInScope ('select', B.select))
      if (stack.findInScope ('select', B.select) >= 0) // cannot be nested in select
        return closeOrIgnore ('option',  B.select, 'optgroup', B.select)
      else
        return closeOrIgnore ('option', B.select)
    }

    // Tables
    if (flags & C.tcontent || name === 'col')
      return closeOrIgnore (C.caption | C.tbody, B.tcontent)

    if (flags & C.row)
      return closeOrIgnore (C.row | C.tcontent &~ C.tbody, B.row)

    if (flags & C.cell)
      return closeOrIgnore (C.cell | C.tcontent &~ C.tbody, B.cell)

    // TODO other tags ?? (frames?)
    // TODO add the the default inBody rule (?)
    if (name in pClosers)
      return closeOrIgnore ('p', B.pgroup)       

    return self
  }

  // ...args may be a sequence [names, scope, names2, scope2, ..]
  // returns an array with the nodes that were closed

  function closeOrIgnore (...args) {
    let start = 0
    for (let i=0, l=args.length; i<l; i+=2) {
      const [search, bounds] = [args[i], args[i+1] || B.doument]
      const ix = stack.findInScope (search, bounds, start)
      if (ix < 0) continue
      else start = ix + 1 
    }
    const closes = stack.splice (0, start)
    const head = stack[0]
    afterHead = afterHead || (hasHead && head.name !== 'head' ? '<afterHead>' : '')
    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    return closes
  }

}

class Stack extends Array {

  findInScope (search, bounds, start = 0) {
    let index = -1
    for (let i =start, l = this.length; i<l; i++) {
      const item = this[i]
      if (typeof search === 'string' ? item.name === search : item.flags & search) { index = i; break }
      if (bounds & item.flags) break
    }
    return index
  }

  append (tag, flags = elementInfo[tag.name]||0) { // Adds a childNode to the current node
    const { name } = tag
    let node = flags & C.format ? (tag instanceof EndTag ? new UnMark (tag) : new Mark (tag))
      : flags & C.void ? new Leaf (tag)
      : new Node (tag)
    this[0].push (node)
    //log ({append:'', tag, node})
    return node
  }

}

module.exports = { TreeBuilder }