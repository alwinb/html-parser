(()=>{
const svgns = 'http://www.w3.org/2000/svg'
const htmlns = 'http://www.w3.org/1999/xhtml'
const log = (...args) => globalThis.console.log (...args)
const _console = console

// DOM Utils 
// ---------

const Svg = (...args) => _DomNS (svgns, 'g', ...args)
const Dom = (...args) => _DomNS (htmlns, 'div', ...args)

function _DomNS (ns, _default, tagname, ...subs) {
  var names = tagname.split ('.')
  tagname = names.length ? names.shift () : _default
  var el = document.createElementNS (ns, tagname)
  for (let name of names) el.classList.add (name)
  for (let sub of subs) el.append (sub)
  return el
}

function setProps (el, obj) {
  for (const [k,v] of Object.entries (obj))
    el.setAttribute (k, v)
  return el
}

// In-page Console
// ===============

class Console {

  constructor () {
    this.elem = Dom ('div.Console')
      this.elem.append (this.pre0 = Dom ('pre'), this.pre = Dom ('pre'))
    this.count = 0
    this.hover = false
    this.elem.addEventListener ('mouseover', evt => this.hover = true)
    this.elem.addEventListener ('mouseout', evt => this.hover = false)
    setProps (this.elem, { style:'tab-size:2;' })
  }

  log   (...msgs) { this._log ('log',   msgs) }
  error (...msgs) { this._log ('error', msgs) }
  info  (...msgs) { this._log ('info',  msgs) }
  warn  (...msgs) { this._log ('warn',  msgs) }

  write (...elems) {
    this.pre.append (...elems)
  }

  _log (tag, msgs) {
    _console.log (...msgs)
    // 2000 logs buffer over two 'pages'
    if (this.count > 1000) {
      this.pre0.remove ()
      this.pre0 = this.pre
      this.elem.append ((this.pre = Dom ('pre')))
      this.count = 0
    }
    this.count++
    const el = Dom (`span.${tag}`)
    el.append (...(msgs.map ($ => String ($) + ' ')))
    this.pre.append (el, '\n')
    if (!this.hover) this.elem.scrollTo (0, this.elem.scrollHeight)
  }

  clear () {
    this.count = 0
    this.pre0.innerHTML = this.pre.innerHTML = ''
  }

  errorHandler ({ message, filename, line=1, column=0, error }) {
    const stack = parseStack (error.stack)
    this.write (...stack.flatMap (_renderStackFrame))
    // Hm an error.name?
    this.error (error.message)
  }
}

function parseStack (stack) {
  const r = []
  for (let sline of stack.split ('\n')) {
    let msg, line, col, url, _
    [msg, url] = (sline.split (/@?(?=\bfile:[/][/])/i)) // FF, Safari
    if (url) {
      [_, url, line, col] = /^(.*)[:](\d+)[:](\d+)$/.exec (url)
      r.push ({ msg, url, line, col })
    }
  }
  return r.reverse()
}

function _renderStackFrame ({ msg, url, line, col }) {
  if (url != null) {
    const a = Dom ('a.error', msg)
    const href = _rewriteUrl (url, line, col)
      setProps (a, { href, title:url+`?line=${line}&column=${col}` })
    return [a, ' » ']
  }
  else return [Dom('span.error', msg), '\n']
}

function _rewriteUrl (url1, line = 1, column = 0) {
  const url = new URL (url1, document.baseURI)
  if (url.protocol === 'file:' || url.protocol === 'x-txmt-filehandle:') { // convert to txmt: URL
    callbackUrl = new URL ('txmt://open?')
    Object.entries ({ url, line, column }) .forEach (kv => callbackUrl.searchParams.set (...kv))
    return callbackUrl
  }
  Object.entries ({ line, column }) .forEach (kv => url.searchParams.set (...kv))
  return url1
}

//const log = console.log.bind (console)
//_renderStackLine ('asdasdf')
// _renderStackLine ('file://')
globalThis.Console = Console
globalThis.Dom = Dom
globalThis.setProps = setProps
})()