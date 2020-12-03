const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks, tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeStartTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const {
  elements:E, categories:C, boundaries:B,
  defaultInfo, info:elementInfo, boundarySets, defaultBoundarySet,
  rules, defaultRule } = require ('./schema.js')

B.document = 0 // For the time being


// Handling of Start Tags
// ----------------------

// By default, before any new element is inserted, the stack will be
// searched one or more times, for a specific element in a specific 
// scope to close -- to prepare the context for insertion. 

const closeLists = {
  dd       : [ C.ditem, B.li, 'p', B.pgroup],
  dt       : [ C.ditem, B.li, 'p', B.pgroup],
  li       : ['li',     B.li, 'p', B.pgroup],
  button   : ['button', B.scope ],
}

// At the moment the behaviour of other open tags is encoded via
// closeForTag method in the TreeBuilder class below. 

// The parser
// ----------

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, afterHead
  restart ()

  assign (this, { restart, write, batchWrite /*end*/ })
  define (this, {
    document: { get: $=> document },
    state: { get: $=> stack.map (_ => _[2].name). reverse () .join (' ') },
  })

  // Start/ restart

  function restart () {
    document = new Document ()
    head = body = null
    stack = [ [rules ['#document'], defaultInfo, document] ]
    afterHead = ''
  }

  // Main loop
  function write (tag) {
    batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) { 
      // log (tokenName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.state);
      switch (tag[0]) {
      
      case T.EndTag:
        endTag (tag, elementInfo [tag.name] || defaultInfo)

      break; case T.Comment: case T.Bogus:
        stack[0][2].push (tag)

      break; case T.FormatTag: case T.FormatEndTag:
        stack[0][2].push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        stack[0][2].push (tag[1])
    
      break; case T.StartTag:
        // Exception: <select> as a child of <select> is treated as </select>
        if (tag.name === 'select' && closeInScope ('select').length)
          continue;
        const info = elementInfo [tag.name] || defaultInfo
        const closes = closeForTag (tag, info)
        if (prepareForInsert (tag, info)) open (tag, info)

      break; case T.Data: {
        const closes = closeForTag (tag[1])
        const info = elementInfo ['#text']
        if (prepareForInsert (tag[1], info)) stack[0][2].push (tag[1])
      }

    }}
    return self
  }


  // closeForTag: called before inserting a new element. 
  // note that this specifies behaviour that can also to some
  // extent be specified with the 'default' rules in the schema. 
  // so that's not super clean, I'd have to think about that. 

  function closeForTag (tag, info) { // tag must be a StartTag or data
    const name = typeof tag === 'string' ? '#text' : tag.name
    // log ('closeForTag', self.state, `:: <${name}>`, info & C.cell)
    // TODO html and body should merge attributes onto existing

    if (name in closeLists)
      return closeInScope (...closeLists [name])

    if (info & C.heading)
      return closeInScope ('p', B.pgroup, B.heading, B.document)

    if (info & (C.tbody | E.colgroup | E.caption | E.col))
      return closeInScope (E.caption | C.tbody, B.tcontent)

    if (info & E.tr)
      return closeInScope (E.tr | E.caption | E.colgroup, B.row)

    if (info & C.cell)
      return closeInScope (C.cell | E.caption | E.colgroup, B.cell)

    // TODO other tags ?? (frames?)
    if (info & C.closep)
      return closeInScope ('p', B.pgroup)       

    return []
  }

  // OK this works, but I'd like to make it nicer, and it needs to change for the
  // table/ foster parenting to work

  function prepareForInsert (tag, flags) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '#text' : tag.name
    // log ('prepareFor', self.state, `:: <${name}>`)
    // log (stack.map (_ => _[0].name) .reverse ())
    
    let fail = false
    const allowedIn = ({ name:mname, allowed:cat = ~0, negate = false }) => {
      const r = typeof cat === 'number' ? flags & cat : cat.has (name)
      // log (name, 'allowedIn', mname, !!r)
      return negate ? !r : !!r
    }

    let mode
    while (!fail && (mode = stack[0][0]) && !allowedIn (mode)) {
      if ('paths' in mode) {
        const ins = mode.paths[name] || mode.paths['#default']
        if (ins) {
          // log ('insert implicit', ins)
          open (makeStartTagToken (ins))
        }
        else fail = true
      }
      else if ('closeFor' in mode && flags & mode.closeFor) {
        closeInScope (stack[0][2].name)
      }
      else if (mode.recover === 'close')
        closeInScope (stack[0][2].name)
      else fail = true
    }
    if (fail) {
      if (mode.recover === 'ignore') {
        // log ('prepare: ignoring tag ' + `<${name}>`)
        return false
      }
      const notAllowed = `TreeBuilder error:\n\t<${name}> is not allowed in context ${self.state}`
      throw new Error (notAllowed)
    }
    else return true
  }


  // endTag handler
  
  function endTag (tag, flags) {
    const { name } = tag
    //log (self.state, `:: </${tag.name}>`)

    // br gets converted to a start tag, and p may insert a start tag if absent.
    if (name === 'br' || name === 'p' && findInScope ('p', B.pgroup) < 0) {
      const tag_ = makeStartTagToken (name)
      const closes = closeForTag (tag_, flags)
      if (prepareForInsert (tag_, flags)) append (tag_) // NB not opened
      return
    }

    // TODO body, html should set flags to redirect comments and space (only) to other places. 
    if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = makeStartTagToken (name)
      prepareForInsert (ins, flags) && (open (ins), flags)
      if (flags & E.head) closeInScope (name, B.scope)
      return
    }

    if (flags & C.heading)
      return closeInScope (C.heading, B.scope)

    if (name in boundarySets)
      return closeInScope (name, boundarySets [name])

    return closeInScope (name, defaultBoundarySet)
  }


  // Stack management
  // ----------------

  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag, flags = elementInfo[tag.name]||defaultInfo) {
    const node = append (tag, flags)
    const { name } = node
    if (node instanceof Node) {
      const isHead = flags & E.head
      rule = stack[0][0].rules [name] || stack[0][0].rules ['#default']
      stack.unshift ([rule, flags, node])

      // Well, now it's all over the place..
      if (flags & E.head) {
        document.head = head = node
        stack[stack.length-2][0] = rules['<afterHead>'] // Well, upon close anyway
      }
      else if (flags & E.body) {
        document.body = body = node
        if (delegate && delegate.onBodyStart)
          delegate.onBodyStart (document, head)
      }
    }
    return node
  }


  function append (tag, flags = elementInfo[tag.name]||defaultInfo) { // Adds a childNode to the current node
    const { name } = tag
    const node = flags & C.void ? new Leaf (tag) : new Node (tag)
    stack[0][2].push (node)
    return node
  }

  // ...closeList may be a sequence [names, scope, names2, scope2, ..]
  // returns an array with the nodes that were closed

  function closeInScope (...closeList) {
    // log ('before closeInScope', stack.map (_ => _[0].name) .reverse())
    let start = 0
    for (let i=0, l=closeList.length; i<l; i+=2) {
      const [search, bounds] = [closeList[i], closeList[i+1] || B.document]
      const ix = findInScope (search, bounds, start)
      if (ix < 0) continue
      else start = ix + 1
    }
    const closes = stack.splice (0, start)
    return closes
  }


  function findInScope (search, bounds, start = 0) {
    let index = -1
    for (let i = start, l = stack.length; i<l; i++) {
      const [_, flags, item] = stack[i]
      if (typeof search === 'number' ? flags & search : item.name === search) { index = i; break }
      if (bounds & flags) break
    }
    return index
  }

}

module.exports = { TreeBuilder, Leaf, Document, Node }