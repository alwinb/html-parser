const log = console.log.bind (console)
const lexer = require ('./')

// Token builder
// =============

// Takes a stream of chunks and builds 'tokens' in the sense of the whatWG specification. 
// Tokens then, are start-tags, end-tags, and text/ data nodes. 
// Doctype tokens aren't supported yet, also, scriptData isn't in the sense that preceding <!-- isn't handled. 

// For now I'm using an extended Map object to store the attributes
//  within and name/ selfclosing as properties on top. I may try and make it simpler still

class StartTag extends Map {
  constructor (name) {
    super ()
    this.name = name
    this.selfClosing = false
  }
  toString () {
    return `<${this.name}${this._printAtts()}${this.selfClosing ? '/' : ''}>` // TODO add attributes
  }
  _printAtts () {
    let r = ''
    for (let [k,v] of this.entries ())
      r += ' ' + (v == null ? k : k + '=' + v)
    return r
  }
}

class Data extends String {
  constructor (...args) {
    super (...args)
    Object.defineProperty (this, 'name', { value: '<data>' })
  }
}

class EndTag {
  constructor (name) {
    this.name = name
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
    this.data = data
  }
  toString () {
    return `<!--${this.data}-->`
  }
}

class Whitespace extends String {
  toString () { return super.toString () }
}


// Builder state
// -------------

function _Attribute (name) {
  this.name = name
  this.value = null
}

function TokenBuilder () {
  let output = []
    , token = null
    , attrs = []
    , attr = null

  // API

  const enumerable = true
  Object.defineProperties (this, {
    output: { get: $=> output, enumerable },
    token:  { get: $=> token,  enumerable },
    attrs:  { get: $=> attrs,  enumerable },
    attr:   { get: $=> attr,   enumerable }, })
  Object.assign (this, { read, write, end })

  // Implementation

  function* read () {
    yield* output
    output = []
  }

  function write ([type, value]) {
    // log ('TokenBuilder.write', [type, value])
    if (type in handlers) handlers [type] (value)
    else {
      log ([type, value])
      throw new Error ('unknown token type ' + type)
    }
    // log ('==>', this._getState ())
  }

  function end () {
    // log ('TokenBuilder.end, in state', this._getState ())
    if (token) emitToken (token) // Validate: may want to tag the token as being cut-off
    attrs = []; attr = null; token = null;
  }

  // Private

  function emitToken () {
    if (token instanceof StartTag)
      for (let { name, value } of attrs)
        token.set (name, value)
    output.push (token)
    attrs = []; attr = null; token = null;
  }

  function emitData (data) {
    if (data) {
      if (attr) attr.value += data
      else output.push (new Data (data))
    }
  }

  function emitSpace (data) {
    if (data) output.push (new Whitespace (data))
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

  const handlers = 
  { commentStart: $=> token = new Comment ()
  , commentStartBogus: $=> token = new Comment ()
  , startTagStart: v => token = new StartTag (v.substr(1))
  , endTagStart: v => token = new EndTag (v.substr(2))
  , tagEndClose: $=> token.selfClosing = true
  , attributeName: v => attrs.push (attr = new _Attribute (v))

  , beforeAttribute: $=> token // space between attributes e/a/ is ignored
  , afterAttributeName: $=> token // space between attributes e/a/ is ignored
  , beforeValue: $=> token // space between attributes e/a/ is ignored

  , attributeAssign: $=> attr.value = ''
  , attributeValueStart: $=> attr.value = ''
  , attributeValueData: v => attr.value +=v
  , attributeValueEnd: $=> attr = null
  , commentData: v => token.data += v
  , tagEnd: emitToken
  , commentEnd: emitToken
  , commentEndBogus: emitToken
  , unescaped: emitData
  , data: emitData
  , space: emitSpace
  , newline: emitSpace
  , rcdata: emitData
  , rawtext: emitData
  , plaintext: emitData
  , charRefDecimal: v => emitData (parseDecimal (v.substr (2))) // TODO this may become space too
  , charRefHex: v => emitData (parseHex (v.substr (3)))
  , charRefNamed: v => emitData (parseNamed (v.substr (1)))
  }

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

module.exports = { StartTag, EndTag, Whitespace, Comment, Data, TokenBuilder, TokenBuilder }