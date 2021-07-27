const log = console.log.bind (console)
const { defineProperty:def, assign } = Object
const util = require ('util')

const hide = (obj, dict) => {
  for (const k in dict)
    def (obj, k, { value: dict[k], enumerable:false })
}

// Names and Categories
// --------------------

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
const idnames = {}
for (const k of _names)
  idnames[k] = 1n << ++count
idnames._other = 1n << ++count

const { html,
  head,
    title, link, script, style, meta,
  body,
    table, caption, colgroup, col,
      tbody, tr, td,
    ul, ol, li,
    dl, dd, dt,
  applet, _other } = idnames


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
  for (let k in idnames)
    if (idset_ & idnames[k])
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


// Dom
// ---

function Node (name) {
  this.name = name
  this.children = []
}


// Context / Stack-frame
// ---------------------

class Frame {
  
  constructor (name, idname, context = { }) {
    const {
      allowed = Any,
      closable = None, openable = None, 
      openFor = None, paths = null } = context

    assign (this, {
      name, idname,
      closable: closable | idname,
      openable, allowed,
      openFor, paths })

    this.node = new Node (name)
    // hide (this, { node })
  }

  child (name, idname, closeCount) {
    if (idname & this.allowed) {
      const {
        allowEnd = Any,
        escalate = Any,
        content = this.allowed,
        openFor = None,
        paths = null
      } = this.getRule (name, idname, closeCount)

      return new Frame (name, idname, {
        closable: this.closable & allowEnd | idname,
        allowed: content,
        openable: this.openable & escalate | content | openFor,
        openFor, paths
      })
    }
    return null
  }

  getRule (name, idname, closeCount) {
    log ('getRule for tag', name, 'in', this.name, closeCount)
    if (closeCount & head) log ('afterHead!'); else  log ('beforeHead')

    let r
    if (idname & html && closeCount & head) {
      r = afterHeadRule
    }
    // else if (this.idname & html && idname & head){//} && closeCount & head) {
    //   r = {
    //     closable: None,
    //     content: head | body,
    //     escalate: Any,
    //     openFor: None,
    //   }
    // }
    else r = mainRules [name] || mainRules._default
    log (r)
    return r
  }

  get info () {
    return {
      name: this.name,
      idname: printInfo (this.idname),
      closable: printInfo (this.closable),
      openable: printInfo (this.openable),
      content: printInfo (this.allowed),
      openFor: printInfo (this.openFor),
    }
  }

}


// Tree Builder
// ------------

function TreeBuilder ({ minDepth = 2 } = { }) {
  
  const self = this
  const root = new Frame ('#document', 0n, { allowed: html, openFor:Any, paths: { _default:'html' } })
  const stack = this.stack = [root]
  const document = root.node
  let tip = root
  // clever idea ? just or-in any tag that is closed, that gives enough state!
  this.closeCount = 0n
  hide (this, { root, document, minDepth:2, open, append, close, lookup, log })


  // May trigger sequences of escalating (closing) and expanding (inserting)
  // multiple tags. I just limit to two; one can construct schemas that allow 
  // any finit (or infinite) amounts

  function open (name) {
    log ('try open', name)
    const idname = idnames[name] || idnames._other
    let i=0

    for (;i<2;i++) {
      // log ('loop', i)
      log ('is allowed? ::', name, idname ,'in', tip.info, '?', idname & tip.allowed)
      if (idname & tip.allowed)
        return _open (name, idname)

      if (idname & tip.openable) {
        log ('try escalate ::', name)
        const cursor = escalate (name, idname)
        const closes = _close (cursor.index + 1)
        if (closes && closes.length)
          log (`OK - closed for open ::`, closes .map (_ => _.name) .join (' < ' ))
        if (cursor.done)
          return _open (name, idname)
      }

      if (idname & tip.openFor) {
        log ('try extend')
        const inserts = search (name, idname)
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
            return _open (name, idname)
        }
      }
    }
    // log ('Err - did not open', name)
    return self
  }

  function append (name) {
    const node = new Node (name)
    tip.node.children.push (node)
    return self
  }


  function close (name) {
    const idname = idnames[name] || idnames._other
    const cursor = lookup (name, idname)
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

  function _open (name, idname) {
    const tip_ = tip.child (name, idname, self.closeCount)
    // log ('finally, open', name)
    tip.node.children.push (tip_.node)
    self.stack.push (tip = tip_)
    // log ('OK - opened', name)
    return self
  }

  function _close (index = stack.length - 1) {
    if (index < self.minDepth) return null
    const closes = []
    while (stack.length > index) {
      const _pop = stack.pop ()
      self.closeCount |= _pop.idname
      closes.push (_pop) }
    _afterClose ()
    return closes
  }

  function _afterClose () {
    // For the sibling rules, update the parent of _tip,
    // and thus, _tip as well
    const p = stack[stack.length-2]
    const _tip = stack.pop ()
    tip = p.child (_tip.name, _tip.idname, self.closeCount)
    tip.node = _tip.node
    stack.push (tip)
    log ('sibling-updated', {_tip, tip})
  }
  
  // Querying
  
  function lookup (name, idname) { // tags to be closed for an endtag
    for (let i=stack.length-1; i>=0; i--) {
      if (stack[i].name === name)
        return { index:i, frame:stack[i] }
      if (!(stack[i].closable & idname))
        return
    }
  }

  function escalate (name, idname) { // to be closed for insert
    for (let i=stack.length-1; i >= 0; i--) {
      if (idname & stack[i].allowed)
        return { index:i, frame:stack[i], done:true }
      if (idname & stack[i].openFor)
        return { index:i, frame:stack[i], done:false }
    }
  }

  function search (name, idname) { // to be opened for insert
    const inserts = []
    let tip_ = tip, ins
    // log ('search', tip_)
    while (tip_ && !(tip_.allowed & idname) && tip_.openFor & idname) {
      const name_ = name in tip_.paths ? tip_.paths[name] : tip_.paths._default
      tip_ = tip_.child (name_, idnames[name_] || idnames._other, self.closeCount)
      inserts.push (tip_)
      // log ('search...', tip_)
    }
    return { path:inserts, done:tip_.allowed & idname } // ? { path:inserts } : null
    // REVIEW what about invalid schemas?
  }

  // Debugging

  function log (...msgs) {
    console.log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}


// Test
// ====

const b = new TreeBuilder ()

var cur =  b
  .open ('script')
  .open ('div')

// log (util.inspect(b, {depth:100}))
log (util.inspect(b.document, {depth:200}))


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
