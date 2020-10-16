const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, tokenName } = require ('./lexer')

// Token builder
// =============

class Compound extends Array {
  constructor (typeId, start = null) {
    super ()
    this[0] = typeId
    this.start = start
    this.content = []
    this.end = null
  }
  get [Symbol.toStringTag] () {
    return tokenName (this[0])
  }
}

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
    // TODO flush rest
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
          const node = new Compound (type, v)
          stack.unshift (node)
          if (type === T.StartTag) node.name = v.substr (1)
          else if (type === T.EndTag) node.name = v.substr (2)
        break

        case R.End:
          // TODO close-or-ignore mismatched end tag?
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
            if (stack.length) stack[0].content.push (v)
            else output [output.length] = v
          }
          break

          default: if (v.length) {
            if (stack.length) stack[0].content.push ([type, v])
            else output [output.length] = [type, v]
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

module.exports = { TokenBuilder }