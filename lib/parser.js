'use strict';
const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks, tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeStartTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const {
  elements:E, categories:C,
  elementInfo, defaultInfo, printInfo,
  rules, defaultRule, documentRule, afterHeadRule, deriv } = require ('./schema.js')


// The parser
// ==========

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, afterHead
  reset ()

  assign (this, { reset, write, batchWrite /*end*/ })
  define (this, {
    document: { get: $=> document },
    state: { get: $=> stack.map (({ node }) => node.name). reverse () .join (' ') },
  })

  // Start/ reset

  function reset () {
    document = new Document ()
    head = body = null
    const { content, paths, rules, recover } = documentRule
    stack = [ { node:document, flags:defaultInfo, rules, content, paths, recover } ]
    afterHead = false
  }

  // Main loop
  function write (tag) {
    batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) { 
      // log (tokenName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.state);
      
      // Exception: </br> tags are converted to <br> tags
      if (tag.name === 'br' && tag[0] === T.EndTag)
        tag[0] = T.StartTag

      switch (tag [0]) {
      case T.EndTag:
        endTag (tag, elementInfo [tag.name] || defaultInfo)

      break; case T.Comment: case T.Bogus:
        stack[0].node.push (tag)

      break; case T.FormatTag: case T.FormatEndTag:
        stack[0].node.push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        stack[0].node.push (tag[1])
    
      break; case T.StartTag:
        const flags = elementInfo [tag.name] || defaultInfo
        // Exception: <select> as a child of <select> is treated as </select>
        if (tag.name === 'select' && close ('select', flags).length) continue;
        if (prepareForInsert (tag, flags)) open (tag, flags)

      break; case T.Data: {
        const flags = elementInfo ['#text']
        if (prepareForInsert (tag[1], flags)) stack[0].node.push (tag[1])
      }
    }}
    return self
  }


  // endTag handler
  
  function endTag (tag, flags) {
    const { name } = tag
    log (`</${tag.name}> ?`)

    // Exception: mismatched </p> tags get converted to <p></p>
    if (name === 'p' && openerFor ('p', flags) < 0) {
      const tag_ = makeStartTagToken (name)
      if (prepareForInsert (tag_, flags)) append (tag_) // NB not opened
      return
    }

    // Find a matching open tag
    // Exception: each of </h1> .. </h6> matches each of <h1> .. <h6>
    let i = openerFor (flags & C.heading ? C.heading : tag.name, flags)
    if (i >= 0) {
      const closes = stack.splice (0, i+1)
      log (`\tcloses`, closes.map(_ => _.node.name).reverse ())
      return
      // REVIEW return always? what about the following?
    }

    // TODO body, html should use state to redirect comments and space (only) to other places. 
    if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = makeStartTagToken (name)
      prepareForInsert (ins, flags) && (open (ins), flags)
      if (flags & E.head) close (name, flags)
      return
    }
  }



  // OK this works, but I'd like to make it nicer, and it needs to change for the
  // table/ foster parenting to work

  function prepareForInsert (tag, flags) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '#text' : tag.name
    log (`<${name}> - prepareFor :: `, self.state)
    // log (stack)
    
    let fail = false
    const allowedIn = ({ content }) => {
      const r = content < 0 ? !(flags & ~content) : !!(flags & content)
      log (`<${name}> -- ${printInfo (flags)} -- allowedIn :: `, self.state, '--', printInfo (content), r)
      return r
    }

    let close
    while (!fail && ((close = stack[0].closeFor & flags) || !allowedIn (stack[0]))) {
      let mode = stack[0]
      if (close) stack.shift ()

      else if (mode.paths) {
        const ins = mode.paths[name] || mode.paths['#default']
        if (ins) {
          log ('insert implicit', ins)
          open (makeStartTagToken (ins))
        }
        else fail = true
      }

      else if (mode.recover === 'close')
        stack.shift ()

      else fail = true
    }


    if (fail) {
      if (stack[0].recover === 'ignore') {
        log ('prepare: ignoring tag ' + `<${name}>`)
        return false
      }
      const notAllowed = `TreeBuilder error:\n\t<${name}> is not allowed in context ${self.state}`
      throw new Error (notAllowed)
    }
    else return true
  }


  // Stack management
  // ----------------
  // Open: Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag, flags = elementInfo [tag.name] || defaultInfo) {
    const node = append (tag, flags)
    const { name } = node
    if (node instanceof Node) {

      const _frame = deriv (stack[0], name)
      _frame.node = node
      _frame.flags = flags
      stack.unshift (_frame)

      // Well, now it's all over the place..
      if (flags & E.head) {
        document.head = head = node
        assign (stack[stack.length-2], afterHeadRule) // Well, upon close anyway
      }
      // Hack -- ondody hook
      else if (flags & E.body) {
        document.body = body = node
        if (delegate && delegate.onBodyStart)
          delegate.onBodyStart (document, head)
      }
    }
    return node
  }

  function append (tag, flags = elementInfo [tag.name] || defaultInfo) { // Adds a childNode to the current node
    const { name } = tag
    const node = flags & C.void ? new Leaf (tag) : new Node (tag)
    stack[0].node.push (node)
    return node
  }

  function close (name, flags) {
    let i = openerFor (name, flags)
    if (i >= 0) return stack.splice (0, i+1)
    return []
  }

  // search may be a string (tagName) or a number (elementInfo)
  function openerFor (search, searchFlags) {
    let index = -1
    for (let i=0, l=stack.length; i<l; i++) {
      const { node, flags, closedBy } = stack[i]
      log (node.name, 'closedBy', printInfo (closedBy), '\n-- compare', search, printInfo (searchFlags))
      if (search === node.name || typeof search === 'number' && flags & search) { index = i; break }
      if (!(searchFlags & closedBy)) break
    }
    return index
  }

}


// Exports
// -------

module.exports = { TreeBuilder, Leaf, Document, Node }