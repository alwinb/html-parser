import { domex, Domex } from '../../dist/domex.min.js'
const { entries } = Object

// Use Symbol.toStringTag to always return constructor.name

Object.defineProperty (Object.prototype, Symbol.toStringTag, 
  { get: function () { return this.constructor.name } })

// Render Errors using domex:

const errorDx = domex `
  a.error @frame
    [href=%href title=%url] " » " %message " ";

  div @error
    > h2.br0 %name ~error
    + div.hstack.p0 > @frame *stack;

  div.layer.error.notification.m4.pp6 [style="background:#fffd"]
    > @error`

function showError (evt) {
  const { error, message, filename:url, lineno:line, colno:col } = evt
  const stack = parseStack (error.stack || String (error))
  const href = rewriteUrl (url, line, col) .href
  stack.push ({ message, line, col, url, href })
  document.body.appendChild (errorDx.render ({ error, message:evt.message, stack }) .elem)
}

function parseStack (stack) {
  const result = []
  for (let sline of stack.split ('\n')) {
    let message, line, col, url, _;
    [message, rest] = sline.split (/@?(?=\bfile:[/][/])/i) // FF, Safari
    if (url) {
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
  if (url.protocol === 'file:' || url.protocol === 'x-txmt-filehandle:') {
    callbackUrl = new URL ('txmt://open?')
    entries ({ url, line, column }) .forEach (kv => callbackUrl.searchParams.set (...kv))
    return callbackUrl
  }
  entries ({ line, column }) .forEach (kv => url.searchParams.set (...kv))
  return url1
}

// Main

window.addEventListener ('error', showError)