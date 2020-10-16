const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, tokenName } = require ('./lexer')
const { categories:C, defaultInfo, info:elementInfo }  = require ('./schema.js')


// TokenDuilder 'DOM'
// ------------------

class Compound {
  constructor (typeId, start = null) {
    Object.defineProperty (this, 0, { value: typeId })
    this.start = start
    this.content = []
    this.end = null
  }
  get [Symbol.toStringTag] () {
    return tokenName (this[0])
  }
}

// The following is used by the parser for implicit start tags.

function makeStartTagToken (name) {
  const n = new Compound (T.StartTag, null)
  n.name = name
  return n
}


// Token builder
// =============

function TokenBuilder () {
  const self = this
  let output, stack

  // API

  const enumerable = true
  Object.defineProperty (this, 'state', { get: $=> ({ output, stack }) })
  Object.assign (this, { start:restart, restart, write, batchWrite, read, readAll, end })
  return this.start ()


  // Implementation

  function restart () {
    output = []
    stack = []
    return self
  }

  function* read () {
    yield* output
    output = []
    return self
  }

  function readAll () {
    const r = output
    output = []
    return r
  }

  function end () {
    // TODO Validate: may want to tag the token as being cut-off
    // FIXME TODO flush rest
    return self
  }

  function write (chunk) {
    return batchWrite ([chunk])
  }

  function batchWrite (chunks) {
    for (let [type, v] of chunks) {
      switch (type & roleMask) {

        case R.Start:
          type = type & typeMask
          let name = null
          if (type === T.EndTag) {
            name = v.substr (2)
            type = elementInfo [name] & C.format ? T.FormatEndTag : type
          }
          else if (type === T.StartTag) {
            name = v.substr (1)
            type = elementInfo [name] & C.format ? T.FormatTag : type
          }
          const node = new Compound (type, v)
          if (name) node.name = name
          stack.unshift (node)
        break

        case R.End:
          // NB Assumes that the lexer emits balanced start/end markers
          if (stack.length) {
            const node = stack.shift ()
            node.end = v
            if (stack.length) stack[0].content.push (node)
            else output [output.length] = node
          }
        break

        default: switch (type & typeMask) {
          case T.BeforeAtt: case T.AfterAttName:
          case T.Assign: case T.BeforeValue:
            // Ignore
          break

          case T.Bogus: case T.Comment:
          case T.RcData: case T.RawText: case T.PlainText:
          case T.Value: case T.Data: if (v.length) {
            const token = [type & typeMask, v]
            if (stack.length) stack[0].content.push (token)
            else output [output.length] = token
          }
          break

          default: if (v.length) {
            const token = [type & typeMask, v]
            if (stack.length) stack[0].content.push (token)
            else output [output.length] = token
          }
        }
      }
    }
    return self
  }

  /*
  const entities = {
    'amp;':'&',
    'lt;':'<',
    'gt;':'>',
    'quot;':'"',
    'AMP;':'&',
    'LT;':'<',
    'GT;':'>',
    'QUOT;':'"',
    'apos;':"'",
  }

  const parseDecimal = str => String.fromCodePoint (parseInt (str, 10))
  const parseHex = str => String.fromCodePoint (parseInt (str, 16))
  const parseNamed = str => { return entities [str + (str.substr (-1) !== ';' ? ';' : '')] || '&' + str }
  // TODO, add a compressed map of named entities?
  */
}

module.exports = { TokenBuilder, makeStartTagToken }