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
    this.name =  '<data>'
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
  let output, token, attrs, attr
  restart ()

  // API

  const enumerable = true
  Object.defineProperties (this, {
    output: { get: $=> output, enumerable },
    token:  { get: $=> token,  enumerable },
    attrs:  { get: $=> attrs,  enumerable },
    attr:   { get: $=> attr,   enumerable }, })
  Object.assign (this, { start:restart, restart, write, read, readAll, end })

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

  function write ([type, v]) {
    // log ('TokenBuilder.write', [type, value])
    // log ('write', [type, v], {token, attr, output})

    switch (type) {
      case 'commentStart':
      case 'commentStartBogus':
        token = new Comment ()
      break

      case 'startTagStart':
        token = new StartTag (v.substr(1))
      break

      case 'endTagStart':
        token = new EndTag (v.substr(2))
      break

      case 'attributeName':
        attrs.push (attr = new _Attribute (v))
      break

      case 'attributeAssign':
      case 'attributeValueStart':
        attr.value = ''
      break

      case 'attributeValueData':
      case 'unescaped':
        attr.value += v
      break

      case 'attributeValueEnd':
        attr = null
      break

      case 'commentData':
        token.data += v
      break

      case 'tagEndClose':
        token.selfClosing = true
      break

      case 'tagEnd':
      case 'commentEnd':
      case 'commentEndBogus':
        emitToken (token)
      break
      
      case 'data':
        if (v) {
          if (attr) attr.value += v
          else output.push (new Data (v))
        }
      break
      case 'rcdata':
      case 'rawtext':
      case 'plaintext':
        if (v) output.push (new Data (v))
      break

      case 'space':
      case 'newline':
        output.push (new Whitespace (v))
      break

      case 'charRefDecimal':
        emitData (parseDecimal (v.substr (2))) // TODO this may become space too
      break

      case 'charRefHex':
        emitData (parseHex (v.substr (3)))
      break

      case 'charRefNamed':
        emitData (parseNamed (v.substr (1)))
      break

      // case 'beforeAttribute':
      // case 'afterAttributeName':
      // case 'beforeValue':
      // break // space between attributes e/a/ is ignored

      // default:
      //   log ([type, v])
      //   throw new Error ('unknown token type ' + type)
    }
    // else {
    //   log ([type, value])
    //   throw new Error ('unknown token type ' + type)
    // }
    // log ('==>', this._getState ())
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

module.exports = { StartTag, EndTag, Whitespace, Comment, Data, TokenBuilder, TokenBuilder }