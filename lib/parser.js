const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object
const { tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const { elements:E, tagNameSets:C,
  elementInfo, defaultInfo, printInfo,
  documentRule, afterHeadRule, getRule } = require ('./schema.js')


// The parser
// ==========

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, _arr, afterHead
  define (this, { document: { get: $=> document }})
  assign (this, { reset, write, batchWrite, end })
  return reset ()

  // ### Init / reset

  function reset () {
    head = body = null
    document = new Document ()
    afterHead = false
    const { content, openFor, paths } = documentRule
    _arr = [{ node:document, flags:C.none, closable:C.none, allowed:content, openable:C.any, openFor, paths } ]
    stack = new Stack (_arr, _didOpen)
    return self
  }

  // ### Main loop

  function end () {
    // log ('end', stack.info)
    // TODO if no head, body, still add them no?
    for (let i = 0, l = _arr.length; i<l; i++) {
      const frame = _arr[i]
      // log ('end', frame.node.name)
      if (frame.parent) frame.parent.push (frame.node)
    }
  }

  function write (tag) {
    return batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) { let flags
    // log (tokenName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.info);
    
    // Start Tags -- Exceptions

    if (tag[0] === T.StartTag) {
      flags = elementInfo [tag.name] || defaultInfo

      // <select> within <select> is treated as </select>
      if (flags & E.select && _arr[0].closable & E.select)
        tag = makeTagToken (T.EndTag, tag.name)

      // TODO <image> gets converted to <img>
    }
    
    // End Tags -- Exceptions

    else if (tag[0] === T.EndTag) {
      flags = elementInfo [tag.name] || defaultInfo

      // </br> tags are converted to <br> without attrs
      if (flags & E.br)
        tag = makeTagToken (T.VoidTag, tag.name)

      // before the head, </body> and </html> are converted to start tags
      // after the head, they are ignored (TODO they do affect the parent of comments and space)
      else if (flags & (E.body | E.html)) {
        if (afterHead) continue
        else tag = makeTagToken (T.StartTag, tag.name)
        // TODO body, html should use state to redirect comments and space (only) to other places. 
      }

      // An unmatched </p> gets converted to <p></p>.
      else if (flags & E.p && !(_arr[0].closable & E.p)) {
        const st = stack.prepareFor (tag, flags)
        if (st) st._arr[0].node.push (new Node (tag))
      }

      // before the head, </head> is converted to <head></head>,
      else if (flags & E.head && !afterHead) {
        const ins = makeTagToken (T.StartTag, tag.name)
        const st = stack.prepareFor (ins, flags)
        if (st) st.open (ins, flags) && _didOpen (flags)
      }
    }
    
    // Default branch

    switch (tag[0]) {

      case T.EndTag: {
        // log ('end tag', stack.info, '::', tag.name)
        let index
        if (flags & C.h1_h6) index = stack.openerFor (C.h1_h6, flags)
        // else if (!(_arr[0].closable & flags)) return // SPEED :D // eeh not with table atm
        else index = stack.openerFor (tag.name, flags)
        if (index >= 0) stack.close (index)
      }

      break; case T.Comment: case T.Bogus:
        _arr[0].node.push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        _arr[0].node.push (tag[1])

      break; case T.StartTag: {
        // log ('start tag', stack.info, '::', tag.name)
        const st = stack.prepareFor (tag, flags)
        if (st) {
          if (flags & C.reopen) st.reformat ()
          if (flags & C.void) st._arr[0].node.push (new Leaf (tag))
          else st.open (tag, flags) && _didOpen (flags)
        }
      }

      break; case T.Data: {
        // log ('data', stack.info, ':: #text', tag[1])
        const st = stack.prepareFor (tag[1], C.TEXT)
        if (st) (st.reformat (), st._arr[0].node.push (tag[1]))
      }

    }}
    return self
  }
  

  // Hack

  function _didOpen (flags) {
    if (flags & E.head) {
      document.head = head = _arr[0]
      assign (_arr[_arr.length-2], afterHeadRule)
      afterHead = true // Well, upon close anyway
    }

    else if (flags & E.body) { // Hack // onbody hook
      document.body = body = _arr[0]
      if (delegate && delegate.onBodyStart)
        delegate.onBodyStart (document, head)
    }
  }

}


// Stack of open elments
// ---------------------

function Stack (arr = [], _didOpen) {
  const self = this
  const stack = arr // stack of open elements
  let reopen = []   // implicit formatting tags
  let counts = {}   // index on reopen

  define (this, { info: { get: infoString } })
  assign (this, { openerFor, open, reformat, close, prepareFor, _arr:stack })

  // ### Info String
  // Returns a string representation of the stack

  function infoString () {
    return stack.map (({ node }) => node.name). reverse () .join (' ')
  }

  // ### Prepare For
  // TODO implement the quirksmode differences / closing of p elems
  // tag must be a StartTag or Data

  function prepareFor (tag, flags) { 
    for (;;) {
      const frame = stack[0]

      if (frame.allowed & flags) return self

      else if (frame.openFor & flags) {
        const name = flags & C.TEXT ? '#text' : tag.name
        const ins = frame.paths[name] || frame.paths['#default']
        // log ('\tinsert implicit', self.info, '::', ins)
        const insFlags = elementInfo [ins] || defaultInfo
        open ({ name:ins }, insFlags) && _didOpen (insFlags)
      }

      else if (frame.openable & flags) close (0)

      else if (frame.foster) {
        // log ('prepare, foster', self.info, '::', name)
        // return foster.prepareFor (tag, flags)
        return frame.foster // NB - prepareFor is _not_ called on the foster parenting stack
      }

      else return null
    }
  }

  // ### Open
  // Creates a new node; appends it to the current node,

  function open (tag, flags = elementInfo [tag.name] || defaultInfo) {
    // log ('\topen', tag.name)
    const node = new Node (tag)
    const frame = deriv (stack[0], node, flags)
      node.frame = frame // for debug
    if (flags & E.table) {
      frame.parent = stack[0].node
      frame.foster = stack[0].foster || new Stack (stack.slice (0), _didOpen)
    }
    else stack[0].node.push (node)
    stack.unshift (frame)
    // log ('after open', self.info)
    return stack[0]
  }

  // ### Reformat
  // Reopens formatting elements

  function reformat () {
    for (const { node, flags } of reopen) open (node, flags)
    reopen = [], counts = {}
  }

  // ### Opener For
  // Finds a matching open tag-index for an end tag, given the schema.
  // search may be a string (tagName) or a number (elementInfo)

  function openerFor (search, searchFlags) {
    let index = -1
    for (let i=0, l=stack.length; i<l; i++) {
      const { node, flags, closable } = stack[i]
      // log ('search:', search, 'flags:', printInfo (flags), 'searchFlags:', printInfo (searchFlags))
      if (search === node.name || typeof search === 'bigint' && flags & search) { index = i; break }
      if (!(searchFlags & closable)) break
    }
    return index
  }
  
  // ### Close
  // Closes the topmost n elements of the stack.

  function close (n) {
    const { flags } = stack [n]
    for (; n >= 0; n--) {
      const frame = stack.shift ()
      const { parent, flags, node } = frame
      if (parent) parent.push (node)
      if (n && flags & C.format) {
        const count = counts[node.name] = (counts[node.name] || 0) + 1
        if (count <= 3) reopen.unshift (frame)
      }
    }
    if (flags & C.formatContext)
      (reopen = [], counts = {})
  }

}

// Stack Frame
// -----------
// 'deriv' takes a parser context and the name/flags of an open element
// and returns a new parser context. The context is computed from the
// 'schema' and specifies how to handle misnested and misplaced tags.

function deriv (frame, node, flags) {
  const rule = getRule (frame, node.name, flags)
  let { closable, allowed, openable, foster } = frame
  let {
    allowEnd = C.any,
    allowOpen = C.any,
    content = frame.allowed,
    allow   = C.none,
    forbid  = C.none,
    openFor = 0n,
    paths } = rule

  closable = (closable & allowEnd)  | flags
  allowed  = (content  &~ forbid)   | allow
  openable = (openable & allowOpen) | allowed | openFor
  return { node, flags, closable, allowed, openable, openFor:(openFor &~allowed), paths, foster }
}


function frameInfo ({ node, flags, closable, allowed, openable, openFor = 0n, paths }) {
  return {
    name: node.name,
    flags:    printInfo (flags),
    closable: printInfo (closable),
    openable: printInfo (openable),
    allowed:  printInfo (allowed),
    openFor:  printInfo (openFor),
    paths
  }
}


// Exports
// -------

Object.assign (TreeBuilder, { Document, Leaf, Node, frameInfo })
module.exports = TreeBuilder