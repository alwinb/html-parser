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

// At the moment, 'schema' can also declare a set of end tags to be ignored. 
// But I think that can be expressed using scopes instead and I want to remove that. 

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
// 

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


// The parser
// ----------

function Parser () {

  const self = this
  const document = new Document ()
  // let state = 0 // initial
  let stack = new Stack (document)
  let head = document
  let mode = schema ['mode' in head ? head.mode : head.name] || schema ['<default>']
  let hasHead = false
  let afterHead = ''

  assign (this, { startTag, endTag, comment, space, data, write })
  define (this, {
    document: { value: document, writable: false },
    info: { get: $=> `=> ${stack.map (_ => _.name). reverse () .join (' ')}` },
  })


  // Main loop
  // This just calls the 'delegate' methods for each token. 

  function write (tag) {
    if (tag instanceof StartTag)
      return startTag (tag)

    if (tag instanceof EndTag)
      return endTag (tag)

    if (tag instanceof Data)
      return data (tag)

    if (tag instanceof Comment)
      return comment (tag)

    if (tag instanceof Whitespace)
      return space (String (tag))

  }
  
  // The 'delegate' methods for each token. 

  function comment (tag) {
    head.push (tag)
    return this
  }

  function space (tag) {
    if (mode.ignoreSpace !== true)
      head.push (tag)
    return this
  }
  
  function data (tag) {
    if (!('allowed' in mode) || mode.allowed.has ('<data>'))
      head.push (String (tag))
    else {
      force (tag)
      head.push (String (tag))
    }
  }

  // startTag handler

  function startTag (tag) {
    const { name } = tag
    log (self.info, `:: <${tag.name}>:${mode.name}`)

    // const ign = mode.ignoreStart
    // if (ign && ign.has (name)) return self

    // TODO do the formatting in some other way.
    // Maybe just add them as void tags and handle them in tree order.
    if (formatting.has (name))
      return self 

    const closes = closeForStartTag (name)
    log ('closeForStartTag', closes.map (_ => `</${_.name}>`))

    if (!('allowed' in mode) || mode.allowed.has (name)) {
      open (tag)
      log (self.info)
    }
    else {
      force (tag)
      open (tag)
    }
    
    return self
  }

  // endTag handler
  
  function endTag (tag) {
    const { name } = tag
    log (self.info, `:: </${tag.name}>:${mode.name}`)

    // body, html should set flags to
    // redirect comments only to other places. 

    if (name === 'html') return self
    if (name === 'body') return self
    if (name === 'head' && hasHead)
      afterHead = '<afterHead>' // NB falls through

    // TODO do the formatting in some other way.
    // Maybe just add them as void tags and handle them in tree order.
    if (formatting.has (name))
      return self 

    if (name === 'br')
      return startTag (new StartTag ('br'))

    if (name === 'p' && findIndex ('p', buttonScope) < 0)
      startTag (new StartTag ('p')) // NB fallthrough

    const closes = closeForEndTag (name)
    log ('closeForEndTag', closes.map (_ => `</${_.name}>`))

    if (!closes.length)
      log (' ignoring', `</${name}>`)

    return self
  }
 
  // Private implementation of endTag.

  function closeForEndTag (name) {

    // if (name === 'head')
    //   return [] // TODO

    if (name === 'form')
      return [] // TODO

    if (name in headings)
      return closeInScope (headings, defaultScope)

    if (name in endTagScopes)
      return closeInScope (name, endTagScopes [name])

    // TODO 'any other end tag' in body, should close all elements in something that looks
    // a lot like the specialItemScope though this default is correct for many cases
    return closeInScope (name, defaultScope)
  }


  function force (tag) {
    let allowed
    do {
      log ('force', self.info)
      if (stack.length === 1) {
        open (new StartTag ('html'))
      }
      else if (!hasHead) {
        open (new StartTag ('head'))
        hasHead = true
      }
      else if (head.name === 'head') {
        //ins = new EndTag ('head')
        stack.shift ()
        head = stack[0]
        mode = schema ['html<afterHead>']
      }
      else if (head.name === 'html') {
        open (new StartTag ('body'))
      }
      else if (tag instanceof StartTag && ('paths' in mode) && (tag.name in mode.paths)) {
        open (new StartTag (mode.paths[tag.name]))
      }
      else if (('paths' in mode) && ('<default>' in mode.paths)) {
        open (new StartTag (mode.paths['<default>']))
      }
      else break
      allowed = !('allowed' in mode) || mode.allowed.has (tag instanceof StartTag ? tag.name : '<data>')
    } while (!allowed)

    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    // log ('uuuh', self.info, allowed)
    if (!allowed) {
      // log ('ignoring', `<${name}>`)
      // TODO in some cases this should _insert_ a path to prepare the context
      const notAllowed = `Parser error:\n\t<${tag.name}> is not allowed in context ${self.info}`
      throw new Error (notAllowed)
    }

  }


  // Stack management
  // ----------------

  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag) {
    const { name } = tag
    let node
    if (voids.has (name)) {
      node = new Leaf (tag)
      head.push (node)
    }
    else {
      node = new Node (tag)
      head.push (node)
      stack.unshift (node)
      head = stack[0]
      mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    }
    return node
  }

  // CloseForOpenTag: Closes some amount of elements to
  // prepare the context for inserting a new element. 

  function closeForStartTag (name, atts) { 

    if (name in startTagCloses)
      return closeInScope (...startTagCloses [name])

    if (name in headings)
      return closeInScope ('p', buttonScope, headings, documentScope) // REVIEW

    if (name === 'optgroup' || name === 'option') {
      // So in body, <optgroup> does not close <optgroup>? but in select, it does. 
      if (findIndex ('select', selectScope) < 0)
        return closeInScope ('option', currentNode) // no bounds??
      else return closeInScope ('option',  selectScope)
        .concat (name === 'optgroup' ? closeInScope ('optgroup', selectScope) : [])
    }

    if ($('caption colgroup tbody tfooot thead') .has (name))
      return closeAll (coset ('table template html head body'))
      // TODO now this also requires a sequence of open tags

    if (name === 'tr')
      return closeAll (coset ('tbody tfoot thead table template html head body'))
      // TODO now this also requires a sequence of open tags

    //log ('close for open')
    if ($('td th') .has (name)) 
      return closeAll (coset ('tr thead tbody tfoot table template html head body'))
      // TODO now this also requires a sequence of open tags

    // TODO other tags ??
    if (name in pClosers)
      return closeInScope ('p', buttonScope)       

    return []
  }

  function openForOpen (name) {
    // TODO so after a context has been cleared, we must now
    // insert elements to further prepare the context
    // So, how to specify that?
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
    head = stack[0]
    mode = schema [head.name === 'html' ? 'html'+afterHead : head.name] || schema ['<default>']
    return closes
  }

  function closeAll (names) {
    let closes = [], r
    for (let i=0, l=stack.length-2; i<l && names.has (stack[i].name); i++)
      closes.push (stack.shift ())
    head = stack[0]
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