const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const hidden  = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const log = console.log.bind (console)
const pr = printKind


// Tree Builder
// ============

// Dom
// ---

import { Any, None, kinds, otherKind, printKind, C }
  from './categories.js'

import { Element as Node }
  from './dom.js'


// Parameterised TreeBuilder Class
// -------------------------------

const TreeBuilderClass = ({ childRule, siblingRule }) => {

// Contexts
// --------

// The contexts are wrapped with 'Frame' objects.
// These are placed on the TreeBuilder's 'stack of open elements',

class Frame {
  
  constructor (node, rule) {
    // node and node info
    this.name     = node.name  // node name
    this.kind     = None       // element equivalence class
    this.children = None       // union of childrens' eq classes (as added by TreeBuilder)
    this.node     = node       // pointer to created DOM node
    // rule- and computed info
    this.state    = rule.state // context / 'namespace'
    this.nesting  = None       // ... nesting restrictions
    this.closable = None       // union of eq-classes of closable elements on stack
    this.escalate = None       // union of eq-classes of open tags that trigger a close-and-retry
    this.rule     = rule
    this.fosterParent = null
  }

  applyRule (rule, { name, kind, node, children = None } = this) {
    const frame = setProto ({ name, kind, node, children,
      state        : rule.state || this.state,
      nesting      : (this.nesting | kind) &~ rule.hidenest,
      closable     : this.closable &~ rule.hide,
      escalate     : (this.rule.content | this.rule.openFor | this.escalate) & rule.escalate,
      fosterParent : this.fosterParent,
      rule
    }, Frame.prototype)
    hidden (node, { frame })
    return frame
  }

  // NB 'child' does not append, it merely creates a new frame
  createFrameForChild (name, kind, attrs, node = new Node (name, attrs)) {
    const rule      = childRule (this.state, name, kind, this.children)
    const frame     = this.applyRule (rule, { name, kind, node })
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
    r.fosterParent = this.fosterParent?.name
    r.rule = this.rule.info
    delete r.node
    return r
  }

}


// The Tree Builder
// ----------------

function TreeBuilder ({ context, node, verbose = false }) {

  const self = this

  let root, tip, stack, formatting, 
    allOpened, allClosed, 
    openMask = None, openHandler,
    closeMask = None, closeHandler
    
  // Getters and Methods

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
    _open, _select, _reformat, findParent })

  return reset ()
  
  // Initialisation

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

  // Querying
  
  function findParent (name, kind) { // tags to be closed for an endtag
    if (name == null) { // special case hack -- allow (null, kind) to search on kind only
      for (let i=stack.length-1; i>=0; i--) {
        const frame = stack[i]
        if (frame.kind & kind) return { index:i, frame }
        if ((frame.closable & kind) === None) return null
      }
    }
    /* else - default case */
    for (let i=stack.length-1; i>=0; i--) {
      const frame = stack[i]
      if (frame.name === name) return { index:i, frame }
      if ((frame.closable & kind) === None) return null
    }
  }

  function findParentFor (name, kind) { // to be closed for an open tag
    if (kind & tip.escalate) for (let i=stack.length-1; i >= 0; i--) {
      const frame = stack[i]
      if (kind & frame.rule.content)   return { index:i, frame, done:true  }
      if (kind & frame.rule.openFor) return { index:i, frame, done:false }
    }
  }

  function findPathTowards (name, kind) { // to be opened for insert
    const path = []
    let tip_ = tip, ins
    // log ('search towards ::', name)
    if (kind & tip.rule.openFor) while (tip_ && !(tip_.rule.content & kind) && tip_.rule.openFor & kind) {
      const name_ = name in tip_.rule.paths ? tip_.rule.paths[name] : tip_.rule.paths['#default']
      tip_ = tip_.createFrameForChild (name_, kinds[name_] || otherKind) // NB not doing preprocessing here!
      path.push (tip_)
      // log ('findPathTowards...', tip_.name)
    }
    return path.length ? { path, done:tip_.rule.content & kind } : null
    // REVIEW what about invalid schemas?
  }

  // Schema-directed open, append and close
  
  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I limit to three, but one can construct schemas that allow 
  // any finite (or infinite) amounts.

  function prepare (name, kind) {
    // log ('try prepare for ::', name, '('+pr (kind)+')')
    for (let i=0; i<3; i++) {
      // log ('is allowed ::', name, '('+pr (kind)+') ?', Boolean (kind & tip.rule.allow))
      if (kind & tip.rule.content) return self

      const cursor = findParentFor (name, kind)
      // log ('can escalate to ::', cursor && cursor.frame.info)
      if (cursor) {
        const closes = _close (cursor.index + 1)
        // if (closes && closes.length) // log (`OK - closed for open ::`, closes .map (_ => _.name) .join (' < ' ))
        if (cursor.done) return self
      }

      const inserts = findPathTowards (name, kind)
      if (inserts && inserts.path.length) {
        // log ('path found ::', inserts.path.map (_ => _.name) .join (' > '))
        for (const tip_ of inserts.path) {
          const parent = kind & tip.rule.trap ? tip.fosterParent : tip.node
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

  function tryOpen (name, kind = kinds[name] || otherKind, attrs) {
    // log ('try open ::', name)
    if (prepare (name, kind))
      return _open (name, kind, attrs)
    // log ('ERR - cannot open ::', name)
    return null
  }

  function tryAppend (item, kind) {
    // log ('try append ::', pr (kind))
    if (prepare (item ? item.name : null, kind)) { // NB REVIEW passing item.name here
      const parent = kind & tip.rule.trap ? tip.fosterParent : tip.node
      parent.children.push (item)
      tip.children |= kind // REVIEW, esp. with fosterParent
      allOpened |= kind
      // log ('appended ::', item)
      if (tip.rule.siblingRules) {
        const rule = siblingRule (tip, item.name, kind, allOpened)
        if (rule != null)
          stack [stack.length-1] = (tip = tip.applyRule (rule))
        // log ('sibling-updated ::', '==>', tip.info)
      }
      return self
    }
    return null
  }

  function tryClose (name, kind = kinds[name] || otherKind) {
    // log ('try close ::', name)
    const cursor = findParent (name, kind)
    if (cursor) {
      const closes = _close (cursor.index)
      if (closes) {
        // log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
        return self
      }
    }
    // log ('ERR - cannot close ::', name)
    return null
  }

  // Tree construction

  function _open (name, kind, attrs) {
    const tip_   = tip.createFrameForChild (name, kind, attrs)
    const parent = kind & tip.rule.trap ? tip.fosterParent : tip.node
    const index  = parent.children.length
    parent.children [index] = tip_.node
    tip.children |= kind // REVIEW
    stack.push (tip = tip_)
    allOpened |= kind
    // log ('opened ::', name)
    if (openMask & kind)
      openHandler (name, kind, tip_.node, parent, index)
    return self
  }

  function _close (index) {
    const closes = []
    let kind = None, name
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
    if (tip.rule.siblingRules) _afterClose (name, kind)
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

  // Navigation
  
  function _select (name, kind) {
    const tip_ = tip._select (name, kind)
    if (tip_) stack.push (tip = tip_)
    // log ('select', tip_ ? 'succeeded ::' : 'failed ::', name)
    return tip_ ? self : null
  }

  // Debugging

  function log (...msgs) {
    if (verbose)
      console .log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}


return TreeBuilder
} // End TreeBuilder Generic Class


// Exports
// -------

export { TreeBuilderClass }