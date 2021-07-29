const { defineProperty:def, assign } = Object
const log = console.log.bind (console)
const util = require ('util')

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
const { getRule } = require ('./schema')


// Dom
// ---

function Node (name) {
  this.name = name
  this.children = []
}

function Leaf (name) {
  this.name = name
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
    log ('try prepare', name)
    for (let i=0; i<2; i++) {
      // log ('loop', i)
      log ('is allowed? ::', name, kind ,'in', tip.info, '?', kind & tip.content)
      if (kind & tip.content)
        return self

      if (kind & tip.openable) {
        log ('try escalate ::', name)
        const cursor = escalate (name, kind)
        const closes = _close (cursor.index + 1)
        if (closes && closes.length)
          log (`OK - closed for open ::`, closes .map (_ => _.name) .join (' < ' ))
        if (cursor.done)
          return self
      }

      if (kind & tip.openFor) {
        log ('try extend')
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
    // log ('Err - did not open', name)
    return self
  }

  function open (name) {
    log ('try open', name)
    const kind = kinds[name] || otherKind
    if (prepare (name, kind))
      return _open (name, kind)
    return self
  }

  function append (item, kind = kinds[item] || otherKind) {
    log ('try append', item)
    if (prepare (item, kind))
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
    log ('ERR - cannot close ', name)
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
  builder = new TreeBuilder ({ root: new DocumentFrame () }) .open ('body')
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

function Director () {
  const START = 1n, END = 2n, LEAF = 4n

  const self = this
  const builder = new TreeBuilder ()
  let context
  return hidden (this, { batchWrite, builder })

  // ### batchWrite

  function batchWrite (tokens) {
    for (const tag of tokens)  { 
      // just strings for now
      context = builder.tip

      // #### End tags

      if (tag.substring (0, 2) === '</') {
        const name = tag.substr (2, tag.length-3)
        const kind = kinds[name] || otherKind

        // TODO also adjust the kind
        // based on attributes

        if (kind & E.br)
          handler (new Leaf (name), E.br, LEAF)

        else if (kind & E.p && !(context.closable & E.p)) {
          // TODO figure out how this should be redirected!
          handler (name, E.p, START)
          handler (name, E.p, END)
        }
      
        else
          handler (name, kind, END)
      }

      // #### Start tags

      else if (tag[0] === '<') {
        const name = tag.substr (1, tag.length-2)
        const kind = kinds[name] || otherKind
      
        // Exceptions
        if (name === 'image')
          handler (new Leaf ('img'), E.img, LEAF)

        else if (kind & C.void)
          handler (new Leaf (name), kind, LEAF)

        // TODO the attribute filtering
        // if (name === 'annotation-xml' && context.namespace = E.math) {
        //   builder.open ('annotation-xml')
        //   continue
        // }

        else if (kind & E.select && context.closable & E.select)
          handler (name, kind, END)

        else
          handler (name, kind, START)
      }

      // #### Leafs

      else {
        const kind = tag[0] === ' ' ? C.SPACE : C.TEXT
        // log ('other:', {tag}, context.info, printInfo (kind))
        handler (tag, kind, LEAF)
      }
    }
    return self
  }
  
  // ### Token Handler / Director
  // Direct to the appropriate target

  function handler (item, kind, _tag) {
    let target = builder
    if (context.redirect & kind && context.closable & E.table) {
      // TODO: find the appropriate 'foster parent' -- can this be more quick?
      const frame = builder.lookup ('table', E.table) .frame
      target = frame.target || target
    }

    if (_tag === START) {
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

    if (_tag === END)
      return target.close (item, kind)

    if (kind & (C.TEXT | C.SPACE | C.void))
      return target.append (item, kind)
  }

}


// Test
// ====

var sample1 = [
  '<title>',
  // '<script>', // FIXME should not allow elements
  // '<div>',
  // '</br>',
  // '<br>',
  // '<image>',
  // '</p>',
  // '</p>',
  // '<select>',
  // '<select>',
  // '<foo>',
  '<table>',
  '<bar>',
  '<td>',
  'foo',
  '<td>',
  '</td>',
  'bar',
  ' ',
  'bee',
  '</br>',
  'buzz',
]

// good example!

var sample = [
  '<table>',
  '<p>',
  '<td>',
  'foo',
  '</td>',
  '</p>',
  '<td>',
  '<table>',
  'bar',
  '</p>',
]

var sample_ = [
  '<table>',
  'foo',
  '<table>',
  'bar',
]

var sample_ = [
  '<p>',
  '<table>',
  '<p>',
  '</body>',
  'foo',
]

// More good ones:
// <table><caption><select>foo<table><select>bar 
// vs
// <table><caption><select>foo<select>bar

// Result

var d = new Director ()
d.batchWrite (sample)
var builder = d.builder
log (util.inspect (builder.document, {depth:Infinity}))


/*
const b = new TreeBuilder ({ verbose:true })

// var cur =  b
//   .open ('script')
//   .open ('div')

var cur =  b
  .open ('script')
  .open ('frameset')
  .open ('div')

// log (util.inspect(b, {depth:100}))
log (util.inspect (b.document, {depth:200}))


// .append ('head')
// .open ('body')
// .open ('td')
// .open ('li')
// .open ('span')
// // .close ('li')
// .open ('applet')
// // .close ('body')
// // .close ('applet')
// // .close ('li')
// .open ('table')
// .open ('td')
//*/