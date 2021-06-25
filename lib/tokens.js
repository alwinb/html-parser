const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, tokenName } = require ('./lexer')


// TokenBuilder 'DOM'
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

// The following is used by the parser to create implicit start tags.

function makeTagToken (type, name) {
  const n = new Compound (type, null)
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
  Object.assign (this, { reset, write, batchWrite, read, readAll, end })
  return reset ()

  // Implementation

  function reset () {
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
    while (stack.length) {
      const node = stack.shift ()
      if (stack.length) stack[0].content.push (node)
      else output [output.length] = node
    }
    return self
  }

  function write (chunk) {
    return batchWrite ([chunk])
  }

  function batchWrite (chunks) {
    for (let [type, v] of chunks) switch (type & roleMask) {

      case R.Start:
        type &= typeMask
        const node = new Compound (type, v)
        if (type === T.EndTag)
          node.name = v.substr (2)
        else if (type === T.StartTag)
          node.name = v.substr (1)
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

      default: switch (type &= typeMask) {
        case T.BeforeAtt: case T.AfterAttName:
        case T.Assign: case T.BeforeValue: break // Ignore

        // case T.Bogus: case T.Comment:
        // case T.RcData: case T.RawText: case T.PlainText:
        // case T.Value: case T.Data:
        default: if (v.length) {
          const token = [type, v]
          if (stack.length) stack[0].content.push (token)
          else output [output.length] = token
        }
      }
    }
    return self
  }

}

module.exports = { TokenBuilder, makeTagToken }