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

const voids =
  $ ('area base br col embed hr img input link meta param source track wbr'
  + ' basefont bgsound keygen frame' ) // NB added deprecated elements.

const headings = 
  $ ('h1 h2 h3 h4 h5 h6')

const formatting =
  $ ('a b big code em font i nobr s small strike strong tt u')

const ditems =
  $ ('dd dt')


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
// These are the 'special' elements minus address div p, minus the voids
// and minus rawtext, rcdata and plaintext elements, 

const specialItemScope = 
  $ (`html head frameset body template table caption colgroup tbody tfoot thead tr td th
    applet marquee object article aside blockquote button center dl dd dt
    fieldset figure figcaption header footer form hgroup h1 h2 h3 h4 h5 h6
    listing main menu nav noscript ul ol li pre section select summary details`)


// Handling of End Tags
// --------------------

// The default behaviour:
// Upon encountering an end tag, the stack is searched for an element
// by that name, up to a 'scope boundary', where the scope boundary
// depends on the tag name as specified below. If found, it closes
// that element and its descendents. If no element is found then the
// end tag is ignored. 

// There are a small number of end tags that are handled higher up, 
// form br p h1 h2 h3 h4 h5 h6 body html. 

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
// beforeOpen method in the Parser class below. 


// The 'DOM'
// ---------

class Document extends Array {
  constructor () {
    super ()
    define (this, { name: { value: '<#document>' }})
  }
}

class Node extends Array {
  constructor (tag) {
    super ()
    define (this, { 
      name: { value: tag.name },
      attributes: { value: new Map ([...tag]) } })
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class Leaf {
  constructor (tag) {
    define (this, { 
      name: { value: tag.name },
      attributes: { value: new Map ([...tag]) },
      selfClosing: { value: tag.selfClosing }
    })
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class Mark {
  constructor (tag) {
    define (this, { 
      name: { value: tag.name },
      attributes: { value: new Map ([...tag]) },
    })
  }
  get [Symbol.toStringTag] () {
    return `${[this.name, ...[...this.attributes].map (a => `${a[0]}=${a[1]}`)].join (' ')}`
  }
}

class UnMark {
  constructor ({ name }) {
    define (this, { name: { value: name } })
  }
  get [Symbol.toStringTag] () { return this.name }
}


// The parser
// ----------

function Parser () {

  const self = this
  const document = new Document ()
  let stack = new Stack (document)

  let mode = schema ['<#document>']
  let hasHead = false
  let afterHead = ''

  assign (this, { endTag, write })
  define (this, {
    document: { value: document, writable: false },
    info: { get: $=> `=> (${afterHead || (hasHead ? 'inHead' : '')}) ${stack.map (_ => _.name). reverse () .join (' ')}` },
  })


  // Main loop
  // This just calls the 'delegate' methods for each token. 

  function write (tag) {

    if (tag instanceof StartTag) {
      const closes = closeForStartTag (tag)
      prepareForInsert (tag)
      insert (tag)
    }

    else if (tag instanceof Whitespace) // TODO ignore in beforeHead modes?
      stack[0].push (String (tag))

    else if (tag instanceof Data) {
      prepareForInsert (tag)
      stack[0].push (String (tag))
    }

    else if (tag instanceof EndTag)
      endTag (tag)

    else if (tag instanceof Comment)
      stack[0].push (tag)

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
        if (mode.default === 'ignore')
          return false
        const notAllowed = `Parser error:\n\t<${tag.name}> is not allowed in context ${self.info}`
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
      prepareForInsert (tag_)
      return append (tag_) // NB not opened
    }

    // body, html should set flags to redirect comments only to other places. 
    if (!afterHead && (name === 'head' || name === 'body' || name === 'html')) {
      const ins = new StartTag (name)
      prepareFor (ins) && (insert (ins))
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
    const node = append (tag)
    const { name } = node
    if (node instanceof Node) {
      stack.unshift (node)
      hasHead = hasHead || name === 'head'
      afterHead = afterHead || (hasHead && name !== 'head' ? '<afterHead>' : '')
      mode = schema [name === 'html' ? 'html' + afterHead : name] || schema ['<default>']
    }
    return node
  }

  function append (tag) {
    const { name } = tag
    let node = voids.has (name) ? new Leaf (tag)
      : formatting.has (name) ? (tag instanceof EndTag ? new UnMark (tag) : new Mark (tag))
      : new Node (tag)
    stack[0].push (node)
    return node
  }

  // closeForStartTag - closes some amount of elements to
  // prepare the context for inserting a new element. 

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

    if ($('caption colgroup tbody tfooot thead') .has (name))
      return closeAll (coset ('table template html head body'))

    if (name === 'tr')
      return closeAll (coset ('tbody tfoot thead table template html head body'))

    if ($('td th') .has (name)) 
      return closeAll (coset ('tr thead tbody tfoot table template html head body'))

    // TODO other tags ??
    if (name in pClosers)
      return closeInScope ('p', buttonScope)       

    return self
  }

  function closeInScope (...args) {
    let closes = []
    for (let i=0, l=args.length; i<l; i+=2) {
      const [names, bounds] = [args[i], args[i+1] || documentScope]
      const ix = stack.findInScope (names, bounds)
      if (ix < 0) continue
      closes = closes.concat (stack.slice (0, ix+1))
      stack = stack.slice (ix+1)
    }

    const head = stack[0]
    afterHead = afterHead || (hasHead && head.name !== 'head' ? '<afterHead>' : '')
    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    return closes
  }

  function closeAll (names) {
    let closes = [], r
    for (let i=0, l=this.length-2; i<l && names.has (this[i].name); i++)
      closes.push (this.shift ())

    const head = stack[0]
    afterHead = afterHead || (hasHead && head.name !== 'head' ? '<afterHead>' : '')
    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    return closes
  }

}

class Stack extends Array {

  findInScope (names, bounds) {
    if (!(names instanceof Set))
      names = new Set ([names])
    let index = -1
    for (let i=0, l=this.length; i<l; i++) {
      const item = this[i].name
      if (names.has (item)) { index = i; break }
      if (bounds.has (item)) break
    }
    return index
  }

}

module.exports = { Parser }