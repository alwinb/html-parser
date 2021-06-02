const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object
const { chunks, tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeStartTagToken } = require ('../lib/tokens')
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
    const { content, paths } = documentRule
    _arr = [{ node:document, flags:0, scope:0, closeFor:0, content, paths } ]
    stack = new Stack (_arr, _hooks)
    return self
  }

  // ### Main loop

  function write (tag) {
    return batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) {
    // // log (tokenName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.info);
    switch (tag[0]) {

      case T.EndTag: {
        const flags = elementInfo [tag.name] || defaultInfo
        // Exception: </br> tags are converted to <br> tags (TODO minus attrs)
        if (tag.name === 'br') {
          const st = stack.prepareFor (tag, flags)
          if (st) st.open (tag, flags) && _hooks (flags)
        }
        else endTag (tag, flags)
      }

      break; case T.Comment: case T.Bogus:
        _arr[0].node.push (tag)

      break; case T.FormatTag: case T.FormatEndTag:
        _arr[0].node.push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        _arr[0].node.push (tag[1])
    
      break; case T.StartTag:
        log ('start tag', stack.info, '::', tag.name)
        const flags = elementInfo [tag.name] || defaultInfo
        // Exception: <select> within <select> is treated as </select>
        if (flags & E.select && _arr[0].scope & E.select)
          endTag (tag, flags)
        else {
          const st = stack.prepareFor (tag, flags)
          if (st) st.open (tag, flags) && _hooks (flags)
        }

      break; case T.Data: {
        log ('data', stack.info, ':: #text', tag[1])
        const st = stack.prepareFor (tag[1], C.TEXT)
        if (st) st._arr[0].node.push (tag[1])
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
  // An unmatched </p> gets converted to <p></p>.

  function endTag (tag, flags) {
    let index
    if (flags & C.h1_h6) index = stack.openerFor (C.h1_h6, flags)
    else if (!(_arr[0].scope & flags)) return // SPEED :D
    else index = stack.openerFor (tag.name, flags)

    if (index >= 0) {
      const closes = _arr.splice (0, index + 1)
      for (const x of closes) if (x.parent) x.parent.push (x.node)
      log (`\tcloses`, closes.map(_ => _.node.name).reverse ())
    }

    else if (tag.name === 'p') {
      tag = makeStartTagToken ('p')
      const st = stack.prepareFor (tag, flags)
      if (st) st.append (tag, flags)
    }

    // TODO body, html should use state to redirect comments and space (only) to other places. 
    else if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = makeStartTagToken (tag.name)
      const st = stack.prepareFor (ins, flags)
      if (st) st.open (ins, flags) && _hooks (flags)
      if (flags & E.head) stack.close (tag.name, flags)
      return
    }
  }

  // Hack

  function _hooks (flags) {
    node = _arr[0]
    if (flags & E.head) {
      document.head = head = node
      assign (_arr[_arr.length-2], afterHeadRule)
      afterHead = true // Well, upon close anyway
    }

    else if (flags & E.body) { // Hack // onbody hook
      document.body = body = node
      if (delegate && delegate.onBodyStart)
        delegate.onBodyStart (document, head)
    }
  }

}


// Stack of open elments
// ---------------------

function Stack (arr = [], _hooks) {
  const self = this, stack = arr
  define (this, { info: { get: infoString }})
  assign (this, { openerFor, open, append, close, prepareFor, _arr:stack })

  // ### Info String
  // Returns a string represnetation of the stack

  function infoString () {
    return stack.map (({ node }) => node.name). reverse () .join (' ')
  }

  // ### Prepare For
  // The heart of the parsing algorithm
  // TODO implement the quirksmode differences / closing of p elems

  function prepareFor (tag, flags) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '#text' : tag.name
    for (;;) {
      const { content, paths, closeFor, foster } = stack[0]
      let ins

      if (closeFor >= 0 ? closeFor & flags : !(~closeFor & flags))
        stack.shift ()

      else if (content >= 0 ? content & flags : !(~content & flags))
        return self

      else if (paths && (ins = paths[name] || paths['#default'])) {
        log ('\tinsert implicit', self.info, '::', ins)
        const tag = makeStartTagToken (ins)
        const flags = elementInfo [tag.name] || defaultInfo
        open (tag, flags) && _hooks (flags)
      }

      else if (foster)
        return foster.prepareFor (tag, flags)

      else
        return null
    }
  }

  // ### Open
  // Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag, flags = elementInfo [tag.name] || defaultInfo) {
    log ('\topen', tag.name)
    if (flags & C.void) {
      stack[0].node.push (new Leaf (tag))
      return stack[0]
    }
    const node = new Node (tag)
    const frame = deriv (stack[0], node, flags)
    if (flags & E.table) {
      frame.parent = stack[0].node
      frame.foster = new Stack (stack.slice (0), _hooks)
    }
    else stack[0].node.push (node)
    stack.unshift (frame)
    return stack[0]
  }

  // ### Append
  // Adds a childNode to the current node.

  function append (tag, flags) {
    // log ('append', self.info, '::', tag.name, fosterParent ? '/fosterParent ' + fosterParent.node.name : '')
    const node = flags & C.void ? new Leaf (tag) : new Node (tag);
    stack [0] .node .push (node)
    return node
  }

  // ### Close
  // Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function close (name, flags) {
    const i = openerFor (name, flags)
    for (let j = 0; j < i; j++) {
      log ('\tclose', stack[j])
      if (stack[j].parent) stack[j].parent.push (stack[j].node)
    }
    if (i >= 0) return stack.splice (0, i+1)
    return []
  }

  // ### Opener For
  // Finds a matching open tag-index for an end tag, given the schema.
  // search may be a string (tagName) or a number (elementInfo)

  function openerFor (search, searchFlags) {
    let index = -1
    for (let i=0, l=stack.length; i<l; i++) {
      const { node, flags, allowEnd } = stack[i]
      // log (node.name, 'allowEnd?', printInfo (allowEnd), '\n-- compare', search, printInfo (flags), printInfo (searchFlags))
      if (search === node.name || typeof search === 'number' && flags & search) { index = i; break }
      if (!(searchFlags & allowEnd)) break
    }
    return index
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
  const { content = ctx.content, allowEnd = ctx.allowEnd, paths } = rule

  if (rule.scopeFor != null) {
    closeFor &= ~rule.scopeFor
    scope &= ~rule.scopeFor
  }

  scope |= flags
  if (rule.closeFor != null) 
    closeFor |= rule.closeFor

  return { node, flags, scope, closeFor, allowEnd, content, paths }
}


// Exports
// -------

module.exports = { TreeBuilder, Leaf, Document, Node }