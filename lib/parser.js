const log = console.log.bind (console)
const { assign, defineProperties: define, setPrototypeOf: setProto } = Object
const { chunks, tokenTypes:T, tokenName } = require ('../lib/lexer')
const { makeStartTagToken } = require ('../lib/tokens')
const { Document, Leaf, Node } = require ('../lib/dom')
const {
  elements:E, categories:C,
  elementInfo, defaultInfo, printInfo,
  documentRule, afterHeadRule, getRule } = require ('./schema.js')


// The parser
// ==========

function TreeBuilder (delegate) {
  const self = this
  let document, head, body, stack, fosterParent, afterHead
  let stacks
  reset ()

  assign (this, { reset, write, batchWrite /*end*/ })
  define (this, {
    document: { get: $=> document },
    state: { get: $=> _stack.map (({ node }) => node.name). reverse () .join (' ') },
  })

  // ### Init / reset

  function reset () {
    document = new Document ()
    head = body = fosterParent = null
    const { content, paths } = documentRule
    _stack = [ { node:document, flags:0, scope:0, closeFor:0, content, paths } ]
    afterHead = false
    return self
  }

  // ### Main loop

  function write (tag) {
    return batchWrite ([tag])
  }

  function batchWrite (tags) {
    for (let tag of tags) {
      // // log (tokenName(tag[0]), (tag.name ? tag.name : ''), 'in ', self.state);

      switch (tag[0]) {
      case T.EndTag: {
        const flags = elementInfo [tag.name] || defaultInfo
        // Exception: </br> tags are converted to <br> tags (TODO minus attrs)
        if (tag.name === 'br') prepareForInsert (tag, flags) && open (tag, flags)
        else endTag (tag, flags)
      }

      break; case T.Comment: case T.Bogus:
        _stack[0].node.push (tag)

      break; case T.FormatTag: case T.FormatEndTag:
        _stack[0].node.push (tag)

      break; case T.Space: case T.PlainText: case T.RawText: case T.RcData:
        _stack[0].node.push (tag[1])
    
      break; case T.StartTag:
        const flags = elementInfo [tag.name] || defaultInfo
        // Exception: <select> within <select> is treated as </select>
        if (flags & E.select && _stack[0].scope & E.select)
          endTag (tag, flags)
        else {
          const st = prepareForInsert (tag, flags)
          if (st) {
            open (tag, flags, st) // FIXME case foster parenting
          }
        }

      break; case T.Data: {
        const flags = C.TEXT
        const st = prepareForInsert (tag[1], flags)
        if (st) st[0].node.push (tag[1])
      }
    }}
    return self
  }
  
  // ### endTag handler
  // Note, each of </h1> .. </h6> matches each of <h1> .. <h6>.
  // An unmatched </p> gets converted to <p></p>.

  function endTag (tag, flags) {
    if (!(_stack[0].scope & flags)) // SPEED :D
      return

    let index =
      openerFor (flags & C.h1_h6 ? C.h1_h6 : tag.name, flags)

    if (index >= 0) {
      const closes = _stack.splice (0, index + 1)
      // log (`\tcloses`, closes.map(_ => _.node.name).reverse ())
    }

    else if (tag.name === 'p') {
      tag = makeStartTagToken ('p')
      if (prepareForInsert (tag, flags)) append (tag, flags)
    }

    // TODO body, html should use state to redirect comments and space (only) to other places. 
    else if (!afterHead && flags & (E.head | E.body | E.html)) {
      const ins = makeStartTagToken (tag.name)
      prepareForInsert (ins, flags) && (open (ins), flags)
      if (flags & E.head) close (tag.name, flags)
      return
    }
  }

  // ### The heart of the parsing algorithm
  // TODO clean up and add implement foster parenting

  function prepareForInsert (tag, flags, stack = _stack) { // tag must be a StartTag or Data
    const name = typeof tag === 'string' ? '#text' : tag.name
    let close = false, current, target, foster = false

    // log (`<${name}> - prepareFor :: `, self.state)

    const allowedIn = ({ content }) => {
      const r = content < 0 ? !(flags & ~content) : !!(flags & content)
      // log (`<${name}> -- ${printInfo (flags)} -- allowedIn :: `, self.state, '--', printInfo (content), r)
      return r
    }

    current = target = stack[0]
    while (current && ((close = current.closeFor & flags) || !allowedIn (current))) {
      let ins, { paths } = current

      if (close) {
        // log ('implicit close', self.state)
        stack.shift ()
        current = stack[0]
      }

      else if (paths && (ins = paths[name] || paths['#default'])) {
        log ('insert implicit', self.state, '::', ins)
        const tag = makeStartTagToken (ins), flags = elementInfo [tag.name] || defaultInfo
        current = open (tag, flags, stack)
        current = stack[0]
      }

      else if (current.flags & (E.table | C.tbody | E.tr)) {
        let i=0;
        while (stack[i].flags & (E.table | C.tbody | E.tr)) i++
        return prepareForInsert (tag, flags, stack.slice (i))
      }

      else {
        // log ('failed to insert', tag)
        current = target = null
      }
    }
    
    return target ? stack : null
  }

  // ### Open
  // Creates a new node; appends it to the current node,
  // and adds it to the stack if it is not a void-element. 

  function open (tag, flags = elementInfo [tag.name] || defaultInfo, stack = _stack) {
    log ('open', tag.name)

    const node = append (tag, flags, stack)
    if (node instanceof Node) {
      stack.unshift (deriv (stack[0], node, flags))

      // Well, now it's all over the place..
      if (flags & E.head) {
        document.head = head = node
        assign (stack[stack.length-2], afterHeadRule)
        afterHead = true // Well, upon close anyway
      }

      else if (flags & E.body) { // Hack // onbody hook
        document.body = body = node
        if (delegate && delegate.onBodyStart)
          delegate.onBodyStart (document, head)
      }
    }
    return stack[0]
  }

  // ### Append
  // Adds a childNode to the current node.

  function append (tag, flags, stack = _stack) {
    // log ('append', self.state, '::', tag.name, fosterParent ? '/fosterParent ' + fosterParent.node.name : '')
    const node = flags & C.void ? new Leaf (tag) : new Node (tag);
    stack [0] .node .push (node)
    return node
  }

  function close (name, flags, stack = _stack) {
    let i = openerFor (name, flags)
    if (i >= 0) return stack.splice (0, i+1)
    return []
  }

  // ### Opener For
  // Finds a matching open tag-index for an end tag, given the schema.
  // search may be a string (tagName) or a number (elementInfo)

  function openerFor (search, searchFlags, stack = _stack) {
    let index = -1
    for (let i=0, l=stack.length; i<l; i++) {
      const { node, flags, allowEnd } = stack[i]
      // log (node.name, 'allowEnd?', printInfo (allowEnd), '\n-- compare', search, printInfo (flags), printInfo (searchFlags))
      if (search === node.name || typeof search === 'number' && flags & search) { index = i; break }
      if (!(searchFlags & allowEnd)) break
    }
    return index
  }

  // 'deriv' takes a parser context and the name/flags of an open element
  // and returns a new parser context. The context is computed from the
  // 'schema' above and specifies how to handle misnested and misplaced tags.

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

}


// Exports
// -------

module.exports = { TreeBuilder, Leaf, Document, Node }