const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, typeName } = require ('./lexer')


// TokenBuilder 'DOM'
// ------------------

class Compound {
  constructor (typeId, start = null) {
    this.type = typeId
    this.name = null
    this.start = start
    this.content = []
    this.end = null
  }
  get [Symbol.toStringTag] () {
    return typeName (this.type)
  }
  *[Symbol.iterator] () {
    yield this.type
    yield this.name
    yield this.attributes
  }
}

// The following is used by the parser to create implicit start tags.

function makeTagToken (type, name) {
  const n = new Compound (type, null)
  n[1] = n.name = name
  return n
}


// Token builder
// =============

function TokenBuilder () {
  const self = this
  let output, stack
  let tag, selfclose, attributes, attribute, value

  // API

  const enumerable = true
  Object.defineProperty (this, 'state', { get: $=> ({ output, stack }) })
  Object.assign (this, { reset, write, batchWrite, read, readAll, end })
  return reset ()

  // Implementation

  function reset () {
    output = []
    stack = []
    tag = null
    selfclose = false
    attributes = Object.create (null)
    attribute = ''
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
    for (const token of chunks) {
      let [type, v] = token, t = type & typeMask
      
    switch (type) {

      case T.StartTag|R.Start:
        tag = new Compound (R.Start, v)
        tag.name = tag[1] = v.substr (1)
        selfclose = false
      break

      case T.EndTag|R.Start:
        tag = new Compound (R.End, v)
        tag.name = tag[1] = v.substr (2)
      break
      
      case T.Bogus|R.Start:
      case T.Comment|R.Start:
        output[output.length] = [type, '#comment']
      break

      case T.Bogus|R.End:
      case T.Comment|R.End:
        output[output.length] = [type, '#comment']
      break

      case T.StartTag|R.End:
        // NB Assumes that the lexer emits balanced start/end markers
        tag.attributes = tag[2] = attributes
        tag.end = v
        if (selfclose) { // Hacked in
          tag.selfclose = true
          tag.end = '/>'
        }
        output [output.length] = tag
      break

      case T.EndTag|R.End:
        // NB Assumes that the lexer emits balanced start/end markers
        tag.end = v
        output [output.length] = tag
      break

      case T.BeforeAtt: 
        selfclose = v[v.length-1] === '/'
      break

      case T.AfterAttName:
      case T.Assign:
      case T.BeforeValue: 
        selfclose = false
      break // Ignore

      case T.AttName:
        if (!(v in attributes)) {
          attribute = v
          attributes[v] = ''
        }
        else attribute = null
      break

      case T.Value:
        if (attribute)
          attributes [attribute] +=  v
      break
      
      // case T.Bogus: case T.Comment:
      // case T.RcData: case T.RawText: case T.PlainText:
      // case T.Value: case T.Data:
      default: if (! (type &(R.Start|R.End)) && v.length) {
        output [output.length] = [type, v]
        selfclose = false
      }
    }}
    return self
  }

}


// Exports
// -------

Object.assign (TokenBuilder, { makeTagToken })
module.exports = TokenBuilder