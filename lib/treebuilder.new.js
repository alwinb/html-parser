const { defineProperty:def, assign } = Object
const log = console.log.bind (console)
const util = require ('util')

const hidden = (obj, dict) => {
  for (const k in dict)
    def (obj, k, { value: dict[k], enumerable:false })
}

/* Names and Kinds
// ---------------

const _names = `html 
  head
    title link script style meta 
  body
    table caption colgroup col
      tbody tr td
    ul ol li
    dl dd dt
  applet` .split (/\s+/)

let count = 0n
const kinds = {}
for (const k of _names)
  kinds[k] = 1n << ++count

const _otherKind = kinds._other = 1n << ++count

const { html,
  head,
    title, link, script, style, meta,
  body,
    table, caption, colgroup, col,
      tbody, tr, td,
    ul, ol, li,
    dl, dd, dt,
  applet, _other } = kinds


// Sets
// ----

const None = 0n
const Any = -1n

const headContent =
  title | link | script | style | meta

const bodyContent =
  ~( head | body | caption | colgroup | col | tbody | td )

function printInfo (idset) {
  const idset_ = idset < 0 ? ~idset : idset
  if (idset === Any) return 'Any'
  if (idset === None) return 'None'
  const r = []
  for (let k in kinds)
    if (idset_ & kinds[k])
    r.push (k)
  return (idset < 0 ? '~( ' : '( ') + r.join (' | ') + ' )'
}


// Rules
// -----

const afterHeadRule = {
  escalate: None,
  content: body,
  openFor: Any,
  paths: { _default: 'body' }
}

const mainRules = {
  
  html: {
    closable: None,
    escalate: None,
    content: head | body,
    openFor: Any,
      paths: { _default: 'head' }
  },

  head: {
    content: headContent,
    escalate: Any,
  },
  
  body: {
    content: bodyContent,
  },

  table: {
    content: caption | colgroup | tbody,
    openFor: tr | td,
      paths: { tr:'tbody', td:'tbody', col:'colgroup', }
  },

  tbody: {
    content: tr,
    openFor: td,
      paths: { td:'tr' }
  },

  tr: {
    content: td
  },

  applet: {
    allowEnd: None,
  },

  script: {
     content:None,
     escalate:Any,
  }, // idem for all other void tags

  _default: {
    content: bodyContent
  }
}
//*/

// Use existing schema / kinds

const {
  E, C, Any, None, 
  printInfo, 
  elementInfo: kinds,
  defaultInfo: otherKind,
} = require ('./categories')

const { getRule } = require ('./schema')

const { html, head, body } = E
const { cell:td, other:_other } = C


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
    const {
      namespace = None,
      content = Any,
      closable = None,
      openable = None, 
      openFor = None, paths = null,
      redirect = None, redirectStack = null } = context

    assign (this, {
      namespace,
      name, kind,
      closable: closable | kind,
      openable: openable | content | openFor,
      content,
      openFor, paths,
      redirect, redirectStack })

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
        redirect = None, redirectStack = null,
      } = getRule (this, name, kind, this.children)

      const content_ = content &~ forbid | allow
      const childFrame = new Frame (name, kind, {
        namespace,
        closable: this.closable & allowEnd,
        openable: this.openable & escalate,
        content: content_,
        openFor, paths,
        redirect, redirectStack,
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
      // redirectParent: redirectStack && redirectStack[0].node.name,
      // node
    }
  }

}


// Tree Builder
// ------------

function TreeBuilder ({ minDepth = 2, verbose = false } = { }) {
  
  const self = this
  // TODO parameterise the initial context, for redirection ;)
  const root = new Frame ('#document', 0n, { content: html, openFor:Any, paths: { '#default':'html' } }) // NB was _default
  const stack = this.stack = [root]
  const document = root.node
  let tip = root
  // clever idea ? just or-in any tag that is closed, that gives enough state!
  this.closeCount = 0n
  hidden (this, { root, document, minDepth:2, open, append, close, lookup, log })


  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I just limit to two; one can construct schemas that allow 
  // any finit (or infinite) amounts

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
      log ({name_})
      // tip_.children = self.closeCount // FIXME HACK
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

// Director
// --------

function direct (tokens) {
  
  const builder = new TreeBuilder ()
  let collected = new TreeBuilder ()

  // just strings for now

  for (const tag of tokens)  { 
    const l = builder.stack.length - 1
    let context = builder.stack [l]

    // ### End tags

    if (tag.substring (0, 2) === '</') {
      const name = tag.substr (2, tag.length-3)
      const kind = kinds[name] || otherKind

      // TODO also adjust the kind
      // based on attributes

      // Exceptions
      if (kind & E.br) {
        handle (new Leaf (name), E.br, tag)
        continue
      }

      if (kind & E.p && !(context.closable & E.p)) {
        // TODO figure out how this should be redirected!
        handle (name, E.p, '<p>')
        handle (name, E.p, tag)
        continue
      }
      
      handle (name, kind, tag)
      continue
    }

    // ### Start tags

    if (tag[0] === '<') {
      const name = tag.substr (1, tag.length-2)
      const kind = kinds[name] || otherKind
      
      // Exceptions
      if (name === 'image') {
        handle (new Leaf ('img'), E.img, tag)
        continue
      }
      
      if (kind & C.void) {
        handle (new Leaf (name), kind, tag)
        continue
      }

      // TODO the attribute filtering
      // if (name === 'annotation-xml' && context.namespace = E.math) {
      //   builder.open ('annotation-xml')
      //   continue
      // }

      if (kind & E.select && context.closable & E.select) { 
        // TODO what about redirection / of select tags?
        builder.close (name, kind)
        continue
      }

      handle (name, kind, tag)
      continue
    }


    else {
      const kind = tag[0] === ' ' ? C.SPACE : C.TEXT
      // log ('other:', {tag}, context.info, printInfo (kind))
      handle (tag, kind, tag)
      continue
    }


    function handle (item, kind, _tag) {

      // Direct to the appropriate target
      // NB TODO don't pass _tag like that, but pre-annotate
      // TODO reset the document for each table, actually add it, ao

      let target = context.redirect & kind && context.closable & E.table
        ? collected : builder

      if (_tag.substr (0,2) === '</')
        target.close (item, kind)

      else if (kind & (C.TEXT | C.SPACE | C.void))
        target.append (item, kind)

      else if (_tag[0] === '<')
        target.open (item, kind)

    }

  }
  
  log (util.inspect (builder.document, {depth:Infinity}))

  log (util.inspect (collected.document, {depth:Infinity}))
  
}


// Test
// ====

// const End = 1, Start = 2

direct ([
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
])



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