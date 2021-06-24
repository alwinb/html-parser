const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object
const { chunks, tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const { elements:E, categories:C,
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
    const { content, openFor } = documentRule
    _arr = [{ node:document, flags:0, scope:0, closeFor:0, content, openFor } ]
    stack = new Stack (_arr, _didOpen)
    return self
  }

  // ### Main loop

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
      if (flags & E.select && _arr[0].scope & E.select) {
        //tag = makeTagToken (T.EndTag, tag.name)
        endTag (tag, flags)
        continue
      }
    }
    
    // End Tags -- Exceptions

    else if (tag[0] === T.EndTag) {
      flags = elementInfo [tag.name] || defaultInfo

      // </br> tags are converted to <br> without attrs
      if (tag.name === 'br')
        tag = makeTagToken (T.VoidTag, tag.name)

      // before the head, </body> and </html> are converted to start tags
      // after the head, they are ignored (TODO they do affect the parent of comments and space)
      else if (flags & (E.body | E.html)) {
        if (afterHead) continue
        else tag = makeTagToken (T.StartTag, tag.name)
        // TODO body, html should use state to redirect comments and space (only) to other places. 
      }

      // An unmatched </p> gets converted to <p></p>.
      else if (flags & E.p && !(_arr[0].scope & E.p)) {
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

      case T.EndTag:
        endTag (tag, flags)

      break; case T.FormatEndTag:
        endTag (tag, C.format)

      break; case T.Comment: case T.Bogus:
        _arr[0].node.push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        _arr[0].node.push (tag[1])
    
      break; case T.VoidTag: {
        // log ('void tag', stack.info, '::', tag.name)
        flags = elementInfo [tag.name] || defaultInfo
        const st = stack.prepareFor (tag, flags)
        if (st) {
          if (flags & C.reopen) st.reformat ()
          st._arr[0].node.push (new Leaf (tag))
        }
      }

      break; case T.StartTag: {
        // log ('start tag', stack.info, '::', tag.name)
        const st = stack.prepareFor (tag, flags)
        if (st) {
          if (flags & C.reopen) st.reformat ()
          st.open (tag, flags) && _didOpen (flags)
        }
      }

      break; case T.FormatTag:
        const st = stack.prepareFor ('', C.TEXT)
        if (st) (st.reformat (), st.open (tag, C.format))

      break; case T.Data: {
        // log ('data', stack.info, ':: #text', tag[1])
        const st = stack.prepareFor (tag[1], C.TEXT)
        if (st) (st.reformat (), st._arr[0].node.push (tag[1]))
      }

    }}
    return self
  }
  
  function end () {
    for (let i = 0, l = _arr.length; i<l; i++) {
      const frame = _arr[i]
      if (frame.parent) frame.parent.push (frame.node)
    }
  }

  // ### endTag handler
  // Note, each of </h1> .. </h6> matches each of <h1> .. <h6>.

  function endTag (tag, flags) {
    let index
    if (flags & C.h1_h6) index = stack.openerFor (C.h1_h6, flags)
    // else if (!(_arr[0].scope & flags)) return // SPEED :D
    else index = stack.openerFor (tag.name, flags)
    // log ('endTag', tag.name, index)
    if (index >= 0) stack.close (tag, flags, index)
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
  const self = this, stack = arr; let reopen = []
  define (this, { info: { get: infoString } })
  assign (this, { openerFor, open, reformat, close, prepareFor, _arr:stack })

  // ### Info String
  // Returns a string representation of the stack

  function infoString () {
    return stack.map (({ node }) => node.name). reverse () .join (' ')
  }

  // ### Prepare For
  // TODO implement the quirksmode differences / closing of p elems

  function prepareFor (tag, flags) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '#text' : tag.name
    for (;;) {
      const { content, openFor, closeFor, foster } = stack[0]
      let ins

      if (closeFor >= 0 ? closeFor & flags : !(~closeFor & flags)) {
        // log ('prepare, closeFor', self.info)
        const frame = stack.shift ()
        if (!(flags & C.scope) && frame.flags & C.format) reopen.unshift (frame)
      }

      else if (content >= 0 ? content & flags : !(~content & flags))
        return self

      else if (openFor && (ins = openFor[name] || openFor['#default'])) {
        // log ('\tinsert implicit', self.info, '::', ins)
        const tag = makeTagToken (T.startTag, ins)
        const flags = elementInfo [tag.name] || defaultInfo
        open (tag, flags) && _didOpen (flags)
      }

      else if (foster)
        return foster // NB - prepareFor is _not_ called on the foster parenting stack

      else
        return null
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
    // TODO reconstruct the formatting context.. if appropriate! so where is that?
    return stack[0]
  }

  // ### Reformat
  // Reopens formatting elements

  function reformat () {
    for (let frame of reopen)
      open (frame.node, frame.flags)
    reopen = []
  }

  // ### Opener For
  // Finds a matching open tag-index for an end tag, given the schema.
  // search may be a string (tagName) or a number (elementInfo)

  function openerFor (search, searchFlags) {
    let index = -1
    for (let i=0, l=stack.length; i<l; i++) {
      const { node, flags, allowEnd } = stack[i]
      // log (self.info, 'allowEnd', search, '?', printInfo (allowEnd))
      // log ('search:', search, 'flags:', printInfo (flags), 'searchFlags:', printInfo (searchFlags))
      if (search === node.name || typeof search === 'number' && flags & search) { index = i; break }
      if (allowEnd < 0 ? searchFlags & ~allowEnd : !(searchFlags & allowEnd)) break
    }
    return index
  }
  
  // ### Close
  
  function close (tag, flags, index) {
    const closes = stack.splice (0, index + 1)
    for (let i=index; i>=0; i--) {
      const frame = closes[i]
      if (frame.parent) frame.parent.push (frame.node)
      if (frame.flags & C.format && i !== index) reopen.push (frame)
    }
    if (flags & C.scope) reopen = []
    log (`\tcloses`, closes.map(_ => _.node.name).reverse ())
  }

}

// Utils
// -----
// 'deriv' takes a parser context and the name/flags of an open element
// and returns a new parser context. The context is computed from the
// 'schema' and specifies how to handle misnested and misplaced tags.

function deriv (ctx, node, flags) {
  const rule = getRule (ctx, node.name, flags)
  let { closeFor, scope } = ctx
  const { content = ctx.content, allowEnd = ctx.allowEnd, openFor } = rule

  if (rule.scopeFor != null) {
    closeFor &= ~rule.scopeFor
    scope &= ~rule.scopeFor
  }

  scope |= flags
  if (rule.closeFor != null) 
    closeFor |= rule.closeFor

  return { node, flags, scope, closeFor, allowEnd, content, openFor }
}


// Exports
// -------

module.exports = { TreeBuilder, Leaf, Document, Node }