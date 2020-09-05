const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks } = require ('../lib/lexer')
const { StartTag, EndTag, Whitespace, Data, Comment } = require ('../lib/tokens')
const { schema, $, coset, CoSet } = require ('./schema')


// Element categories
// ------------------

// Void elements cannot have contents and will never be put on the stack. 
// Formatting elements act like on/off markers and may be misnested. 
// Heading elements may have end tags of another heading level. 
// tableContent elements, are the allowed direct descendents of table, minus script and template

const voids =
  $ ('area base br col embed hr img input link meta param source track wbr'
  + ' basefont bgsound keygen frame' ) // NB added deprecated elements.

const formatting =
  $ ('a b big code em font i nobr s small strike strong tt u')

const headings = 
  $ ('h1 h2 h3 h4 h5 h6')

const ditems =
  $ ('dd dt')

const tableContent = 
  $ ('caption colgroup tbody tfooot thead')

const tableCells = 
  $ ('th td')


// Scope boundaries
// ----------------

const _default      = 'html template table caption td th applet marquee object' + ' select option optgroup'
const defaultScope  = $ (_default)
const tableScope    = $ ('html template table') // NB I've not added select. Select in table can be closed by table els
const listScope     = $ (_default + 'ul ol')
const buttonScope   = $ (_default + ' button')
const selectScope   = coset ('optgroup option')
const documentScope = new Set ()
const currentNode   = new CoSet ()

// The scope boundary for li, dd and dt elements that are closed via opening a new one. 
// These are the 'special' elements minus 'address' 'div' 'p', minus the voids
// and minus rawtext, rcdata and plaintext elements. 

const specialItemScope = 
  $ (`html head frameset body template table caption colgroup tbody tfoot thead tr td th
    applet marquee object article aside blockquote button center dl dd dt
    fieldset figure figcaption header footer form hgroup h1 h2 h3 h4 h5 h6
    listing main menu nav noscript ul ol li pre section select summary details`)


// Handling of End Tags
// --------------------

// End tags close the first element on the stack that go by the same name,
// however, within bounds. The bounds depends on the tag name. If there is 
// no element on the stack within these bounds then the tag is ignored. 

// There are a small number of end tags that are handled higher up, 
// br p h1 h2 h3 h4 h5 h6 html head body. 

const endTagScopes = {
  table: tableScope,
  caption: tableScope,
  colgroup: tableScope,
  tbody: tableScope,
  tfoot: tableScope,
  thead: tableScope,
  tr: tableScope,
  td: tableScope,
  th: tableScope,
  select: selectScope,
  optgroup: selectScope,
  option: selectScope,
  template: documentScope,
  noscript: currentNode,
  frameset: currentNode,
  li: listScope,
  p: buttonScope,
}


// Handling of Start Tags
// ----------------------

// By default, before any new element is inserted, the stack will be
// serached once, or more times, for a specific element in a specific 
// scope to close - to prepare the context. 

const startTagCloses = {
  dd       : [ ditems,  specialItemScope, 'p', buttonScope],
  dt       : [ ditems,  specialItemScope, 'p', buttonScope],
  li       : ['li',     specialItemScope, 'p', buttonScope],
  button   : ['button', defaultScope],
  input    : ['select', selectScope],
  keygen   : ['select', selectScope],
  textarea : ['select', selectScope],
}

// The following open tags will close a p in buttonScope before being opened, i.e.
// their 'startTagCloses' would be ['p', buttonScope]

const pClosers = 
  $ (`address article aside blockquote center details dialog dir div dl fieldset
    figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr listing
    main menu nav ol p plaintext pre section summary table ul xmp`)

// At the moment the behaviour of other open tags is encoded in via de
// beforeOpen method in the TreeBuilder class below. 


// The 'DOM'
// ---------

class Document extends Array {
  constructor () {
    super ()
    this.name = '<#document>'
  }
}

class Node extends Array {
  constructor (tag) {
    super ()
    this.name = tag.name
    this.attributes = tag//new Map ([...tag])
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class Leaf {
  constructor (tag) {
    this.name = tag.name
    this.attributes = tag//new Map ([...tag])
    this.selfClosing = tag.selfClosing
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class Mark {
  constructor (tag) {
    this.name = tag.name
    this.attributes = tag//new Map ([...tag])
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

  assign (this, { start:restart, restart, write, writeev /*end*/ })
  define (this, {
    document: { get: $=> document },
    info: { get: $=> `=> (${afterHead || (hasHead ? 'inHead' : '')}) ${stack.map (_ => _.name). reverse () .join (' ')}` },
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
    writeev ([tag])
  }

  function writeev (tags) {
    for (let tag of tags) {
    if (tag instanceof StartTag) {
      const closes = closeForStartTag (tag)
      if (prepareForInsert (tag))
        insert (tag)
    }

    else if (tag instanceof Whitespace) // TODO ignore in beforeHead modes?
      stack[0].push (String (tag))

    else if (tag instanceof Data) {
      if (prepareForInsert (tag)) stack[0].push (String (tag))
    }

    else if (tag instanceof EndTag)
      endTag (tag)

    else if (tag instanceof Comment)
      stack[0].push (tag)
    }
    return self
  }


  function prepareForInsert (tag) { // tag must be a StartTag or Data
    while (!(mode.allowed||{}) .has (tag.name)) {
      if ('paths' in mode) {
        const ins = mode.paths[tag.name] || mode.paths['<default>']
        if (ins) insert (new StartTag (ins))
      }
      else if (mode.default === 'close')
        closeInScope (stack[0].name)
      else {
        if (mode.default === 'ignore') return false
        const notAllowed = `TreeBuilder error:\n\t<${tag.name}> is not allowed in context ${self.info}`
        throw new Error (notAllowed)
      }
    }
    return true
  }


  // endTag handler
  
  function endTag (tag) {
    const { name } = tag
    //log (self.info, `:: </${tag.name}>`)

    if (formatting.has (name)) { // Stored as On/Off marks in tree order
      stack[0].push (new UnMark (tag))
      return // REVIEW what to do with formatting end tags
    }

    if (name === 'br' || name === 'p' && stack.findInScope ('p', buttonScope) < 0) {
      const tag_ = new StartTag (name)
      const closes = closeForStartTag (tag_)
      if (prepareForInsert (tag_)) stack.append (tag_) // NB not opened
      return
    }

    // body, html should set flags to redirect comments only to other places. 
    if (!afterHead && (name === 'head' || name === 'body' || name === 'html')) {
      const ins = new StartTag (name)
      prepareForInsert (ins) && (insert (ins))
      if (name === 'head') closeInScope (name, defaultScope)
      return
    }

    if (name in headings)
      return closeInScope (headings, defaultScope)

    if (name in endTagScopes)
      return closeInScope (name, endTagScopes [name])

    // TODO 'any other end tag' in body, should close all elements in something that looks
    // a lot like the specialItemScope though this default is correct for many cases
    closeInScope (name, defaultScope)
  }


  // Stack management
  // ----------------

  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function insert (tag) {
    const node = stack.append (tag)
    const { name } = node
    if (node instanceof Node) {
      stack.unshift (node)
      hasHead = hasHead || name === 'head'
      afterHead = afterHead || (hasHead && name !== 'head' ? '<afterHead>' : '')
      mode = schema [name === 'html' ? 'html' + afterHead : name] || schema ['<default>']
    }
    return node
  }

  // closeForStartTag - closes some amount of elements to
  // prepare the context for inserting a new element. 

  const _tablishScope = coset ('table template html head body')
  const _trScope = coset ('tbody tfoot thead table template html head body')
  const _tableCellScope = coset ('tr thead tbody tfoot table template html head body')

  function closeForStartTag ({ name }) { 

    if (name in startTagCloses)
      return closeInScope (...startTagCloses [name])

    if (name in headings)
      return closeInScope ('p', buttonScope, headings, documentScope) // REVIEW

    if (name === 'option')
      return closeInScope ('option', selectScope)

    if (name === 'optgroup') {
      if (stack.findInScope ('select', selectScope) >= 0) // cannot be nested in select
        return closeInScope ('option',  selectScope, 'optgroup', selectScope)
      else
        return closeInScope ('option', selectScope)
    }

    if (tableContent .has (name))
      return closeAll (_tablishScope)

    if (name === 'tr')
      return closeAll (_trScope)

    if (tableCells .has (name)) 
      return closeAll (_tableCellScope)

    // TODO other tags ??
    if (name in pClosers)
      return closeInScope ('p', buttonScope)       

    return self
  }

  function closeInScope (...args) {
    let start = 0
    for (let i=0, l=args.length; i<l; i+=2) {
      const [names, bounds] = [args[i], args[i+1] || documentScope]
      const ix = stack.findInScope (names, bounds, start)
      if (ix < 0) continue
      else start = ix + 1 
    }
    const closes = stack.slice (0, start)
    stack = stack.slice (start)

    const head = stack[0]
    afterHead = afterHead || (hasHead && head.name !== 'head' ? '<afterHead>' : '')
    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    return closes
  }

  function closeAll (names) {
    let closes = [], r
    for (let i=0, l=stack.length-2; i<l && names.has (stack[i].name); i++)
      closes.push (stack.shift ())

    const head = stack[0]
    afterHead = afterHead || (hasHead && head.name !== 'head' ? '<afterHead>' : '')
    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    return closes
  }

}

class Stack extends Array {

  findInScope (names, bounds, start = 0) {
    let index = -1
    for (let i =start, l = this.length; i<l; i++) {
      const item = this[i].name
      if (typeof names === 'string' ? item === names : names.has (item)) { index = i; break }
      if (bounds.has (item)) break
    }
    return index
  }

  append (tag) { // Adds a childNode to the current node
    const { name } = tag
    let node = voids.has (name) ? new Leaf (tag)
      : formatting.has (name) ? (tag instanceof EndTag ? new UnMark (tag) : new Mark (tag))
      : new Node (tag)
    this[0].push (node)
    return node
  }

}

module.exports = { TreeBuilder }