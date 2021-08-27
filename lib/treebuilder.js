const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const hidden  = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:true, configurable:true }) }
const log = console.log.bind (console)


// Tree Builder
// ============

// Names and Kinds
// ---------------

const { Any, None, kinds, otherKind, printKind:pr, C }
  = require ('./categories')


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


// Parameterised TreeBuilder Class
// -------------------------------

const TreeBuilder = ({ childRule, siblingRule, ruleInfo }) => {

// Contexts
// --------

// The contexts are wrapped with 'Frame' objects.
// These are placed on the TreeBuilder's 'stack of open elements'.

class Frame {
  
  constructor (node, rule) {
    const base = {
      namespace:None, name:node.name, kind:None,
      closable:None, openable:None, content:None,
      node: node }
    return this.applyRule.call (base, rule)
  }

  applyRule (rule, { name, kind, node, children = None } = this) {
    const {
      namespace = this.namespace,
      allowEnd = Any, escalate = Any, 
      content = this.content,
      allow = None, forbid = None,
      openFor = None, paths = null,
      redirect = None, redirectTo = this.redirectTo,
      reparent = None, fosterParent = this.fosterParent,
      _reopen = None, siblingRules = false, 
    } = rule

    const content_ = (content | reparent | allow) &~ forbid
    const frame = setProto ({
      namespace, name, kind, children,
      closable: this.closable & allowEnd,
      openable: this.openable & escalate | content_ | openFor,
      content: content_,
      openFor, paths,
      redirect: redirect &~content_, redirectTo, fosterParent,
      siblingRules, _reopen, reparent,
      node,
    }, Frame.prototype)

    hidden (node, { frame })
    return frame
  }

  // NB 'child' does not append, it merely creates a new frame
  child (name, kind, attrs, node = new Node (name, attrs)) {
    const rule = childRule (this, name, kind, this.children)
    const frame = this.applyRule (rule, { name, kind, node })
    frame.closable |= kind
    return frame
  }

  // TODO OK, this works, but clean it up a bit.
  _select (name, _kind) {
    for (const child of this.node.children) // NB does not check kind
      if (child.name === name) return this.child (name, _kind, null, child)
    return null
  }

  get info () {
    const r = assign ({}, this)
    for (const k in r) if (typeof r[k] === 'bigint')
      r [k] = pr (r [k])
    r.redirectTo = this.redirectTo?.name// && this.targe.name // t.stack[0].name // && this.redirectTo.stack[0].info // && this.redirectTo.name
    r.fosterParent = this.fosterParent?.name
    delete r.node
    return r
  }

}


// The Tree Builder
// ----------------

function TreeBuilder ({ context, node, minDepth = 1, verbose = false }) {

  const self = this
  
  let root, tip, stack, formatting, 
    allOpened, allClosed, 
    openMask = None, openHandler,
    closeMask = None, closeHandler
    
  getters (this, { 
    stack:     () => stack,
    tip:       () => tip,
    document:  () => root,
    allOpened: () => allOpened,
    allClosed: () => allClosed,
  })

  hidden (this, { 
    reset, _onopen, _onclose, log,
    prepare, tryOpen, tryAppend, tryClose,
    _open, _select, _reformat, canClose })

  return reset ()
  
  function reset () {
    root  = node || new Node (context.name || '#root')
    tip   = new Frame (root, context)
    stack = [tip]
    formatting = []
    allOpened = None
    allClosed = None
    return self
  }

  function _onopen (mask, handler) {
    openMask = mask
    openHandler = handler
  }

  function _onclose (mask, handler) {
    closeMask = mask
    closeHandler = handler
  }


  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I limit to three, but one can construct schemas that allow 
  // any finite (or infinite) amounts.

  function prepare (name, kind, ns = tip.namespace) {
    // log ('try prepare for ::', name, '('+pr (kind)+')')
    for (let i=0; i<3; i++) {
      // log ('is allowed ::', name, '('+pr (kind)+') ?', Boolean (kind & tip.content))
      if (kind & tip.content) return self

      const cursor = canEscalate (name, kind, ns)
      // log ('can escalate to ::', cursor && cursor.frame.info)
      if (cursor) {
        const closes = _close (cursor.index + 1)
        // if (closes && closes.length) log (`OK - closed for open ::`, closes .map (_ => _.name) .join (' < ' ))
        if (cursor.done) return self
      }

      const inserts = canExtend (name, kind)
      if (inserts && inserts.path.length) {
        // log ('path found ::', inserts.path.map (_ => _.name) .join (' > '))
        for (const tip_ of inserts.path) {
          const parent = tip.reparent & kind ? tip.fosterParent : tip.node
          const index = parent.children.length
          parent.children [index] = tip_.node
          tip.children |= tip_.kind // REVIEW
          stack.push (tip = tip_)
          allOpened |= tip_.kind
          if (openMask & tip_.kind)
            openHandler (tip_.name, tip_.kind, tip_.node, parent, index)
        }
        // log ('OK - path opened ::', inserts.path.map (_ => _.name) .join (' > '))
        if (inserts.done) return self
      }
    }
    // log ('ERR - cannot prepare for ::', name)
    return null
  }

  function tryOpen (name, kind = kinds[name] || otherKind, attrs, namespace) {
    // log ('try open ::', name)
    if (prepare (name, kind, namespace))
      return _open (name, kind, attrs)
    // log ('ERR - cannot open ::', name)
    return null
  }

  function tryAppend (item, kind = kinds[item] || otherKind) {
    // log ('try append ::', pr (kind))
    if (prepare (item ? item.name : null, kind)) { // NB REVIEW passing item.name here
      const parent = tip.reparent & kind ? tip.fosterParent : tip.node
      parent.children.push (item)
      tip.children |= kind // REVIEW, esp. with fosterParent
      allOpened |= kind
      // log ('appended ::', item)
      return self
    }
    // TODO update sibling rules
    return null
  }


  function tryClose (name, kind = kinds[name] || otherKind) {
    // log ('try close ::', name)
    const cursor = canClose (name, kind)
    if (cursor) {
      const closes = _close (cursor.index)
      if (closes) {
        // log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
        // log ('stack length', stack.length, 'tip', tip.info, tip.node)
        return self
      }
    }
    // log ('ERR - cannot close ::', name)
    return null
  }

  // Elementary operations

  function _open (name, kind, attrs) {
    const tip_ = tip.child (name, kind, attrs)
    const parent = tip.reparent & kind ? tip.fosterParent : tip.node
    const index = parent.children.length
    parent.children [index] = tip_.node
    tip.children |= kind // REVIEW, esp. with redirection
    stack.push (tip = tip_)
    allOpened |= kind
    // log ('opened ::', name)
    if (openMask & kind)
      openHandler (name, kind, tip_.node, parent, index)
    return self
  }

  function _close (index = stack.length - 1) {
    if (index < minDepth) return null
    const closes = []; let kind = None, name
    while (stack.length > index) {
      const _pop = stack.pop ()
      kind = _pop.kind
      name = _pop.name
      allClosed |= _pop.kind
      closes.push (_pop)
      formatting.push (_pop) 
      // if (closeMask & kind)
      //   closeHandler (name, kind, _pop.node)
    }
    // Not _as_ tidy anymore, but still,
    if (kind & C.format && formatting.length)
      formatting.pop ()
    tip = stack[stack.length-1]
    // log ('closed ::', closes.map (_ =>_.name). join (' < '))
    if (tip.siblingRules) _afterClose (name, kind)
    return closes
  }


  function _afterClose (name, kind) {
    stack.pop ()
    const rule = siblingRule (tip, name, kind, allOpened)
    if (rule != null)
      stack [stack.length] = (tip = tip.applyRule (rule))
    // log ('sibling-updated ::', '==>', tip.info)
  }
  
  function _reformat () {
    let counts = {}, formatting_ = []
    for (let { name, kind } of formatting) {
      if (kind & C.format) {
        let c = counts [name] = (counts [name] || 0) +1
        if (c <= 3) formatting_.unshift ({ name, kind })
      }
      else if (kind & C.formatContext) {
        counts = {}, formatting_ = []
      }
    }
    for (let { name, kind } of formatting_)
      self.tryOpen (name, kind)
    formatting = []
  }

  // Querying
  
  function canClose (name, kind, ns = null) { // tags to be closed for an endtag
    for (let i=stack.length-1; i>=0; i--) {
      const frame = stack[i]
      // if (frame.name === name && ns == null || frame.namespace === ns) return { index:i, frame }
      if (frame.name === name) return { index:i, frame }
      // special case hack -- allow (null, kind) to search on kind only
      if (name === null && frame.kind & kind) return { index:i, frame }
      if (!(frame.closable & kind)) return null
    }
  }

  function canEscalate (name, kind, ns) { // to be closed for insert
    if (kind & tip.openable) for (let i=stack.length-1; i >= 0; i--) {
      const frame = stack[i]
      const ns_ok = ns === frame.namespace
      if (ns_ok && kind & frame.content) return { index:i, frame, done:true  }
      if (ns_ok && kind & frame.openFor) return { index:i, frame, done:false }
    }
  }

  function canExtend (name, kind) { // to be opened for insert
    const path = []
    let tip_ = tip, ins
    // log ('search towards ::', name)
    if (kind & tip.openFor) while (tip_ && !(tip_.content & kind) && tip_.openFor & kind) {
      const name_ = name in tip_.paths ? tip_.paths[name] : tip_.paths['#default']
      tip_ = tip_.child (name_, kinds[name_] || otherKind) // NB not doing preprocessing here!
      path.push (tip_)
      // log ('canExtend...', tip_.name)
    }
    return path.length ? { path, done:tip_.content & kind } : null
    // REVIEW what about invalid schemas?
  }

  // Quick
  
  function _select (name, kind) {
    const tip_ = tip._select (name, kind)
    if (tip_) stack.push (tip = tip_)
    // log ('select', tip_ ? 'succeeded ::' : 'failed ::', name)
    return tip_ ? self : null
  }

  // Debugging

  function log (...msgs) {
    if (verbose)
      console.log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}


return TreeBuilder
} // End TreeBuilder Generic Class

// Exports
// -------

Object.assign (TreeBuilder, { Node, Leaf, TreeBuilder })
module.exports = TreeBuilder