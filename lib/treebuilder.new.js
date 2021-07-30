const { defineProperty:def, assign } = Object
const log = console.log.bind (console)

const hidden = (obj, dict) => {
  for (const k in dict) def (obj, k, { value: dict[k], enumerable:false }) }

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
const { tokenTypes:T, tokenRoles, typeName, typeMask } = require ('./lexer')


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
  
  constructor (name, kind, context = { }, node) {
    // TODO I want to clean this up now too
    const {
      namespace = None,
      content = Any,
      closable = None,
      openable = None, 
      openFor = None, paths = null,
      redirect = None, target = null } = context

    assign (this, {
      namespace,
      name, kind,
      closable: closable | kind,
      openable: openable | content | openFor,
      content,
      openFor, paths,
      redirect, target })

    this.children = 0n
    this.node = node || new Node (name)
      hidden (this.node, { frame:this }) // REVIEW for debug 
  }

  child (name, kind, node) {
    // if (kind & this.content) {
      let {
        namespace = this.namespace,
        allowEnd = Any,
        escalate = Any,
        allow = None, forbid = None,
        content = this.content,
        openFor = None, paths = null,
        redirect = None, target = null,
      } = getRule (this, name, kind, this.children)

      const content_ = content &~ forbid | allow
      const childFrame = new Frame (name, kind, {
        namespace,
        closable: this.closable & allowEnd,
        openable: this.openable & escalate,
        content: content_,
        openFor, paths,
        redirect, target,
      }, node)
      return childFrame
    // }
    // return null
  }

  get info () {
    return {
      name: this.name,
      namespace: printInfo (this.namespace),
      kind:      printInfo (this.kind),
      closable:  printInfo (this.closable),
      openable:  printInfo (this.openable),
      content:   printInfo (this.content),
      openFor:   printInfo (this.openFor), paths: this.paths,
      redirect:  printInfo (this.redirect),
      children:  printInfo (this.children),
      // redirectParent: target && target[0].node.name,
      // node
    }
  }

}


// Tree Builder
// ------------

function TreeBuilder ({ root = new DocumentFrame (), minDepth = 2, verbose = false } = { }) {
  
  const self = this
  const stack = this.stack = [root]
  let tip = root
  this.document = root.node
  this.closeCount = 0n
  hidden (this, { root, minDepth, open, prepare, append, close, lookup, log })
  getters (this, { tip: () => stack [stack.length-1] })

  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I just limit to two, but one can construct schemas that allow 
  // any finite (or infinite) amounts.

  function prepare (name, kind) {
    log ('try prepare for ::', name)
    for (let i=0; i<2; i++) {
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
            // log (tip.node)
            self.stack.push (tip = tip_)
          }
          log ('path opened', inserts.path.map (_ => _.info))
          if (inserts.done)
            return self
        }
      }
    }
    log ('ERR - cannot prepare for ::', name)
    return null
  }

  function open (name) {
    log ('try open ::', name)
    const kind = kinds[name] || otherKind
    if (prepare (name, kind))
      return _open (name, kind)
    return self
  }

  function append (item, kind = kinds[item] || otherKind) {
    log ('try append ::', item)
    if (prepare (item.name, kind)) // NB REVIEW passing item.name here
      tip.node.children.push (item)
    // TODO update sibling rules, childKinds, ..
    return self
  }


  function close (name) {
    const kind = kinds[name] || otherKind
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
    self.stack.push (tip = tip_)
    // log ('OK - opened', name)
    return self
  }

  function _close (index = stack.length - 1) {
    if (index < self.minDepth) return null
    const closes = []; let kinds = None
    while (stack.length > index) {
      const _pop = stack.pop ()
      kinds |= _pop.kind
      self.closeCount |= _pop.kind
      closes.push (_pop) }
    _afterClose (kinds)
    return closes
  }

  function _afterClose (kinds) {
    // For the sibling rules, update the parent of _tip,
    // and thus, _tip as well
    const p = stack [stack.length-2]
    const _tip = stack.pop ()
    p.children |= kinds
    tip = p.child (_tip.name, _tip.kind)
    tip.node = _tip.node
    tip.target = _tip.target
    stack.push (tip)
    log ('sibling-updated', {_tip, tip})
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
    log ('search', tip_.info, 'towards', name)
    while (tip_ && !(tip_.content & kind) && tip_.openFor & kind) {
      const name_ = name in tip_.paths ? tip_.paths[name] : tip_.paths['#default'] // NB was _default
      tip_ = tip_.child (name_, kinds[name_] || otherKind)
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

function BodyBuilder () { // used to collect 'foster-parented' nodes
  builder = new TreeBuilder ({ root: new DocumentFrame () }) .open ('head') .close ('head') .open ('body')
  builder.tip.closable = None
  builder.document = builder.tip.node
  builder.document.name = '#collected'
  return builder
}

function DocumentFrame () {
  const context = { content: E.html, openFor:Any, paths: { '#default':'html' } }
  return new Frame ('#document', None, context)
}


// Director
// --------

// Using the token types from the lexer, so far
// I may collect those somewhere else

const { StartTag:START, EndTag:END, Leaf:LEAF } = T

function Director (options) {

  const self = this
  let builder, context
  hidden (this, { reset, write, end, batchWrite })
  getters (this, { document: () => builder.document })
  return reset ()

  function reset () {
    builder = new TreeBuilder (options)
    context = builder.tip
    return self
  }

  function write (token) {
    return batchWrite ([token])
  }

  function end () {
    // TODO REVIEW (quick hack)
    builder.open ('body')
    // batchWrite ([[START, 'body'],[END, 'body']])
    return self
  }

  // ### batchWrite
  // tokens are tuples [tokenType, string], just, for now

  function batchWrite (tokens) {
    // TODO need a one-token delay, to mark leading space as text
    for (let [t, name, attrs] of tokens)  { 
      context = builder.tip

      const kind = t & (START|END)
        ? kinds [name] || otherKind
        : name[0] === ' ' ? C.SPACE : C.TEXT // FIXME quick hack
      
      // SVG Tag name adjustments
      if (context.namespace & E.svg && t & (START|END)) {
        name = SVGTagNameAdjustments [name.toLowerCase ()] || name
      }
      
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
          handler (new Leaf (name, attrs), C.htmlFont, LEAF)

        else if (kind & C.annotationXml) {
          // TODO also adapt the close tag then
          let kind = C.annotationXml
          if (attrs && 'encoding' in attrs && context.namespace === E.math) {
            const v = attrs.encoding.toLowerCase ()
            if (v === 'text/html' || v === 'application/xhtml+xml')
              kind = C.annotationHtml
          }
          handler (name, kind, START)
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
    // log (...arguments)
    let target = builder
    // log (item, printInfo(kind), type, 'redirect?', context.redirect & kind && context.closable & E.table)
    if (context.redirect & kind && context.closable & E.table) {
      // TODO: find the appropriate 'foster parent' -- can this be more quick?
      const frame = builder.lookup ('table', E.table) .frame
      target = frame.target || target
    }

    if (type === START) {
      if (kind & E.table) {
        if (target.prepare (item, kind)) {
          const collector = new BodyBuilder ()
          target.append (collector.document)
            .open (item, kind)
          const frame = target.tip
          frame.target = collector
          return target
        }
      }
      return target.open (item, kind)
    }

    if (type === END)
      return target.close (item, kind)

    else
      return target.append (item, kind)
  }

}


// Exports
// -------

Object.assign (Director, { Node, Leaf, Frame, START, END, LEAF, Director })
module.exports = Director