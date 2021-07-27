const log = console.log.bind (console)
const { defineProperty:def } = Object
const util = require ('util')

const hide = (obj, dict) => {
  for (const k in dict)
    def (obj, k, { value: dict[k], enumerable:false })
}

// Names
// -----

const _names = `html 
  head
    link script style meta 
  body
    table caption colgroup col
      tbody tr td
    ul ol li
    dl dd dt
  applet` .split (/\s+/)

let count = 0n
const idnames = {}
for (const x of _names)
  idnames[x] = 1n << ++count
idnames._other = 1n << ++count

const { html,
  head,
    link, script, style, meta,
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

const bodyContent =
  ~( head | body | caption | colgroup | col | tbody | td )



// Rules
// -----

const childRules = {
  
  html: {
    content: head | body,
    openFor: Any,
      paths: { _other: 'body' }
  },

  head: {
    content: link | script | style | meta
  },
  
  body: {
    content: bodyContent,
    openFor: td,
      paths: { td:'table' }
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

  _other: {
    content: bodyContent
  }
}

const siblingRules = { /* for later */ }



// Dom
// ---

function Node (name) {
  this.name = name
  this.children = []
}


// Context / Stack-frame
// ---------------------


function Frame (name, context = { }) {

  const { allowed = Any,
    closable = None, openable = None, 
    openFor = None, paths = null } = context

  this.name = name
  this.idname = idnames [name] || idnames._other

  this.closable = closable | this.idname
  this.openable = openable
  this.allowed = allowed
  this.openFor = openFor
  this.paths = paths
  this.node = new Node (name)
  hide (this, {  child })
  const self = this

  function child (name) {
    const idname = idnames [name] || idnames._other

    if (idname & self.allowed) {
      const {
        allowEnd = Any,
        content = self.allowed,
        escalate = Any,
        openFor = None, 
          paths = null,
      } = childRules [name] || childRules._other
      
      return new Frame (name, {
        closable: self.closable & allowEnd,
        allowed: content,
        openable: self.openable & escalate | content | openFor,
        openFor, paths
      })
    }

    else return null
  }

}


// Tree Builder
// ------------

function TreeBuilder ({ minDepth = 2 } = { }) {
  
  const self = this
  const root = new Frame ('#document', { content: html })
  const stack = this.stack = [root]
  let tip = root
  hide (this, { root, minDepth:2, open, append, close, lookup, log })


  function open (name) {
    log ('try open', name)
    const idname = idnames[name] || idnames._other

    if (idname & tip.allowed)
      return _open (name)

    // log ('cannot open yet', tip)
    if (idname & tip.openable) {
      const cursor = escalate (name)
      // log ('escalate?', cursor)
      const closes = _close (cursor.index + 1)
      // log (closes)
      if (closes && closes.length)
          log ('OK - closed for open ::', closes.length, closes .map (_ => _.name) .join (' < ' ))
      if (cursor.done)
        return _open (name)
    }

    // log ('cannot open yet', tip)
    if (idname & tip.openFor) {
      const inserts = search (name)
      if (inserts) {
        log ('path found ::', inserts.path.map (_ => _.name) .join (' > ' ))
        for (const tip_ of inserts.path) {
          tip_.node.children.push (tip_.node)
          self.stack.push (tip = tip_)
        }
        log ('path opened')
        return _open (name)
      }
    }

    log ('Err - dod not open', name)
    return self
  }

  function _open (name) {
    const tip_ = tip.child (name)
    log ('finally, open', name)
    tip.node.children.push (tip_.node)
    self.stack.push (tip = tip_)
    log ('OK - opened', name)
    return self
  }

  function append (name) {
    const node = new Node (name)
    tip.node.children.push (node)
    return self
  }


  function close (name) {
    const cursor = lookup (name)
    if (cursor) {
      const closes = _close (cursor.index)
      if (closes) {
        // log ('OK - closed ::', closes .map (_ => _.name) .join (' < ' ))
        return self
      }
    }
    // log ('ERR - cannot close ', name)
    return self
  }


  function _close (index = stack.length - 1) {
    if (index < self.minDepth)
      return null
    const closes = []
    while (stack.length > index)
      closes.push (stack.pop ())
    return closes
  }


  function lookup (name) { // for closing
    const idname = idnames[name] || idnames._other
    for (let i=stack.length-1; i>=0; i--) {
      if (stack[i].name === name)
        return { index:i, frame:stack[i] }
      if (!(stack[i].closable & idname))
        return
    }
  }


  function escalate (name) { // for insert
    const idname = idnames[name] || idnames._other
    for (let i=stack.length-1; i >= 0; i--) {
      if (idname & stack[i].allowed)
        return { index:i, frame:stack[i], done:true }
      if (idname & stack[i].openFor)
        return { index:i, frame:stack[i], done:false }
    }
  }


  function search (name) { // for insert
    const inserts = []
    const idname = idnames[name] || idnames._other

    let frame = tip
    while (!(frame.allowed & idname) && frame.openFor & idname) {
      // console.log ('search path', frame)
      frame = frame.child (name in frame.paths ? frame.paths[name] : frame.paths._default)
      inserts.push (frame)
    }
    // log ('SEARCH ends', frame.allowed & idname)
    // frame = frame.child (name in frame.paths ? frame.paths[name] : frame.paths._default)
    // inserts.push (frame)
    // log (inserts)
    return frame.allowed & idname ? { path:inserts } : null
  }


  function log (...msgs) {
    console.log ('\n' + stack.map (_ => _.name) .join (' > '), ...(msgs.length ? ['::', ...msgs] : []))
    return self
  }

}



// Test
// ====

const b = new TreeBuilder ()

var cur = b.open ('html')
  .append ('head')
  .open ('body')
  .open ('td')
  .open ('li')
  .open ('span')
  // .close ('li')
  .open ('applet')
  // .close ('body')
  // .close ('applet')
  // .close ('li')
  .open ('table')
  .open ('td')



