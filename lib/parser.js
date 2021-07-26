const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object
const { tokenTypes:T, tokenRoles, typeName, typeMask } = require ('../lib/lexer')
const { makeTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const { elements:E, tagNameSets:C, SVGTagNameAdjustments,
  elementInfo, defaultInfo, printInfo,
  documentRule, afterHeadRule, afterFramesetRule, getRule } = require ('./schema.js')


// The parser
// ==========

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, _arr
  define (this, { document: { get: $=> document }})
  assign (this, { reset, write, batchWrite, end })
  return reset ()

  // ### Init / reset

  function reset () {
    head = body = null
    document = new Document ()
    const { content, openFor, paths } = documentRule
    _arr = [{ node:document, flags:C.none, closable:C.none, content, openable:C.any, openFor, foster:0n, paths } ]
    stack = new Stack (_arr, 0)
    return self
  }

  // ### Write and End

  function write (tag) {
    return batchWrite ([tag])
  }

  function end () {
    const st = stack._arr
    // Close up to but excluding the <body> or <frameset>
    const n = Math.min (4, st.length-4)
    if (st.length < 4) // If we're higher up, create it
      self.write (makeTagToken (T.StartTag, 'body'))
    stack.close ()
    // TODO prevent more writes
    return self
  }

  // ### Main loop

  function batchWrite (tags) {
    for (let tag of tags) {
      // log (typeName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.info);

      // Adjust Tag names
      tag = adjustToken (tag)

      // Get flags -- TODO clean up
      const type = tag[0] & typeMask
      let flags = (type === T.Data)
        ? (tag[0] & tokenRoles.Space ? C.SPACE : C.TEXT)
        : elementInfo [tag.name] || defaultInfo
      
      // log (tag, printInfo (flags))

      // Select the appropriate stack
      const fosterStack = _arr[0].fosterStack
      let stack1 = _arr[0].foster & flags && fosterStack || stack
      // FIXME case T.PlainText: case T.RawText: case T.RcData
      let frame = stack1._arr[0]

      // if (stack1 === fosterStack)
      //   log ('foster parenting', tag.name)


      // ### Start Tag - Exceptions

      // * <select> within <select> is treated as </select>
      // * An <a> within <a> triggers the ... AAA
      // * Likewise for <nobr>
      // * <image> gets converted to <img> (TODO)

      if (type === T.StartTag && flags & (E.select | E.a | E.nobr)) {

        // log ('start tag exception', tag.name)
        if (flags & E.select && frame.closable & E.select)
          tag = makeTagToken (T.EndTag, tag.name)

        else if (flags & E.a && frame.closable & E.a) {
          const index = stack1.openerFor ('a', E.a)
          stack1.close (index, 'a')
        }

        else if (flags & E.nobr && frame.closable & E.nobr) {
          const index = stack1.openerFor ('nobr', E.nobr)
          stack1.close (index, 'nobr')
        }
      
      }
    
      // ### End Tag - Exceptions

      // * </br> tags are converted to <br> without attrs
      // * An unmatched </p> gets converted to <p></p>.
      // * before the head unmatched </body> and </html> tags are converted to start tags
      // * before the head, </head> is converted to <head></head>
      // * after the head </body> and </html> are ignored (TODO they do affect the parent of comments and space)

      else if (type === T.EndTag && flags & (E.br | E.body | E.html | E.head | E.p)) {
        // log ('End tag exception', stack1.info, '::', tag.name, 'after head?', stack1.afterHead)

        if (flags & E.br)
          tag = makeTagToken (T.StartTag, tag.name)

        else if (flags & E.p && !(frame.closable & E.p)) {
          const st = stack1.prepareFor (tag, flags)
          if (st) st._arr[0].node.push (new Node (tag))
          continue
        }

        else if (flags & E.html && frame.closable & E.html)
          continue

        else if (flags & E.body) {
          if (frame.closable & E.body) continue
          else if (!stack1.afterHead) tag = makeTagToken (T.StartTag, tag.name)
        }

        else if (flags & E.head && !(frame.closable & E.head)) {
          const ins = makeTagToken (T.StartTag, tag.name)
          const st = stack1.prepareFor (ins, flags)
          if (st) {
            stack1 = st.open (ins)
            frame = stack1._arr[0]
          }
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
          const st = stack1 .prepareFor (tag, flags)
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

function Stack (arr = [], min = 0) {
  const self = this
  self.afterHead = false
  const stack = arr  // stack of open elements
  const _min = min  // don't close beyond _min length
  let reopen = []    // implicit formatting tags
  let counts = {}    // index on reopen

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
    // log ('\nprepareFor', self.info, '::', tag.name || '#'+typeName (tag[0]))
    for (;;) {
      // if (!stack.length) return
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

      else if (frame.openable & flags) {
        if (close (0, tag.name) === null) return null
        // log ('\timplicitly closed to', self.info)
      }

      else {
        // log ('\tprepare ended in failure', self.info)
        return null
      }
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
      const fstack = frame.fosterStack = createFosterStack ()
        // NB!! Changes the allowed content of the foster parent!
      fstack._arr[0].content = C.bodyContent 
      fstack.afterHead = true // yeah
    }
    
    // TODO we can use the same system to redirect space/ comments and meta tags
    // into the head / after the body / ea.
    
    else stack[0].node.push (node)
    stack.unshift (frame)
    // log ('after open', self.info)
    return self
  }

  function createFosterStack (arr = [stack[0]]) {
    const fstack = new Stack (arr, 1)
    fstack._arr[0].closable = C.none
    fstack._arr[0].openable = C.none
    fstack._arr[0].escalate = C.none
    return fstack
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
  // close () defaults to closing all but the last element

  function close (n = stack.length-2, _name = null) {
    const closeFrame = stack [n]
    if (!closeFrame || n < min) return null

    const closeFlags = closeFrame.flags
    let aaa, frame;

    for (; n >= 0; n--) {
      frame = stack.shift ()
      const { flags, node: { name } } = frame

      if (flags & C.special && closeFlags & C.format)
        aaa = { frame, index:reopen.length, parent:stack[0] }

      else if (flags & C.formatContext)
        (aaa = null, reopen = [], counts = {})

      else if (flags & C.format && name !== _name) {
        const count = counts [name] = (counts [name] || 0) + 1
        if (count <= 3) reopen.unshift (frame)
      }

      // NB Hack/ for postponed append of table nodes
      if (frame.parent) frame.parent.push (frame.node)

      // ### Sibling relations - NB Hack

      else if (flags & (E.head | E.frameset)) {
        const siblingRule = flags & E.head ? afterHeadRule : afterFramesetRule
        stack[0] = deriv (stack[1], stack[0].node, stack[0].flags, siblingRule)
        
        if (flags & E.head) {
          self.afterHead = true
          stack[0].fosterStack = createFosterStack ([frame])
        }
      }
    }

    // ### AAA algorithm

    if (aaa && stack.length) {
      const split = reopen.length - aaa.index
      const reopen1 = reopen.slice (0, split)
      const reopen2 = reopen.slice (split)
      
      const _pop = aaa.parent.node.children.pop () // REVIEW make sure this is block.node
      const block = aaa.frame.node, blockFlags = aaa.frame.flags

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
    
    return self
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
  // log ('deriv', frame.node.name, node.name)
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


function frameInfo ({ node, flags, closable, content, openable, openFor = 0n, paths, foster, fosterStack }) {
  return {
    name: node.name,
    flags:    printInfo (flags),
    closable: printInfo (closable),
    openable: printInfo (openable),
    content:  printInfo (content),
    openFor:  printInfo (openFor),
    paths,
    foster:   printInfo (foster),
    fosterParent: fosterStack && fosterStack._arr[0].node.name,
    node
  }
}


// Exports
// -------

assign (TreeBuilder, { Document, Leaf, Node, frameInfo })
module.exports = TreeBuilder