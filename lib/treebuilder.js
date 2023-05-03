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

import { Any, None, elementClass, printKind, states as S, C }
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
    this.state    = rule.state // context / 'namespace'
    this.name     = node.name  // lowercased node name -- may be different from node.name in svg
    this.id       = -1         // element equivalence class-id (int; abusing -1 for root node)
    this.kind     = None       // element equivalence class (bitvector, 1n << id)
    this.children = None       // union of childrens' eq classes (as added by TreeBuilder)
    this.node     = node       // pointer to created DOM node
    this.rule     = rule
    // rule- and computed info
    this.nesting  = None       // union of eq-classes of elements on stack, minus explicitly hidden
    this.closable = None       // union of eq-classes of closable elements on stack
    this.escalate = None       // union of eq-classes of open tags that trigger a close-and-retry
    this.fosterParent = null
  }

  applyRule (rule, { name, id, kind, node, children = None } = this) {
    const frame = setProto ({ name, id, kind, node, children,
      state        : rule.state || this.state,
      nesting      : (this.nesting &~ rule.hidenest) | kind, // NB cannot hide your own nesting
      closable     : this.closable &~ rule.hide,
      escalate     : (this.rule.content | this.rule.openFor | this.escalate) & rule.escalate,
      fosterParent : this.fosterParent,
      rule
    }, Frame.prototype)
    hidden (node, { frame })
    return frame
  }

  // NB 'child' does not append, it merely creates a new frame
  createFrameForChild (name, id, kind, attrs, node = new Node (name, attrs)) {
    const rule      = childRule (this.state, id)
    const frame     = this.applyRule (rule, { name, id, kind, node })
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
    r.id = printKind (1n << BigInt (this.id))
    r.rule = this.rule.info
    delete r.node
    return r
  }

}


// The Tree Builder
// ----------------

function TreeBuilder ({ context, node }) {

  const self = this

  let root, tip, stack, formatting, 
    allOpened, 
    openMask = None, openHandler,
    closeMask = None, closeHandler
    
  // Getters and Methods

  getters (this, { 
    document:  () => root,
    stack:     () => stack,
    tip:       () => tip,
    allOpened: () => allOpened,
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
      // log (frame.info.closable, frame.closable & kind, printKind (kind))
      if (frame.name === name) return { index:i, frame }
      if ((frame.closable & kind) === None) return null
    }
  }

  function findParentFor (name, kind) { // to be closed for an open tag
    if (kind & tip.escalate) for (let i=stack.length-1; i >= 0; i--) {
      const frame = stack[i]
      if (kind & frame.rule.content) return { index:i, frame, done:true  }
      if (kind & frame.rule.openFor) return { index:i, frame, done:false }
    }
  }

  function findPathTowards (name, kind) { // to be opened for insert
    const path = []
    let tip_ = tip, ins
    // log ('search towards ::', name)
    if (kind & tip.rule.openFor)
      while (tip_ && tip_.rule.openFor & kind) {
        const name_ = tip_.rule.paths [name]
          ?? tip_.rule.paths ['#default']
        const id = elementClass ({name:name_})
        tip_ = tip_.createFrameForChild (name_, id, 1n << BigInt (id)) // // REVIEW NB not doing preprocessing here!
        path.push (tip_)
        // log ('findPathTowards...', tip_.name)
    }
    return path.length ? { path, done:tip_.rule.content & kind } : null
    // REVIEW what about invalid schemas?
  }

  // Schema-directed open, append and close
  
  function tryOpen (name, id, kind, attrs) {
    // log ('try open ::', name)
    if (kind & tip.rule.content)
      return _open (name, id, kind, attrs)
    else if (prepare (name, kind))
      return _open (name, id, kind, attrs)
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

  function tryClose (name, kind) {
    // log ('try close ::', name)
    let cursor, closes
    if ((cursor = findParent (name, kind)) && (closes = _close (cursor.index))) {
      // log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
      return self
    }
    // log ('ERR - cannot close ::', name)
    return null
  }

  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I limit to three, but one can construct schemas that allow 
  // any finite (or infinite) amounts.

  function prepare (name, kind) {
    // log ('try prepare for ::', name, '('+pr (kind)+')')
    for (let i=0; i<3; i++) {
      // log ('is allowed ::', name, '('+pr (kind)+') ?', Boolean (kind & tip.rule.content))
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
            openHandler (tip_.name, tip_.id, tip_.node, parent, index)
        }
        // log ('OK - path opened ::', inserts.path.map (_ => _.name) .join (' > '))
        if (inserts.done) return self
      }
    }
    // log ('ERR - cannot prepare for ::', name)
    return null
  }

  // Tree construction

  function _open (name, id, kind, attrs) {
    const tip_   = tip.createFrameForChild (name, id, kind, attrs)
    const parent = kind & tip.rule.trap ? tip.fosterParent : tip.node
    const index  = parent.children.length
    parent.children [index] = tip_.node
    tip.children |= kind // REVIEW
    stack.push (tip = tip_)
    allOpened |= kind
    // log ('opened ::', name)
    if (openMask & kind)
      openHandler (name, id, tip_.node, parent, index)
    return self
  }

  function _close (index) {
    const closes = []
    let frame
    while (stack.length > index) {
      frame = stack.pop ()
      closes.push (frame)
      formatting.push (frame) // FIXME need to add id to frame
      // if (closeMask & kind)
      //   closeHandler (name, kind, _pop.node)
    }
    // Not _as_ tidy anymore
    if (frame.kind & C.Formatting && formatting.length)
      formatting.pop ()
    tip = stack [stack.length-1]
    // log ('closed ::', closes.map (_ =>_.name). join (' < '))

    // After close;
    if (tip.rule.siblingRules) {
      // apply siblingrule and replace tip
      stack.pop ()
      const rule = siblingRule (tip, frame.name, frame.id, allOpened)
      if (rule != null)
        stack [stack.length] = (tip = tip.applyRule (rule))
      // log ('sibling-updated ::', '==>', tip.info)
    }
    return closes
  }

  function _reformat () {
    let counts = {}, formatting_ = []
    for (const frame of formatting) {
      const name = frame.name
      if (frame.kind & C.Formatting) {
        let c = counts [name] = (counts [name] || 0) +1
        if (c <= 3) formatting_.unshift (frame)
      }
      else if (frame.kind & C.FormattingContext) {
        counts = {}, formatting_ = []
      }
    }
    for (let { name, id, kind } of formatting_)
      self.tryOpen (name, id, kind)
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
    console .log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}


return TreeBuilder
} // End TreeBuilder Generic Class


// Exports
// -------

export { TreeBuilderClass }