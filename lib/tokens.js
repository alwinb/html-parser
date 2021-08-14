const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, typeName } = require ('./lexer')


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
    attributes = null
    attribute = null
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
      const [type, v] = token, t = type & typeMask
      // log ([typeName (type), v])
      
    switch (type) {

      case T.StartTag|R.Start:
        tag = [R.Start, v.substr (1)]
        attributes = Object.create (null)
        selfclose = false
      break

      case T.EndTag|R.Start:
        tag = [R.End, v.substr (2)]
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
        if (attribute != null)
          attributes [attribute] += v
      break

      case T.NamedRef:
      case T.NumRef:
      case T.HexRef:
        if (!tag) output [output.length] = [type, v]
        else if (attribute != null) attributes [attribute] += v
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

TokenBuilder.TokenBuilder = TokenBuilder
module.exports = TokenBuilder