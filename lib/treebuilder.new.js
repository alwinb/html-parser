const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const log = console.log.bind (console)

const hidden = (obj, dict) => {
  for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }

const getters = (obj, dict) => {
  for (const k in dict) def (obj, k, { get: dict[k], enumerable:false }) }


// Names, Kinds, Sets, and Rules
// -----------------------------

const {
  E, C, Any, None, printInfo, 
  elementInfo: kinds, defaultInfo: otherKind,
} = require ('./categories')

const { html, head, body } = E
const { getRule, SVGTagNameAdjustments } = require ('./schema')
const { tokenTypes:T, tokenRoles:R, typeName, typeMask } = require ('./lexer')


// Dom
// ---

function Node (name, attrs) {
  this.name = name
  if (attrs) this.attrs = attrs
  this.children = []
}

function Leaf (name, attrs) {
  this.name = name
  if (attrs) this.attrs = attrs
}


// Context / Stack-frame
// ---------------------

class Frame {
  
  constructor (context = { }, node) {
    const {
      namespace = None, 
      name = '#document', kind = None, children = None,
      closable = None, openable = None, content = Any,
      openFor = None, paths = null,
      redirect = None, target = null } = context

    node = node || new Node (name)
      hidden (node, { frame:this })
    assign (this, {
      namespace, name, kind, children,
      closable, openable, content,
      openFor, paths,
      redirect, target, node })
  }

  child (name, kind, node = new Node (name)) {
    // if (kind & this.content) {
      // this.children |= kind
      const {
        namespace = this.namespace,
        allowEnd = Any, escalate = Any, 
        content = this.content,
        allow = None, forbid = None,
        openFor = None, paths = null,
        redirect = None, target = this.target,
      } = getRule (this, name, kind, this.children)

      const content_ = content &~ forbid | allow
      const frame = setProto ({
        namespace, name, kind, children:None,
        closable: this.closable & allowEnd | kind,
        openable: this.openable & escalate | content | openFor,
        content: content_,
        openFor, paths,
        redirect, target, node
      }, Frame.prototype)
      hidden (node, { frame })
      return frame
    // }
    // return null
  }

  get info () {
    return {
      name: this.name,
      namespace: printInfo (this.namespace),
      kind:      printInfo (this.kind),
      children:  printInfo (this.children),
      closable:  printInfo (this.closable),
      openable:  printInfo (this.openable),
      content:   printInfo (this.content),
      openFor:   printInfo (this.openFor), paths: this.paths,
      redirect:  printInfo (this.redirect),
      target:    this.target && this.target.stack[0].info // && this.target.name
      // redirectParent: target && target[0].node.name,
      // node
    }
  }

}


// Tree Builder
// ------------

function TreeBuilder ({ root = new Frame (documentContext), minDepth = 2, document = root.node, verbose = false } = { }) {
  
  const self = this
  const stack = this.stack = [root]
  let tip = root
  this.closeCount = 0n
  hidden (this, { root, minDepth, tryOpen, prepare, append, tryClose, lookup, log })
  getters (this, { tip: () => stack [stack.length-1], document: () => document })

  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I limit to three, but one can construct schemas that allow 
  // any finite (or infinite) amounts.

  function prepare (name, kind) {
    log ('try prepare for ::', name)
    for (let i=0; i<3; i++) {
      // log ('loop', i)
      log ('is allowed ::', name, '('+printInfo (kind)+') ?', Boolean (kind & tip.content))// ,'in', tip.info, '?')
      if (kind & tip.content)
        return self

      if (kind & tip.openable) {
        log ('try escalate for ::', name)
        const cursor = escalate (name, kind)
        const closes = _close (cursor.index + 1)
        if (closes && closes.length)
          log (`OK - closed for open ::`, closes .map (_ => _.name) .join (' < ' ))
        if (cursor.done)
          return self
      }

      if (kind & tip.openFor) {
        log ('try extend for ::', name)
        const inserts = search (name, kind)
        if (inserts && inserts.path.length) {
          log ('path found ::', inserts.path.map (_ => _.name) .join (' > '))
          for (const tip_ of inserts.path) {
            // log ('==> append', tip_.name)
            tip.node.children.push (tip_.node)
            tip.children |= tip_.kind
            // log (tip.node)
            self.stack.push (tip = tip_)
          }
          log ('path opened ::', inserts.path.map (_ => _.name) .join (' > '))
          if (inserts.done)
            return self
        }
      }
    }
    log ('ERR - cannot prepare for ::', name)
    return null
  }

  function tryOpen (name, kind = kinds[name] || otherKind) {
    log ('try open ::', name)
    if (prepare (name, kind))
      return _open (name, kind)
    log ('ERR - cannot open ::', name)
    return self
  }

  function append (item, kind = kinds[item] || otherKind) {
    log ('try append ::', printInfo (kind))
    if (prepare (item.name, kind)) { // NB REVIEW passing item.name here
      tip.node.children.push (item)
      tip.children |= kind
      log ('appended', tip.info)
    }
    // TODO update sibling rules, childKinds, ..
    return self
  }


  function tryClose (name, kind = kinds[name] || otherKind) {
    log ('try close ::', name)
    const cursor = lookup (name, kind)
    if (cursor) {
      const closes = _close (cursor.index)
      if (closes) {
        log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
        return self
      }
    }
    log ('ERR - cannot close ::', name)
    return self
  }

  // Elementary operations

  function _open (name, kind) {
    const tip_ = tip.child (name, kind)
    // log ('finally, open', name)
    tip.node.children.push (tip_.node)
    tip.children |= kind // REVIEW
    self.stack.push (tip = tip_)
    // log ('OK - opened', name)
    return self
  }

  function _close (index = stack.length - 1) {
    if (index < self.minDepth) return null
    const closes = []; let kind = None
    while (stack.length > index) {
      const _pop = stack.pop ()
      kind = _pop.kind
      // kinds |= _pop.kind
      // self.closeCount |= _pop.kind
      closes.push (_pop) }
      log ('OK - closed ::', closes.map (_ =>_.name). join (' < '))
    _afterClose (kind)
    return closes
  }

  function _afterClose (kind) {
    // For the sibling rules, update the parent of _tip,
    // and thus, _tip as well
    const p = stack [stack.length-2]
    const _tip = stack.pop ()
    p.children |= kind // FIXME only imediate ones? these are all descendents
    tip = p.child (_tip.name, _tip.kind)
    tip.node = _tip.node
    tip.target = _tip.target
    stack.push (tip)
    log ('sibling-updated', _tip.info, '==>', tip.info)
  }
  
  // Querying
  
  function lookup (name, kind) { // tags to be closed for an endtag
    for (let i=stack.length-1; i>=0; i--) {
      if (stack[i].name === name)
        return { index:i, frame:stack[i] }
      if (!(stack[i].closable & kind))
        return
    }
  }

  function escalate (name, kind) { // to be closed for insert
    for (let i=stack.length-1; i >= 0; i--) {
      if (kind & stack[i].content)
        return { index:i, frame:stack[i], done:true }
      if (kind & stack[i].openFor)
        return { index:i, frame:stack[i], done:false }
    }
  }

  function search (name, kind) { // to be opened for insert
    const inserts = []
    let tip_ = tip, ins
    log ('search towards ::', name)
    while (tip_ && !(tip_.content & kind) && tip_.openFor & kind) {
      const name_ = name in tip_.paths ? tip_.paths[name] : tip_.paths['#default'] // NB was _default
      tip_ = tip_.child (name_, kinds[name_] || otherKind) // NB not doinf preprocessing here!
      inserts.push (tip_)
      // log ('search...', tip_)
    }
    return { path:inserts, done:tip_.content & kind } // ? { path:inserts } : null
    // REVIEW what about invalid schemas?
  }

  // Debugging

  function log (...msgs) {
    if (verbose)
      console.log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}

// ### Parameterised initial context
// TODO figure out how to manually set this up... :S

const documentContext = {
  name:'#document',
  content: E.html,
  openFor:Any,
  paths: { '#default':'html' } }

const bodyContext = {
  name: '#body',
  openable: C.bodyContent,
  content: C.bodyContent,
}

const headContext = {
  name: '#head',
  content: C.meta | C.SPACE, // TODO head after head does not allow space, or..
}

// Director
// --------

// Using the token types from the lexer, so far
// I may collect those somewhere else

const { StartTag:START, EndTag:END, Leaf:LEAF } = T
const TAG = START | END

function Director ({ verbose = false } = { }) {

  const self = this
  let builder, context
  hidden (this, { reset, write, end, batchWrite })
  getters (this, { document: () => builder.document })
  return reset ()

  function reset () {
    builder = new TreeBuilder ({ verbose })
    context = builder.tip
    return self
  }

  function write (token) {
    return batchWrite ([token])
  }

  function end () {
    // TODO REVIEW (quick hack)
    builder.tryOpen ('body')
    return self
  }

  // ### batchWrite
  // tokens are tuples [tokenType, string], just, for now

  function batchWrite (tokens) {
    // TODO need a one-token delay, to mark leading space as text
    for (let [t, name, attrs] of tokens)  { 
      context = builder.tip

      // SVG Tag name adjustments
      if (t & TAG) {
        name = name.toLowerCase ()
        if (context.namespace & E.svg)
          name = SVGTagNameAdjustments [name.toLowerCase ()] || name
      }

      const kind = t & (START|END)
        ? kinds [name] || otherKind
        : t & R.Space ? C.SPACE : C.TEXT // FIXME quick hack

        // log ([t,name,attrs], typeName (t), printInfo (kind))
      
      
      // #### End tags

      if (t === END) {

        if (kind & E.br)
          handler (new Leaf (name), E.br, LEAF)

        else if (kind & E.p && !(context.closable & E.p)) {
          // TODO figure out how this should be redirected!
          handler (name, E.p, START)
          handler (name, E.p, END)
        }
      
        // TODO last remaining case: h1/h6 mismatched start/end tags

        else if (kind & E.body) {
          if (context.kind & E.html && !(builder.closeCount & E.head))
            handler (name, kind, START)
          else continue
        }

        else if (kind & E.head && !(context.closable & E.head)) {
          handler (name, kind, START)
          handler (name, kind, END)
        }

        else
          handler (name, kind, END)
      }

      // #### Start tags

      else if (t === START) {

        if (kind & E.select && context.closable & E.select)
          handler (name, kind, END)

        else if (kind & E.image)
          handler (new Leaf ('img', attrs), E.img, LEAF)

        // Attribute-based
        // TODO check on lowercased attributes

        else if (kind & E.input && attrs && 'type' in attrs && attrs.type.toLowerCase () === 'hidden')
          handler (new Leaf (name, attrs), C.hiddenInput, LEAF)

        else if (kind & E.font && ('color' in attrs || 'face' in attrs || 'size' in attrs))
          handler (name, C.htmlFont, START) // TODO also fix up ends then

        else if (kind & C.annotationXml) {
          // TODO also adapt the close tag then
          let kind_ = C.annotationXml
          if (attrs && ('encoding' in attrs) && context.namespace & E.math) {
            const v = attrs.encoding.toLowerCase ()
            if (v === 'text/html' || v === 'application/xhtml+xml')
              kind_ = C.annotationHtml
          }
          handler (name, kind_, START)
        }
        
        // TODO handle self-closing tags as leafs, too

        else if (kind & C.void)
          handler (new Leaf (name), kind, LEAF)

        else
          handler (name, kind, START)
      }

      // #### Leafs

      else {
        handler (name, kind, LEAF)
      }
    }
    return self
  }
  
  // ### Token Handler / Director
  // Direct to the appropriate target

  function handler (item, kind, type) {
    let target = builder
    // log (item, printInfo(kind), type, 'redirect?', context.redirect & kind && context.closable & E.table)
    // log ('should redirect ?', printInfo(kind), Boolean (context.redirect & kind))

    if (context.redirect & kind) {
      if (context.closable & E.table) {
        // TODO: finding the appropriate 'foster parent' -- can this be more quick?
        const frame = builder.lookup ('table', E.table) .frame
        target = frame.target || target
      }
      else target = builder.tip.target || target
      // log ('selected target ::', target.tip.info)
    }

    if (type === START) {

      if (kind & E.head && builder.prepare (item, kind)) {
        const frame = builder.lookup ('html', E.html) .frame
        builder.tryOpen (item, kind)
        const ctx = builder.tip
        frame.target = new TreeBuilder ({ root: new Frame (ctx, ctx.node), minHeigth:1 })
        return builder
      }

      else if (kind & E.table && target.prepare (item, kind)) {
        // Hmm This is yet more complicated
        const collector = new TreeBuilder ({ root: new Frame (bodyContext), minHeigth:1 })
        target.tip.target = collector
        target.tip.node.children.push (collector.document)
        target.tryOpen (item, kind)
        return target
      }

      return target.tryOpen (item, kind)
    }

    if (type === END)
      return target.tryClose (item, kind)

    else
      return target.append (item, kind)
  }

}


// Exports
// -------

Object.assign (Director, { Node, Leaf, Frame, START, END, LEAF, Director, _private: { C, E } })
module.exports = Director