const log = console.log.bind (console)

class CoSet extends Set { has (x) { return !super.has (x) } }
const coset = str => new CoSet (str.split (/\s+/))
const $ = str => new Set (str.split (/\s+/))

const { chunks } = require ('../lib/lexer')
const { StartTag, EndTag, Whitespace, Comment } = require ('../lib/tokens')


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

// At the moment, 'modes' can also declare a set of end tags to be ignored. 
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


// Modes
// -----

// Modes/ rather this is an encoding of a schema,
// In fact, one that eventually should specify how to behave in all cases. 

const modes = {

  '<#document>': {
    dataAllowed: false,
    allowed: $ ('html'),
    ignoreEnd: coset ('html head body br'),
    unblock: () => new StartTag ('html'),
  },

  html: {
    dataAllowed: false,
    allowed: $ ('head'),
    ignoreEnd: coset ('html head body br'),
    unblock: () => new StartTag ('head'),
  },

  head: {
    dataAllowed: false,
    allowed: $ ('base basefont bgsound link meta title noscript noframes style script template'),
    ignoreEnd: coset ('html head body br'),
    unblock: () => new EndTag ('head'),
    next: 'html<afterHead>'
  },

  'html<afterHead>': {
    dataAllowed: false,
    allowed: $ ('body frameset base basefont bgsound link meta title noscript noframes style script template'),
    ignoreStart: $ ('head'),
    ignoreEnd: coset ('html body br'),
    unblock: () => new StartTag ('body'),
    // TODO allowedInHead elements should be added to the head
  },

  // caption, th, td
  // body/ default
  '<default>': {
    ignoreStart: $ ('head frame caption colgroup col thead tbody tfoot tr td th'),
    allowed: coset ('head frame caption colgroup col thead tbody tfoot tr td th'),
  },

  template: { }, // May need special handling of framesets though

  select: { 
    ignoreStart: coset ('option optgroup script template'), // input keygen textarea select (should autoclose a select)
    allowed: $ ('option optgroup script template'),
    ignoreNull: true, // TODO implement
  },

  optgroup: {
    allowed: $ ('option script template'),
    ignoreNull: true,
  },

  option: {
    allowed: $ ('script template'),
    ignoreNull: true,
  },

  table: {
    allowed: $ ('caption colgroup tbody tfoot thead script template'), // add input[type=hidden]; all else will be relegated to the body
    unblock: () => new StartTag ('tbody'), // TODO or colgroup if trying to inert a col?
  },
  
  colgroup: {
    allowed: $ ('col template'),
  },

  thead: {
    allowed: $ ('tr script template'),
    unblock: () => new StartTag ('tr'),
  },

  tbody: {
    allowed: $ ('tr script template'),
    unblock: () => new StartTag ('tr'),
  },

  tfoot: {
    allowed: $ ('tr script template'),
    unblock: () => new StartTag ('tr'),
  },
  
  tr: {
    allowed: $ ('th td script template'),
    unblock: () => new StartTag ('td'), // TODO td or th depends on context?
  },

}

// OK so I think I'll try and do a dfs then, to find a path

function findPath (mode, name) {
  // So this'd be called if name is not in mode.allowed
  // Hmmm what about CoSets?
  // No, not sure this is the right solution then
  // log (modes['<#document>'].allowed)
}


// The tree builder
// ----------------

function Parser () {

  const self = this
  const document = { name:'<#document>', children:[] }
  // let state = 0 // initial
  let stack = [document]
  let head = document
  let mode = modes ['mode' in head ? head.mode : head.name] || modes ['<default>']

  Object.assign (this, { startTag, endTag, comment, space, data, write })
  Object.defineProperties (this, {
    document: { value: document, writable: false },
    info: { get: $=> `=> ${stack.map (_ => _.name). reverse () .join (' ')}` },
  })


  // Main loop
  // This just calls the 'delegate' methods for each token. 

  function write (tag) {
    if (tag instanceof StartTag)
      return startTag (tag.name, new Map ([...tag]), tag.selfClosing)

    if (tag instanceof EndTag)
      return endTag (tag.name)

    if (tag instanceof Comment)
      return comment (tag)

    if (tag instanceof Whitespace)
      return space (String (tag))

    if (typeof tag === 'string')
      return space (tag)
  }
  
  // The 'delegate' methods for each token. 

  function comment (tag) {
    head.children.push (tag)
    return this
  }

  function space (tag) {
    if (mode.ignoreSpace !== true)
      head.children.push (tag)
    return this
  }
  
  function data (tag) {
    if (mode.dataAllowed !== false)
      head.children.push (tag)
    // TODO else the insertions
    // else if (unblock) insertions.push (unblock, tag)
    // else throw new Error ('Parser block at data ' + tag + ' in context ' + stack.map (({node:{name}}) => name ).reverse ().join (' > '))
  }
  
  // startTag handler

  function startTag (name, attributes = new Map) {
    const ign = mode.ignoreStart
    if (ign && ign.has (name))
      return self

    const implied = closeForOpenTag (name, attributes)
    if (implied.length) log (`<${name}> implies`, ...implied.map (_ => `</${_.name}>`))

    // TODO do the formatting in some other way.
    // Maybe just add them as void tags and handle them in tree order.
    if (formatting.has (name))
      return self 

    if (!('allowed' in mode) || mode.allowed.has (name)) {
      open (name, attributes)
      log (self.info)
    }

    // OK I want to redo that 
    else if ('unblock' in mode) {
      const impl = mode.unblock ()
      const next = mode.next
      log (`<${name}> implies`, String (impl))
      if (impl instanceof StartTag) startTag (impl.name)
      else if (impl instanceof EndTag) endTag (impl.name)
      if (next != null) {
        head.mode = next
        mode = modes ['mode' in head ? head.mode : head.name] || modes ['<default>']
      }
      // reprocess the token
      startTag (name, attributes)
      // log (self.info)
    }

    else {
      log ('ignoring', `<${name}>`)
      // TODO in some cases this should _insert_ a path to prepare the context
      //const notAllowed = `Parser error:\n\t<${name}> not allowed in context ${self.info}`
      //throw new Error (notAllowed)
    }
    
    return self
  }

  // endTag handler
  
  function endTag (name, attributes) {
    // TODO remove mode.ignoreEnd and
    // use the scope boundaries instead
    const ign = mode.ignoreEnd
    if (ign && ign.has (name))
      return self

    // TODO body, html should set flags to
    // redirect comments only to other places. 

    if (name === 'html')
      return self

    if (name === 'body')
      return self

    // TODO do the formatting in some other way.
    // Maybe just add them as void tags and handle them in tree order.
    if (formatting.has (name))
      return self 

    if (name === 'br')
      return startTag ('br')

    if (name === 'p' && findIndex ('p', buttonScope) < 0)
      startTag (name) // NB fallthrough

    const closes = _endTag (name, attributes)
    if (closes.length) log (...closes.map (_ => `</${_.name}>`))
    else log (' ignoring', `</${name}>`)
  }
 
  // Private implementation of endTag.

  function _endTag (name, atts) {

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


  // Stack management
  // ----------------

  // FindIndex: Search the `stack` for the first element with
  // name in `names` and that occurs _before_ any element
  // with a name in `bounds`. 

  function findIndex (names, bounds) {
    if (!(names instanceof Set))
      names = new Set ([names])
    let index = -1
    for (let i=0, l=stack.length; i<l; i++) {
      const item = stack[i].name
      if (names.has (item)) { index = i; break }
      if (bounds.has (item)) break
    }
    return index
  }

  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (name, attributes = new Map) {
    const node = { name, attributes, children:[] }
    head.children.push (node)
    if (!voids.has (name)) {
      stack.unshift (node)
      head = stack[0]
      mode = modes ['mode' in head ? head.mode : head.name] || modes ['<default>']
    }
    return node
  }

  // CloseForOpenTag: Closes some amount of elements to
  // prepare the context for inserting a new element. 

  function closeForOpenTag (name, atts) { 

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
      return closeAll (coset ('table template html'), documentScope)
      // TODO now this also requires a sequence of open tags

    if (name === 'tr')
      return closeAll (coset ('tbody tfoot thead template html'), documentScope)
      // TODO now this also requires a sequence of open tags

    if ($('td th') .has (name)) 
      return closeAll (coset ('tr template html'), documentScope)
      // TODO now this also requires a sequence of open tags

    // TODO other tags ??
    if (name in pClosers)
      return closeInScope ('p', buttonScope)       

    return []
  }

  function openForOpen (name) {
    // TODO so after a context has been cleared, we must now
    // insert elements fto further prepare the context
    // So, how to specify that?
  }

  function closeInScope (...args) {
    let closes = []
    for (let i=0, l=args.length; i<l; i+=2) {
      const [names, bounds] = [args[i], args[i+1] || documentScope]
      const ix = findIndex (names, bounds)
      if (ix < 0) continue
      closes = closes.concat (stack.slice (0, ix+1))
      stack = stack.slice (ix+1)
    }
    head = stack[0]
    mode = modes ['mode' in head ? head.mode : head.name] || modes ['<default>']
    return closes
  }

  function closeAll (names, bounds) {
    let closes = [], r
    do { 
      r = closeInScope (names, bounds)
      closes = closes.concat (r)
    }
    while (r.length)
    head = stack[0]
    mode = modes ['mode' in head ? head.mode : head.name] || modes ['<default>']
    return closes
  }

}


module.exports = { Parser }