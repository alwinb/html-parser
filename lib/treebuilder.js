const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const hidden  = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:true, configurable:true }) }
const log = console.log.bind (console)

// Tree Builder
// ============

// Names, Kinds, Sets, and Rules
// -----------------------------

const { Any, None, printInfo,
  elementInfo: kinds, defaultInfo: otherKind } = require ('./categories')


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

function Comment (data) {
  this.name = '#comment'
  this.data = data
}


// The contexts are wrapped with 'Frame' objects.
// These are placed on the TreeBuilder's 'stack of open elements'.

function FrameClass (getRule) {
  
  return class Frame {
  
  constructor (context = { }, node) {
    const {
      namespace = None, 
      name = '#document', kind = None, children = None,
      closable = None, openable = None, content = Any,
      openFor = None, paths = null,
      redirect = None, target = null } = context

    node = node || new Node (name)
      hidden (node, { frame:this }) // for debugging

    assign (this, {
      namespace, name, kind, children,
      closable, openable, content,
      openFor, paths,
      redirect, target, node })
  }

  child (name, kind, node = new Node (name)) {
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
        redirect: redirect &~content_, target, node
      }, Frame.prototype)
      hidden (node, { frame })
      return frame
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
}

// The Tree Builder!
// -----------------

function TreeBuilder ({ context, getRule, node, minDepth = 2, verbose = false }) {

  const Frame = FrameClass (getRule)

  const self = this
  const root = node || new Node ('#document')
  let tip = new Frame (context, root)
  const stack = this.stack = [tip]
  let allSeen = None
  this.closeCount = 0n

  getters (this, { 
    tip:      () => stack [stack.length-1],
    document: () => root,
    allSeen:  () => allSeen })

  hidden (this, { root, minDepth, prepare, tryOpen, tryAppend, tryClose, _open, lookup, log })


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
            allSeen |= tip_.kind
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
    return null
  }

  function tryAppend (item, kind = kinds[item] || otherKind) {
    log ('try append ::', printInfo (kind))
    if (prepare (item ? item.name : null, kind)) { // NB REVIEW passing item.name here
      tip.node.children.push (item)
      tip.children |= kind
      allSeen |= kind
      log ('appended', tip.info)
      return self
    }
    // TODO update sibling rules, childKinds, ..
    return null
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
    tip.node.children.push (tip_.node)
    tip.children |= kind // REVIEW
    self.stack.push (tip = tip_)
    allSeen |= kind
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


// Exports
// -------

Object.assign (TreeBuilder, { Node, Leaf, Comment, TreeBuilder })
module.exports = TreeBuilder