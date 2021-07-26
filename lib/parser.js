const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object
const { tokenTypes:T, tokenRoles, tokenName, typeMask } = require ('../lib/lexer')
const { makeTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const { elements:E, tagNameSets:C, SVGTagNameAdjustments,
  elementInfo, defaultInfo, printInfo,
  documentRule, afterHeadRule, afterFramesetRule, getRule } = require ('./schema.js')


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
    _arr = [{ node:document, flags:C.none, closable:C.none, content, openable:C.any, openFor, foster:0n, paths } ]
    stack = new Stack (_arr)
    return self
  }

  // ### Write and End

  function write (tag) {
    return batchWrite ([tag])
  }

  function end () {
    return (stack.close (), self)
  }

  // ### Main loop

  function batchWrite (tags) {
    for (let tag of tags) {
      // log (tokenName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.info);

      // Adjust Tag names
      tag = adjustToken (tag)
      let flags = elementInfo [tag.name] || defaultInfo

      // Select the appropriate stack
      const fosterStack = _arr[0].fosterStack
      const stack1 = _arr[0].foster & flags && fosterStack || stack
      const frame = stack1._arr[0]


      // ### Start Tag - Exceptions

      // * <select> within <select> is treated as </select>
      // * An <a> within <a> triggers the ... AAA
      // * <image> gets converted to <img> (TODO)

      if (tag[0] === T.StartTag && flags & (E.select | E.a)) {

        if (flags & E.select && frame.closable & E.select)
          tag = makeTagToken (T.EndTag, tag.name)

        else if (flags & E.a && frame.closable & E.a) {
          const index = stack1.openerFor ('a', E.a)
          stack1.close (index, 'a')
        }
      
      }
    
      // ### End Tag - Exceptions

      // * </br> tags are converted to <br> without attrs
      // * before the head, </body> and </html> are converted to start tags
      // * after the head </body> and </html> are ignored (TODO they do affect the parent of comments and space)
      // * before the head, </head> is converted to <head></head> (and may be ignored otherwise)
      // * An unmatched </p> gets converted to <p></p>.

      else if (tag[0] === T.EndTag && flags & (E.br | E.body | E.html | E.head | E.p)) {

        if (flags & E.br)
          tag = makeTagToken (T.StartTag, tag.name)

        else if (flags & (E.body | E.html)) {
          if (afterHead) continue // ignore
          else tag = makeTagToken (T.StartTag, tag.name)
        }

        else if (flags & E.head && !afterHead) {
          const ins = makeTagToken (T.StartTag, tag.name)
          const st = stack1.prepareFor (ins, flags)
          if (st) st.open (ins, flags)
          document.head = head = _arr[0].node
          afterHead = true
        }

        else if (flags & E.p && !(frame.closable & E.p)) {
          const st = stack1.prepareFor (tag, flags)
          if (st) st._arr[0].node.push (new Node (tag))
        }

      }
    
      // ### Default branch

      switch (tag[0] & typeMask) {

        case T.EndTag: {
          // log ('end tag', stack1.info, '::', tag.name)
          // TODO h1-h6 end-tags should not be fostered, amongst others.
          if (flags & C.h1_h6) index = stack1.openerFor (C.h1_h6, flags)
          else index = stack1.openerFor (tag.name, flags)
          if (index >= 0) stack1.close (index, tag.name)
        }

        break; case T.Comment: case T.Bogus:
          frame.node.push (tag)

        break; case T.PlainText: case T.RawText: case T.RcData:
          frame.node.push (tag[1])

        break; case T.StartTag: {
          // log ('start tag', stack1.info, '::', tag.name)
          const st = stack1 .prepareFor (tag, flags)

          if (st) {
            if (flags & C.void || tag.selfclose && st._arr[0].foreign)
              st._arr[0].node.push (new Leaf (tag))
            else
              st.open (tag, flags)
          }
        }

        break; case T.Data: {
          // log ('start tag', stack1.info, '::', tag.name)
          const flags = tag[0] & tokenRoles.Space ? C.SPACE : C.TEXT
          const st = stack1 .prepareFor (tag[1], flags)
          if (st) st._arr[0].node.push (tag[1])
        }
      }
    }
    return self
  }
  
  // Adjust TagNames and attributes
  
  function adjustToken (token) {
    const t = token[0]
    if (t === T.StartTag || t === T.EndTag) {
      token.name = token.name.toLowerCase ()
      if (_arr[0].closable & E.svg && token.name in SVGTagNameAdjustments)
        token.name = SVGTagNameAdjustments [token.name]
    }
    return token
  }

}


// Stack of open elments
// ---------------------

function Stack (arr = []) {
  const self = this
  const stack = arr // stack of open elements
  let reopen = []   // implicit formatting tags
  let counts = {}   // index on reopen

  define (this, { info: { get: infoString }, _reopen: { get: () => reopen } })
  assign (this, { openerFor, open, reformat, close, prepareFor, _arr:stack })

  // ### Info String
  // Returns a string representation of the stack

  function infoString () {
    return stack.map (({ node }) => node.name). reverse () .join (' ')
  }

  // ### Prepare For
  // TODO implement the quirksmode differences / closing of p elems
  // tag must be a StartTag or Data (or Space...)

  function prepareFor (tag, flags) {
    for (;;) {
      const frame = stack[0]

      if (frame.content & flags) {
        return flags & C.reformat ? self.reformat () : self
      }

      else if (frame.openFor & flags) {
        const name = flags & C.TEXT ? '#text' : tag.name
        const ins = frame.paths[name] || frame.paths['#default']
        // log ('\tinsert implicit', self.info, '::', ins)
        const insFlags = elementInfo [ins] || defaultInfo
        open ({ name:ins }, insFlags)
      }

      else if (frame.openable & flags)
        close (0, tag.name)

      else return null
    }
  }

  // ### Open
  // Creates a new node; appends it to the current node,

  function open (tag, flags = elementInfo [tag.name] || defaultInfo) {
    // log ('\topen', tag.name)
    const node = new Node (tag)
    const frame = deriv (stack[0], node, flags, getRule (stack[0], node.name, flags))
      node.frame = frame // for debug
    if (flags & E.table) {
      frame.parent = stack[0].node
      frame.fosterStack = new Stack (stack.slice (0))
      frame.fosterStack._arr[0].content = C.bodyContent 
        // NB!! Changes the allowed content of the foster parent!
    }
    else stack[0].node.push (node)
    stack.unshift (frame)
    // log ('after open', self.info)
    return stack[0]
  }

  // ### Reformat
  // Reopens formatting elements

  function reformat (_reopen = reopen) {
    for (const { node, flags } of _reopen) open (node, flags)
    reopen = [], counts = {}
    return self
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

  function close (n = stack.length-1, _name = null) {
    if (!stack.length) return
    const closeFlags = stack [n = (n < 0 ? 0 : n)] .flags
    let aaa, frame;

    for (; n >= 0; n--) {
      frame = stack.shift ()
      const { flags, node: { name } } = frame
      // log ('close', name)

      if (flags & C.special && closeFlags & C.format) // REVIEW which tags trigger the aaa?
        aaa = { frame, index:reopen.length, parent:stack[0] }

      else if (flags & C.formatContext)
        (aaa = null, reopen = [], counts = {})

      else if (flags & C.format && name !== _name) {
        const count = counts [name] = (counts [name] || 0) + 1
        if (count <= 3) reopen.unshift (frame)
      }

      // Hack/ for postponed append of table nodes
      if (frame.parent) frame.parent.push (frame.node)

      // Hack: modify the parent context to afterHead, afterFrameset
      else if (flags & E.head) {
        stack[0] = deriv (stack[1], stack[0].node, stack[0].flags, afterHeadRule)
        afterHead = true
      }
      else if (flags & E.frameset)
        stack[0] = deriv (stack[1], stack[0].node, stack[0].flags, afterFramesetRule)
    }

    // AAA algorithm
    if (aaa) {
      const split = reopen.length - aaa.index
      const reopen1 = reopen.slice (0, split)
      const reopen2 = reopen.slice (split)
      
      const _pop = aaa.parent.node.children.pop () // REVIEW make sure this is block.node
      const block = aaa.frame.node, blockFlags = aaa.frame.flags

      log (block.name)
      if (blockFlags & C.special) {
        reformat (reopen1)
      }

      const ins = new Node ({ name:_name }),
        insFlags = elementInfo [ins.name] || defaultInfo
      ins.children = block.children
      block.children = [ins]

      stack[0].node.push (block)
      const frame1 = deriv (stack[0], block, blockFlags, getRule (stack[0], block.name, blockFlags))
      stack.unshift (frame1)
      reformat (reopen2)
    }
  }

}

// Stack Frame
// -----------
// 'deriv' takes a parser context and the name/flags of an open element
// and returns a new parser context. The context is computed from the
// 'schema' and specifies how to handle misnested and misplaced tags.

// properties: foreign, content, openFor, paths, foster
// modifiers: allowEnd, escalate, allow, forbid

function deriv (frame, node, flags, rule) {
  let { closable, openable, fosterStack } = frame
  let {
    // properties
    foreign = frame.foreign,
    content = frame.content,
    openFor = 0n, paths,
    foster  = 0n,
    // modifiers
    allowEnd = C.any,
    escalate = C.any,
    allow    = C.none,
    forbid   = C.none } = rule

  closable = (closable & allowEnd) | flags
  content  = (content  &~ forbid)  | allow
  openable = (openable & escalate) | content | openFor
  
  return { node, flags, foreign, closable, content, openable,
    openFor: (openFor &~content), paths,
    foster:  (foster &~ content), fosterStack } // TODO precompute openFor and foster, if possible
}


function frameInfo ({ node, flags, closable, content, openable, openFor = 0n, paths }) {
  return {
    name: node.name,
    flags:    printInfo (flags),
    closable: printInfo (closable),
    openable: printInfo (openable),
    content:  printInfo (content),
    openFor:  printInfo (openFor),
    paths,
    node
  }
}


// Exports
// -------

assign (TreeBuilder, { Document, Leaf, Node, frameInfo })
module.exports = TreeBuilder