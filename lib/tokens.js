const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, typeName } = require ('./lexer')


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
    return typeName (this[0])
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
  let output, stack, selfclose = false

  // API

  const enumerable = true
  Object.defineProperty (this, 'state', { get: $=> ({ output, stack }) })
  Object.assign (this, { reset, write, batchWrite, read, readAll, end })
  return reset ()

  // Implementation

  function reset () {
    output = []
    stack = []
    selfclose = false
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
    let token, type, v
    for (let token of chunks) switch (([type, v] = token, type) & roleMask) {

      case R.Start:
        const t = type &= typeMask
        const node = new Compound (t, v)
        if (t === T.EndTag)
          node.name = v.substr (2)
        else if (t === T.StartTag)
          node.name = v.substr (1)
        stack.unshift (node)
        selfclose = false
      break

      case R.End:
        // NB Assumes that the lexer emits balanced start/end markers
        if (stack.length) {
          const node = stack.shift ()
          node.end = v
          if (type & T.StartTag && selfclose) { // Hacked in
            node.end = '/>'
            node.selfclose = true
          }
          selfclose = false
          if (stack.length) stack[0].content.push (node)
          else output [output.length] = node
        }
      break

      default: switch (type & typeMask) {
        case T.BeforeAtt: 
          selfclose = v[v.length-1] === '/'
        break

        case T.AfterAttName:
        case T.Assign: case T.BeforeValue: 
          selfclose = false
        break // Ignore

        // case T.Bogus: case T.Comment:
        // case T.RcData: case T.RawText: case T.PlainText:
        // case T.Value: case T.Data:
        default: if (v.length) {
          if (stack.length) stack[0].content.push (token)
          else output [output.length] = token
          selfclose = false
        }
      }
    }
    return self
  }

}


// Exports
// -------

Object.assign (TokenBuilder, { makeTagToken })
module.exports = TokenBuilder