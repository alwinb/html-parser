const log = console.log.bind (console)
const { tokenTypes:T } = require ('./lexer')
//log (T)

// Token builder
// =============

// Takes a stream of chunks and builds 'tokens' in the sense of the whatWG specification. 
// Tokens then, are start-tags, end-tags, and text/ data nodes. 
// Doctype tokens aren't supported yet, also, scriptData isn't in the sense that preceding <!-- isn't handled. 

class StartTag {
  constructor (name) {
    this.name = name
    // this.attributes may be added later
    this.selfClosing = false
    this[0] = T.StartTag
  }
  toString () {
    return `<${this.name}${this._printAtts()}${this.selfClosing ? '/' : ''}>` // TODO add attributes
  }
  _printAtts () {
    if (!this.attributes) return ''
    let r = ''
    for (let [k,v] of this.attributes.entries ())
      r += ' ' + (v == null ? k : k + '=' + v)
    return r
  }
}

class EndTag {
  constructor (name) {
    this.name = name
    this[0] = T.EndTagStart
    this.selfClosing = false
  }
  toString () {
    return `</${this.name}>`
  }
}

// Restriction on comment data:
// must not start with ">", nor start with "->", 
// must not contain "<!--", "-->", or "--!>", 
// must not end with "<!-".

class Comment {
  constructor (data = '') {
    this[0] = T.Comment
    this.data = data
  }
  toString () {
    return `<!--${this.data}-->`
  }
}

// class Whitespace extends String {
//   toString () { return super.toString () }
// }
//
// class Data extends String {
//   constructor (...args) {
//     super (...args)
//     this.name =  '<data>'
//   }
// }


// Builder state
// -------------

function TokenBuilder () {
  let output, token, attrs, attr
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

  function readAll () {
    const r = output
    output = []
    return r
  }

  function* read () {
    yield* output
    output = []
  }

  function restart () {
    token = attr = null
    attrs = []
    output = []
  }

  function end () {
    // log ('TokenBuilder.end, in state', this._getState ())
    // Validate: may want to tag the token as being cut-off
    if (token) emitToken (token)
    token = attr = null
    attrs = []
  }

  function write (chunk) {
    batchWrite ([chunk])
  }

  function batchWrite (chunks) {
    for (let [type, v] of chunks) {
    // log ('TokenBuilder.write', [type, value])
    // log ('write', [type, v], {token, attr, output})

    switch (type) {
      case T.CommentStart:
      case T.BogusStart:
        token = new Comment ()
      break

      case T.Bogus:
      case T.Comment:
        token.data += v
      break

      case T.StartTagStart:
        token = new StartTag (v.substr(1))
      break

      case T.EndTagStart:
        token = new EndTag (v.substr(2))
      break

      case T.AttName:
        attrs.push (attr = [v, null])
      break

      case T.StartQuote:
      case T.Assign:
        attr[1] = ''
      break

      case T.EndQuote:
        attr = null
      break

      //case 'unescaped':
      case T.Value:
        attr[1] += v
      break

      case T.TagEnd:
        if (v.length > 2) // REVIEW
          token.selfClosing = true
        emitToken (token)
      break

      case T.CommentEnd:
      case T.BogusEnd:
        emitToken (token)
      break
      
      case T.Data:
        if (v) {
          if (attr) attr[1] += v
          else output.push (v)
        }
      break
      case T.RcData:
      case T.RawText:
      case T.PlainText:
        if (v) output.push (v)
      break

      //case 'newline':
      case T.Space:
        output.push ([type, v])
      break

      /* TODO
      case 'charRefDecimal':
        emitData (parseDecimal (v.substr (2))) // TODO this may become space too
      break

      case 'charRefHex':
        emitData (parseHex (v.substr (3)))
      break

      case 'charRefNamed':
        emitData (parseNamed (v.substr (1)))
      break
      */

      // case 'beforeAttribute':
      // case 'afterAttributeName':
      // case 'beforeValue':
      // break // space between attributes e/a/ is ignored

      // default:
      //   log ([type, v])
      //   throw new Error ('unknown token type ' + type)
    }}
  }


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

module.exports = { StartTag, EndTag, Comment, /*Data, Whitespace,*/ TokenBuilder, TokenBuilder }