'use strict';
const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object

const { chunks, tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeStartTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const {
  elements:E, categories:C,
  elementInfo, defaultInfo, printInfo,
  boundarySets, defaultBoundarySet,
  rules, defaultRule, deriv } = require ('./schema.js')

C.document = 0 // For the time being
const documentRule = rules['#document']

// Handling of Start Tags
// ----------------------

// By default, before any new element is inserted, the stack will be
// searched one or more times, for a specific element in a specific 
// scope to close -- to prepare the context for insertion. 

// At the moment the behaviour of other open tags is encoded via
// the closeForTag method in the TreeBuilder class below. 

// The parser
// ----------

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
    let { negate = false, allowed, paths, rules, recover } = documentRule
    stack = [ { node:document, flags:defaultInfo, rules, negate, allowed, paths, recover } ]
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
        stack[0].node.push (tag)

      break; case T.FormatTag: case T.FormatEndTag:
        stack[0].node.push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        stack[0].node.push (tag[1])
    
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
        if (prepareForInsert (tag[1], info)) stack[0].node.push (tag[1])
      }

    }}
    return self
  }


  // closeForTag: called before inserting a new element. 

  function closeForTag (tag, info) { // tag must be a StartTag or data
    // TODO html and body should merge attributes onto existing

    const name = typeof tag === 'string' ? '#text' : tag.name
    // log ('closeForTag', self.state, `:: <${name}>`, info & C.cell)

    if (name === 'dd') {
       closeInScope (C.dddt, C.li_scope, 'p', C.pgroup)
    }

    if (name === 'dt')
      closeInScope ( C.dddt, C.li_scope, 'p', C.pgroup)

    if (name === 'li')
      closeInScope ('li', C.li_scope, 'p', C.pgroup)

    if (name === 'button')
      closeInScope ('button', C.scope )

    if (info & C.heading)
      return closeInScope ('p', C.pgroup, C.heading, ~0)

    return []
  }

  // OK this works, but I'd like to make it nicer, and it needs to change for the
  // table/ foster parenting to work

  function prepareForInsert (tag, flags) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '#text' : tag.name
    log (`<${name}> - prepareFor :: `, self.state)
    // log (stack)
    
    let fail = false
    const allowedIn = ({ allowed, negate = false }) => {
      const r = negate ? !(flags & allowed) : !!(flags & allowed)
      log (`<${name}> - ${printInfo (flags)} - allowedIn :: `, self.state, negate ? ' -- negate ' : ' -- ' + printInfo (allowed), r)
      return r
    }

    let close
    while (!fail && ((close = stack[0].closeFor & flags) || !allowedIn (stack[0]))) {
      let mode = stack[0]
      if (close) {
        const name = stack[0].node.name
        const bounds = name in boundarySets ? boundarySets [name] : defaultBoundarySet
        log (`prepare close <${name}> - boundarySets`, printInfo (bounds))
        closeInScope (name, bounds) // REVIEW
      }

      else if (mode.paths) {
        const ins = mode.paths[name] || mode.paths['#default']
        if (ins) {
          log ('insert implicit', ins)
          open (makeStartTagToken (ins))
        }
        else fail = true
      }

      else if (mode.recover === 'close')
        closeInScope (stack[0].node.name)

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


  // endTag handler
  
  function endTag (tag, flags) {
    const { name } = tag
    log (`</${tag.name}> :: ${self.state}`)

    // br gets converted to a start tag, and p may insert a start tag if absent.
    if (name === 'br' || name === 'p' && findInScope ('p', C.pgroup) < 0) {
      const tag_ = makeStartTagToken (name)
      const closes = closeForTag (tag_, flags)
      if (prepareForInsert (tag_, flags)) append (tag_) // NB not opened
      return
    }

    // TODO body, html should set flags to redirect comments and space (only) to other places. 
    if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = makeStartTagToken (name)
      prepareForInsert (ins, flags) && (open (ins), flags)
      if (flags & E.head) closeInScope (name, C.scope)
      return
    }

    if (flags & C.heading)
      return closeInScope (C.heading, C.scope)

    if (name in boundarySets) {
      log ('=====', 'close', name, printInfo (boundarySets[name] || defaultBoundarySet))
      return closeInScope (name, boundarySets [name] || defaultBoundarySet)
    }

    return closeInScope (name, defaultBoundarySet)
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
        assign (stack[stack.length-2], rules['<afterHead>']) // Well, upon close anyway
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

  // ...closeList may be a sequence [names, scope, names2, scope2, ..]
  // returns an array with the nodes that were closed

  function closeInScope (...closeList) {
    //log ('closeInScope', stack.map (_ => _.rule.name) .reverse(), '-', closeList)
    let start = 0
    for (let i=0, l=closeList.length; i<l; i+=2) {
      const [search, bounds] = [closeList[i], closeList[i+1] || C.document]
      log ('closeInScope', search, printInfo (search), printInfo (bounds), '?')
      const ix = findInScope (search, bounds, start)
      if (ix < 0) continue
      else start = ix + 1
    }
    const closes = stack.splice (0, start)
    if (closes.length) log ('closes', closes.map (_ => _.node.name) .reverse())
    return closes
  }


  function findInScope (search, bounds, start = 0) {
    let index = -1
    for (let i = start, l = stack.length; i<l; i++) {
      const { flags, node } = stack[i]
      if (typeof search === 'number' ? flags & search : node.name === search) { index = i; break }
      if (bounds & flags) break
    }
    return index
  }

}

module.exports = { TreeBuilder, Leaf, Document, Node }