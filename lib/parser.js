const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks, tokenTypes:T } = require ('../lib/lexer')
const { Document, Leaf, Node, Mark, UnMark, StartTag, EndTag, Comment, flagsS } = require ('../lib/dom')
const { elements:E, categories:C, boundaries:B, defaultInfo, info:elementInfo, scopes, schema }  = require ('./schema.js')

B.document = 0 // For the time being


// Handling of Start Tags
// ----------------------

// By default, before any new element is inserted, the stack will be
// serached one or more times, for a specific element in a specific 
// scope to close -- to prepare the context for insertion. 

const startTagCloses = {
  dd       : [ C.ditem, B.li, 'p', B.pgroup],
  dt       : [ C.ditem, B.li, 'p', B.pgroup],
  li       : ['li',     B.li, 'p', B.pgroup],
  button   : ['button', B.scope ],
  input    : ['select', B.select],
  keygen   : ['select', B.select],
  textarea : ['select', B.select],
}

// At the moment the behaviour of other open tags is encoded via
// beforeOpen method in the TreeBuilder class below. 

// The parser
// ----------

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, mode, afterHead
  restart ()

  assign (this, { restart, write, batchWrite /*end*/ })
  define (this, {
    document: { get: $=> document },
    info: { get: $=> `${afterHead || (head ? 'inHead' : '')}:${stack.map (_ => _.name). reverse () .join (' ')}` },
  })

  // Start/ restart

  function restart () {
    document = new Document ()
    head = body = null
    stack = new Stack (document)
    mode = schema ['<#document>']
    afterHead = ''
  }

  // Main loop
  function write (tag) {
    batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) {
      if (typeof tag === 'string') {
        const closes = closeForTag (tag)
        if (prepareForInsert (tag)) stack[0].push (tag)
      }
      else switch (tag[0]) {
        case T.StartTag:
          const closes = closeForTag (tag)
          if (prepareForInsert (tag)) open (tag);
        break
        case T.EndTag:  endTag (tag); break
        case T.Space:   stack[0].push (tag[1]); break
        case T.Comment: stack[0].push (tag);    break
      }
    }
    return self
  }


  // closeForTag: called before inserting a new element. 
  // note that this specifies behaviour that can also to some
  // extent be specified with the 'default' rules in the schema. 
  // so that's not super clean, I'd have to think about that. 

  function closeForTag (tag) { // tag must be a StartTag or data
    const name = typeof tag === 'string' ? '<data>' : tag.name
    const flags = elementInfo [name] || defaultInfo
    // log ('closeForTag', self.info, `:: <${name}>`, flags & C.cell)
    // TODO html and body should merge attributes onto existing

    if (name in startTagCloses)
      return closeOrIgnore (...startTagCloses [name])

    if (flags & C.heading)
      return closeOrIgnore ('p', B.pgroup, B.heading, B.document)

    // Select // TODO <select> gets treated as an end tag eh?
    if (flags & E.option)
      return closeOrIgnore (E.option, B.select)

    if (flags & E.optgroup) {
      // log ('closeForTag', tag.name, stack.findInScope ('select', B.select))
      if (stack.findInScope ('select', B.select) >= 0) // cannot be nested in select
        return closeOrIgnore (E.option, B.select, E.optgroup, B.select)
      else
        return closeOrIgnore (E.option, B.select)
    }

    // Tables
    if (flags & (C.tbody | E.colgroup | E.caption || E.col))
      return closeOrIgnore (E.caption | C.tbody, B.tcontent)

    if (flags & E.tr)
      return closeOrIgnore (E.tr | E.caption | E.colgroup, B.row)

    if (flags & C.cell)
      return closeOrIgnore (C.cell | E.caption | E.colgroup, B.cell)

    // TODO other tags ?? (frames?)
    // TODO add the the default inBody rule (?)
    if (flags & C.closep)
      return closeOrIgnore ('p', B.pgroup)       

    return []
  }

  // OK this works, but I'd like to make it nicer, and it needs to change for the
  // table/ foster parenting to work, plus select

  function prepareForInsert (tag) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '<data>' : tag.name
    const flags = elementInfo [name] || defaultInfo
    //log ('prepareFor', self.info, `:: <${name}>`)

    // FIXME select in body allowes more more content/ cannot be expressed in current schema

    // <select> in <select> is treated as </select>
    if (tag.name === 'select' && closeOrIgnore ('select', B.select))
      return false

    let fail = false

    const allowedIn = ({name:mname, allowed:cat = ~0}) => {
      const r = typeof cat === 'number' ? flags & cat : cat.has (name)
      //log (name, 'allowedIn', mname, !!r)
      return !!r
    }

    while (!fail && !allowedIn (mode)) {
      if ('paths' in mode) {
        const ins = mode.paths[tag.name] || mode.paths['<default>']
        if (ins) open (new StartTag (ins))
        //if (ins) log ('insert', ins)
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
    const flags = tag.name in elementInfo ? elementInfo [tag.name] : defaultInfo

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
    if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = new StartTag (name)
      prepareForInsert (ins) && (open (ins))
      if (flags & E.head) closeOrIgnore (name, B.scope)
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

  function open (tag, flags = elementInfo[tag.name]||defaultInfo) {
    const node = stack.append (tag, flags)
    const { name } = node
    if (node instanceof Node) {
      stack.unshift (node)
      const isHead = flags & E.head
      afterHead = afterHead || (head && !isHead ? '<afterHead>' : '')
      mode = schema [flags & E.html ? 'html' + afterHead : name] || schema ['<default>']
      if (isHead) document.head = head = node
      else if (!body && flags & E.body) { // Well, now it's all over the place..
        document.body = body = node
        if (delegate && delegate.onBodyStart)
          delegate.onBodyStart (document, head)
      }
    }
    return node
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
    const node = stack[0]
    afterHead = afterHead || (head && node.name !== 'head' ? '<afterHead>' : '')
    mode = schema [node.name === 'html' ? 'html'+afterHead : node.name] || schema ['<default>']
    return closes
  }

}

class Stack extends Array {

  findInScope (search, bounds, start = 0) {
    let index = -1
    for (let i =start, l = this.length; i<l; i++) {
      const item = this[i], flags = item[flagsS]
      if (typeof search === 'number' ? flags & search : item.name === search) { index = i; break }
      if (bounds & flags) break
    }
    return index
  }

  append (tag, flags = elementInfo[tag.name]||defaultInfo) { // Adds a childNode to the current node
    const { name } = tag
    let node = flags & C.format ? (tag instanceof EndTag ? new UnMark (tag) : new Mark (tag))
      : flags & C.void ? new Leaf (tag)
      : new Node (tag)
    this[0].push (node)
    //log ({append:'', tag, node})
    return node
  }

}

module.exports = { TreeBuilder, Mark, UnMark, Leaf, Document, Node }