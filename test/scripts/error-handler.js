import { domex, Domex } from '../../dist/domex.min.js'
const { entries } = Object

// Use Symbol.toStringTag to always return constructor.name

Object.defineProperty (Object.prototype, Symbol.toStringTag, 
  { get: function () { return this.constructor.name } })

// Render Errors using domex:

const errorDx = domex `
  span @StackFrame
    > " » "
    + a.error [href=%href title=%url] %message;

  div @error
    > h2.br0 %name ~error
    + div.hlist > @StackFrame *stack;

  div.layer.error.notification.p1
    > @error`

const errsDiv =
  document.createElement ('div')

function clearErrors () {
  errsDiv.innerHTML = ''
}

function showError (evt) {
  const { error, message, filename:url, lineno:line, colno:col } = evt
  const stack = parseStack (error.stack || String (error))
  const href = rewriteUrl (url, line, col) .href
  stack.push ({ message, line, col, url, href })
  if (!errsDiv.parentNode) document.body.append (errsDiv)
  errsDiv.append (errorDx.render ({ error, message:evt.message, stack }) .elem)
}

function parseStack (stack) {
  const result = []
  for (let sline of stack.split ('\n')) {
    let message, rest, line, col, url, _;
    [message, rest] = sline.split (/@?(?=\bfile:[/][/])/i) // FF, Safari
    if (rest) {
      const [_, url, line, col] = /^(.*)[:](\d+)[:](\d+)$/ .exec (rest)
      const href = rewriteUrl (url, line, col) .href
      result.unshift ({ message, url, line, col, href })
    }
  }
  return result
}

// convert file-URLs to to txmt: URL
function rewriteUrl (url1, line = 1, column = 0) {
  const url = new URL (url1, document.baseURI)
  if (url.protocol === 'file:') {
    const callbackUrl = new URL ('txmt://open?')
    entries ({ url:decodeURI(url.href), line, column }) .forEach (kv => callbackUrl.searchParams.set (...kv))
    return callbackUrl
  }
  entries ({ line, column }) .forEach (kv => url.searchParams.set (...kv))
  return url1
}

// Main

window.addEventListener ('error', showError)
window.addEventListener ('keydown', evt => evt.metaKey && evt.code == 'KeyK' ? clearErrors () : null)