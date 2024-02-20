const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const configurable = true
const getters = (o,d) => { for (const k in d) def (o,k, {   get: d[k], configurable }) }
const hidden  = (o,d) => { for (const k in d) def (o,k, { value: d[k], configurable }) }
const methods = hidden
const log = console.log.bind (console)
const pr = printKind


// Tree Builder
// ============

// Dom
// ---

import { Any, None, childRule, siblingRule, printKind, C }
  from './schema.js'

import { Element as Node }
  from './dom.js'


// Contexts
// --------

// The contexts are wrapped with 'Frame' objects.
// These are placed on the TreeBuilder's 'stack of open elements',

class Frame {
  
  constructor (node, rule) {
    // node and node info
    this.name     = node.name  // lowercased node name -- may be different from node.name in svg
    this.id       = -1         // element equivalence class-id (int; abusing -1 for root node)
    this.kind     = None       // element equivalence class (bitvector, 1n << id)
    this.children = None       // union of childrens' eq classes (as added by TreeBuilder)
    this.node     = node       // pointer to created DOM node
    this.rule     = rule
    // rule- and computed info
    this.namespace = rule.namespace  // context / 'namespace'
    this.nestingContext = None // union of eq-classes of elements on stack, minus explicitly hidden
    this.closableAncestors = None // union of eq-classes of closableAncestors elements on stack
    this.fosterParent = null
  }

  applyRule (rule, { name, id, kind, node, children = None } = this) {
    const frame = setProto ({ name, id, kind, node, children,
      namespace: rule.namespace || this.namespace,
      nestingContext: (this.nestingContext &~ rule.clearContext) | kind,
      closableAncestors: this.closableAncestors & rule.closableAncestors | kind,
      fosterParent: this.fosterParent,
      rule
    }, Frame.prototype)
    hidden (node, { frame })
    return frame
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

function TreeBuilder ({ initialRule, node }) {

  const self = this

  let root,
    tip,
    stack,
    formatting, 
    allOpened, 
    openMask = None,
    openHandler

  // Getters and Methods

  getters (this, { 
    document:  () => root,
    stack:     () => stack,
    tip:       () => tip,
    allOpened: () => allOpened,
  })

  methods (this, { 
    init,
    tryOpen,
    tryAppend,
    tryClose,
    tryCloseByKind,
    findClosableAncestor,
    findClosableAncestorByKind,
    reconstructFormatting,
    _prepare,
    _onopen, 
    log,
    })

  return init ()

  // Initialisation

  function init () {
    root  = node || new Node (initialRule.name || '#root')
    tip   = new Frame (root, initialRule)
    stack = [tip]
    formatting = []
    allOpened = None
    return self
  }

  function _onopen (mask, handler) {
    openMask = mask
    openHandler = handler
  }

  // Querying
  
  function findClosableAncestor (name, kind) { // tags to be closed for an endtag
    let i = stack.length -1
    const frame = stack [i]
    if (frame.name === name) return { index:i, frame }
    if (frame.closableAncestors & kind) for (i--; i>=0; i--) {
      const frame = stack[i]
      if (frame.name === name) return { index:i, frame }
    }
    return null
  }

  function findClosableAncestorByKind (kind) {
    let i = stack.length -1
    const frame = stack[i]
    if (frame.kind === kind) return { index:i, frame }
    if (frame.closableAncestors & kind) for (i--; i>=0; i--) {
      const frame = stack[i]
      if (frame.kind & kind) return { index:i, frame }
    }
    return null
  }

  function findClosableAncestorFor (name, kind) { // to be closed for an open tag
    if (kind & tip.rule.escalate)
    for (let i=stack.length-2; i >= 0; i--) {
      const frame = stack[i]
      if (kind & frame.rule.content) return { index:i, frame, done:true  }
      if (kind & frame.rule.pathsFor) return { index:i, frame, done:false }
    }
    return null
  }

  function findPathTowards (name, kind) { // to be opened for insert
    const path = []
    let tip_ = tip, ins
    // log ('search towards ::', name)
    if (kind & tip.rule.pathsFor)
      while (tip_ && tip_.rule.pathsFor & kind) {
        const name_ = tip_.rule.paths [name] ?? tip_.rule.paths ['#default']
        const [id, rule] = childRule ({name:name_}, tip_)
        const kind_ = 1n << BigInt (id)
        const node = new Node (name_)
        path.push (tip_ = tip_.applyRule (rule, { name:name_, id, kind:kind_, node }))
        // log ('findPathTowards...', tip_.name)
    }
    return path.length ? { path, done:tip_.rule.content & kind } : null
    // REVIEW what about invalid schemas?
  }

  // Schema-directed open, append and close
  
  function tryOpen (name, attrs, id, kind, rule) {
    // log ('try open ::', name)
    if (_prepare (name, kind)) {
      const node = new Node (name, attrs)
      const tip_ = tip.applyRule (rule, { name, id, kind, node })
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
    // log ('ERR - cannot open ::', name)
    return null
  }

  function tryAppend (item, kind) {
    // log ('try append ::', pr (kind))
    if (_prepare (item ? item.name : null, kind)) { // NB REVIEW passing item.name here
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
    if ((cursor = findClosableAncestor (name, kind)) && (closes = _close (cursor.index))) {
      // log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
      return self
    }
    // log ('ERR - cannot close ::', name)
    return null
  }

  function tryCloseByKind (kind) {
    // log ('try close ::', name)
    let cursor, closes
    if ((cursor = findClosableAncestorByKind (kind)) && (closes = _close (cursor.index))) {
      // log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
      return self
    }
    // log ('ERR - cannot close ::', name)
    return null
  }

  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I limit to three, but one can construct schemas that allow 
  // any finite (or infinite) amounts.

  function _prepare (name, kind) {
    // log ('try prepare for ::', name, '('+pr (kind)+')')
    for (let i=0; i<3; i++) {
      // log ('is allowed ::', name, '('+pr (kind)+') ?', Boolean (kind & tip.rule.content))
      if (kind & tip.rule.content) return self

      const cursor = findClosableAncestorFor (name, kind)
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

  function _close (index) {
    const closes = []
    let frame
    while (stack.length > index) {
      frame = stack.pop ()
      closes.push (frame)
      formatting.push (frame) // FIXME need to add id to frame
    }
    // Not _as_ tidy anymore
    if (frame.kind & C.FormattingElement && formatting.length)
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

  // Formatting elements are reopened three times per type max
  // (TODO, not merely tagName but also attributes must be compared)

  function reconstructFormatting () {
    let counts = {}
    let formatting_ = []
    for (const frame of formatting) {
      const name = frame.name
      if (frame.kind & C.FormattingElement) {
        let c = counts [name] = (counts [name] || 0) +1
        if (c <= 3) formatting_.unshift (frame)
      }
      else if (frame.kind & C.FormattingContextElement) {
        counts = {}, formatting_ = []
      }
    }
    for (let { name } of formatting_) {
      const [id, rule] = childRule ({name}, tip)
      self.tryOpen (name, {}, id, 1n<<BigInt(id), rule)
    }
    formatting = []
  }

  // Debugging

  function log (...msgs) {
    console .log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}


// Exports
// -------

export { TreeBuilder }