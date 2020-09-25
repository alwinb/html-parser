const log = console.log.bind (console)
const { tokenTypes:T, tokenRoles:R, roleMask, typeMask, tokenName } = require ('./lexer')

// Token builder
// =============

class Compound extends Array {
  constructor (typeId) {
    super ()
    this[0] = typeId
    this.start = null
    this.content = []
    this.end = null
  }
  toString () {
    return `${this.start}${this.children.join('')}${this.end}`
  }
}

function TokenBuilder () {
  let output, token, attrs, attr, attname
  let stack, compound
  restart ()

  // API

  const enumerable = true
  Object.defineProperties (this, {
    output: { get: $=> output, enumerable },
    token:  { get: $=> token,  enumerable },
    attrs:  { get: $=> attrs,  enumerable },
    attr:   { get: $=> attr,   enumerable }, })
  Object.assign (this, { start:restart, restart, write, batchWrite, read, readAll, end })

  // Implementation

  function restart () {
    token = attr = null
    attrs = []
    output = []
    stack = [], compound = null
  }

  function* read () {
    yield* output
    output = []
  }

  function readAll () {
    const r = output
    output = []
    return r
  }

  function write (chunk) {
    batchWrite ([chunk])
  }

  function batchWrite (chunks) {
    for (let [type, v] of chunks) {
      switch (type & roleMask) {

        case R.Start:
          stack.push (compound = new Compound (type & typeMask))
          compound.start = v
        break

        case R.End:
          // TODO close-or-ignore mismatched end tag
          if (compound) {
            compound.end = v
            stack.pop ()
            if (!stack.length) output.push (compound)
            compound = stack [stack.length-1]
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
            if (compound) compound.content.push (v)
            else output [output.length] = v
          }
          break

          default: if (v.length) {
            if (compound) compound.content.push ([type, v])
            else output [output.length] = [type, v]
          }
        }
      }
    }
  }

  function end () {
    // log ('TokenBuilder.end, in state', this._getState ())
    // Validate: may want to tag tokens as being cut-off
    if (token) emitToken (token)
    token = attr = null
    attrs = []
  }

  //   // So with these lexer modifications,
  //   // now I have access to role, and token
  //
  //   // which can help make this all a lot cleaner
  //
  //   // log ('TokenBuilder.write', [type, value])
  //   // log ('write', [type, v], {token, attr, output})
  //
  //   switch (type) {
  //
  //     case T.StartTagStart:
  //       token = new StartTag (v.substr(1))
  //     break
  //
  //     case T.EndTagStart:
  //       token = new EndTag (v.substr(2))
  //     break
  //
  //     case T.AttName:
  //       attrs.push (attr = [v, null])
  //     break
  //
  //     case T.StartQuote:
  //     case T.Assign:
  //       attr[1] = ''
  //     break
  //
  //     case T.EndQuote:
  //       attr = null
  //     break
  //
  //     //case 'unescaped':
  //     case T.Value:
  //       attr[1] += v
  //     break
  //
  //     case T.TagEnd:
  //       if (v.length > 2) // REVIEW
  //         token.selfClosing = true
  //       emitToken (token)
  //     break
  //
  //     case T.Data: if (v) {
  //       if (attr) attr[1] += v
  //       else output.push (v)
  //     }
  //     break
  //
  //     case T.CommentStart:
  //     case T.BogusStart:
  //       output.push ([T.CommentStart, v])
  //       //token = new Comment ()
  //     break
  //     case T.CommentEnd:
  //     case T.BogusEnd:
  //       output.push ([T.CommentEnd, v])
  //       //emitToken (token)
  //     break
  //
  //     // White space
  //     //case 'newline':
  //     case T.Space:
  //       output.push ([type, v])
  //     break
  //
  //     // All sorts of other data
  //     case T.Bogus:
  //     case T.Comment:
  //     case T.RcData:
  //     case T.RawText:
  //     case T.PlainText:
  //       if (v) output.push (v)
  //     break
  //
  //     /* TODO
  //     case 'charRefDecimal':
  //       emitData (parseDecimal (v.substr (2))) // TODO this may become space too
  //     break
  //
  //     case 'charRefHex':
  //       emitData (parseHex (v.substr (3)))
  //     break
  //
  //     case 'charRefNamed':
  //       emitData (parseNamed (v.substr (1)))
  //     break
  //     */
  //
  //     // Ignored
  //     // case 'beforeAttribute':
  //     // case 'afterAttributeName':
  //     // case 'beforeValue':
  //   }}
  // }


  // Private

  function emitToken () {
    if (token instanceof StartTag && attrs.length)
      token.attributes = new Map (attrs)
    output.push (token)
    attrs = []; attr = null; token = null;
  }

  function emitData (data) {
    if (data) {
      if (attr) attr.value += data
      else output.push (data)
    }
  }

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
}

TokenBuilder.build = function (chunks) {
  const builder = new TokenBuilder ()
  const stream = _build (chunks, builder)
  stream.state = builder
  return stream
}

function* _build (chunks, builder) {
  for (let chunk of chunks) {
    builder.write (chunk)
    yield* builder.read ()
  }
  builder.end ()
  yield* builder.read ()
}

module.exports = { TokenBuilder }