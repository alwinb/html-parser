const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks, tokenTypes:T } = require ('../lib/lexer')
const { makeStartTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const { elements:E, categories:C, boundaries:B, defaultInfo, info:elementInfo, boundarySets, defaultBoundarySet, rules }  = require ('./schema.js')

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
  input    : ['select', B.select],
  keygen   : ['select', B.select],
  textarea : ['select', B.select],
}

// At the moment the behaviour of other open tags is encoded via
// closeForTag method in the TreeBuilder class below. 

// The parser
// ----------

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, mode, afterHead
  restart ()

  assign (this, { restart, write, batchWrite /*end*/ })
  define (this, {
    document: { get: $=> document },
    state: { get: $=> `${afterHead || (head ? 'inHead' : '')}:${stack.map (_ => _.name). reverse () .join (' ')}` },
  })

  // Start/ restart

  function restart () {
    document = new Document ()
    head = body = null
    stack = [ [defaultInfo, document] ]
    mode = rules ['<#document>']
    afterHead = ''
  }

  // Main loop
  function write (tag) {
    batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) switch (tag[0]) {

      case T.Data: {
        const closes = closeForTag (tag[1])
        const info = elementInfo ['<data>']
        if (prepareForInsert (tag[1], info)) stack[0][1].push (tag[1])
      }

      break; case T.Comment: case T.Bogus:
        stack[0][1].push (tag)

      break; case T.FormatTag: case T.FormatEndTag:
        stack[0][1].push (tag)

      break; case T.Space: case T.RawText:
        stack[0][1].push (tag[1])
    
      break; case T.StartTag:
        const info = elementInfo [tag.name] || defaultInfo
        const closes = closeForTag (tag, info)
        if (prepareForInsert (tag, info)) open (tag, info)

      break; case T.EndTag:
        endTag (tag, elementInfo [tag.name] || defaultInfo)

    }
    return self
  }


  // closeForTag: called before inserting a new element. 
  // note that this specifies behaviour that can also to some
  // extent be specified with the 'default' rules in the schema. 
  // so that's not super clean, I'd have to think about that. 

  function closeForTag (tag, info) { // tag must be a StartTag or data
    const name = typeof tag === 'string' ? '<data>' : tag.name
    // log ('closeForTag', self.state, `:: <${name}>`, info & C.cell)
    // TODO html and body should merge attributes onto existing

    if (name in closeLists)
      return closeOrIgnore (...closeLists [name])

    if (info & C.heading)
      return closeOrIgnore ('p', B.pgroup, B.heading, B.document)

    // Select // TODO <select> within <select> gets treated as an end tag eh?
    if (info & E.option)
      return closeOrIgnore (E.option, B.select)

    if (info & E.optgroup) {
      // log ('closeForTag', tag.name, stack.findInScope ('select', B.select))
      if (findInScope ('select', B.select) >= 0) // cannot be nested in select
        return closeOrIgnore (E.option, B.select, E.optgroup, B.select)
      else
        return closeOrIgnore (E.option, B.select)
    }

    // Tables
    if (info & (C.tbody | E.colgroup | E.caption || E.col))
      return closeOrIgnore (E.caption | C.tbody, B.tcontent)

    if (info & E.tr)
      return closeOrIgnore (E.tr | E.caption | E.colgroup, B.row)

    if (info & C.cell)
      return closeOrIgnore (C.cell | E.caption | E.colgroup, B.cell)

    // TODO other tags ?? (frames?)
    // TODO add the the default inBody rule (?)
    if (info & C.closep)
      return closeOrIgnore ('p', B.pgroup)       

    return []
  }

  // OK this works, but I'd like to make it nicer, and it needs to change for the
  // table/ foster parenting to work, plus select

  function prepareForInsert (tag, flags) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '<data>' : tag.name
    //log ('prepareFor', self.state, `:: <${name}>`)
    // FIXME select in body allowes more more content/ cannot be expressed in current schema

    // <select> in <select> is treated as </select>
    if (name === 'select' && closeOrIgnore ('select', B.select))
      return false

    let fail = false

    const allowedIn = ({ name:mname, allowed:cat = ~0, negate = false }) => {
      const r = typeof cat === 'number' ? flags & cat : cat.has (name)
      //log (name, 'allowedIn', mname, !!r)
      return negate ? !r : !!r
    }

    while (!fail && !allowedIn (mode)) {
      if ('paths' in mode) {
        const ins = mode.paths[name] || mode.paths['<default>']
        if (ins) open (makeStartTagToken (ins))
        //if (ins) log ('insert', ins)
        else fail = true
      }
      else if (mode.recover === 'close')
        closeOrIgnore (stack[0][1].name)
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

    // TODO body, html should set flags to redirect comments and space only to other places. 
    if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = makeStartTagToken (name)
      prepareForInsert (ins, flags) && (open (ins), flags)
      if (flags & E.head) closeOrIgnore (name, B.scope)
      return
    }

    if (flags & C.heading)
      return closeOrIgnore (C.heading, B.scope)

    if (name in boundarySets)
      return closeOrIgnore (name, boundarySets [name])

    return closeOrIgnore (name, defaultBoundarySet)
  }


  // Stack management
  // ----------------

  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag, flags = elementInfo[tag.name]||defaultInfo) {
    const node = append (tag, flags)
    const { name } = node
    if (node instanceof Node) {
      stack.unshift ([flags, node])
      const isHead = flags & E.head
      afterHead = afterHead || (head && !isHead ? '<afterHead>' : '')
      mode = rules [flags & E.html ? 'html' + afterHead : name] || rules ['<default>']
      if (isHead) document.head = head = node
      else if (!body && flags & E.body) { // Well, now it's all over the place..
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
    stack[0][1].push (node)
    return node
  }

  // ...closeList may be a sequence [names, scope, names2, scope2, ..]
  // returns an array with the nodes that were closed

  function closeOrIgnore (...closeList) {
    let start = 0
    for (let i=0, l=closeList.length; i<l; i+=2) {
      const [search, bounds] = [closeList[i], closeList[i+1] || B.document]
      const ix = findInScope (search, bounds, start)
      if (ix < 0) continue
      else start = ix + 1
    }
    const closes = stack.splice (0, start)
    const node = stack[0][1]
    afterHead = afterHead || (head && node.name !== 'head' ? '<afterHead>' : '')
    mode = rules [node.name === 'html' ? 'html'+afterHead : node.name] || rules ['<default>']
    return closes
  }


  function findInScope (search, bounds, start = 0) {
    let index = -1
    for (let i = start, l = stack.length; i<l; i++) {
      const [flags, item] = stack[i]
      if (typeof search === 'number' ? flags & search : item.name === search) { index = i; break }
      if (bounds & flags) break
    }
    return index
  }

}

module.exports = { TreeBuilder, Leaf, Document, Node }