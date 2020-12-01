const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 lexer
// ============

// States and Tokens
// -----------------

// I am using ints for both states and token types. 
// Some constants are used for both states and token types at once. 

// Some states and/or tokens types are used with a Start/End (and Warn) modifier. 
// These are implemented using bitfields, the low 16 bits are for the state, 
// the next 3 (17, 18, 19) are used for the modifier. 

const typeMask = (1<<16)-1
const roleMask = ~typeMask
const Start = 1<<16
const End   = 1<<17
const Warn = 1<<18
const tokenRoles = { Start, End }

// I'm also adding some bitflags to the states themselves,
// to group them together, for convenient branching.

const inTag = 1<<12
const inContent = 1<<13
const inComment = 1<<14
const inRef = 1<<11
const allowRef = 1<<15

let [
  // STATES, Token types
  PlainText, RawText, RcData, Data, CLOSE, MDECL, Bogus, Comment, TAG_NAME,
  NamedRef, NumRef, HexRef,
  BeforeAtt, AttName, AfterAttName, BeforeValue, Value,
  Assign, StartTag, EndTag, Space, FormatTag, FormatEndTag, VoidTag ] = range (1)

// The token types FormatTag, FormatEndTag and VoidTag are not produced by the Lexer,
// But they are used by the tokeniser/ parser. 

PlainText |= inContent
RawText |= inContent
RcData |= inContent
Data |= inContent

MDECL |= inComment
Bogus |= inComment
Comment |= inComment

TAG_NAME |= inTag
BeforeAtt |= inTag
AttName |= inTag
AfterAttName |= inTag
BeforeValue |= inTag
Value |= inTag

NamedRef |= inRef
NumRef |= inRef
HexRef |= inRef

RcData |= allowRef
Data |= allowRef
BeforeValue |= allowRef
Value |= allowRef
NamedRef |= allowRef
NumRef |= allowRef
HexRef |= allowRef

const tokenTypes =  {
  PlainText, RawText, RcData, Data, Comment, Bogus, NamedRef, NumRef, HexRef,
  BeforeAtt, AttName, AfterAttName, BeforeValue, Value,
  Assign, StartTag, EndTag, Space, FormatTag, FormatEndTag, VoidTag
}

// Inverse map from tokenTypes to their (string) names. 

const names = {}
for (let k in tokenTypes) names[tokenTypes[k]] = k

const tokenName = type =>
  names [type & typeMask]
  + (type & Start ? 'Start' : type & End ? 'End' : '')

function stateInfo (st) {
  st = Object.assign ({}, st)
  st.st = names[st.st]
  st.content = names[st.content]
  st.sub = st.sub ? names[st.sub] : null
  st.last = String.fromCharCode (st.last)
  if (st.label0) st.label0 = names[st.label0]
  if (st.label1) st.label1 = names[st.label1]
  return st
}

// The tokenizer is parameterized by a configuration
// that specifies rawtext, plaintext and rcdata tags. 
// I like the idea of doing additional annotations here though.
// Maybe tag categories/ scope boundaries already.

const contentMap = 
  { style: RawText
  , script: RawText
  , xmp: RawText
  , iframe: RawText
  , noembed: RawText
  , noframes: RawText
  , textarea: RcData
  , title: RcData
  , plaintext: PlainText
  //, noscript: RawText // if scripting is enabled in a UA
  }


// Lexer
// -----

// Internally this is a lazy pull parser. The main loop
// is driven by batchRead and/(or) read calls. 

// const _isSpace = /^[\t\n\r\f ]$/
const isSpace = d => {
  return 9 <= d && d <= 13 && d !== 11 || d === 32 }

const isAlpha = d => {
  if (d <= 90) d += 32
  return 97 <= d && d <= 122 }

const isDigit = d => 
  48 <= d && d <= 57

const isAlphaDigit = d => {
  if (48 <= d && d <= 57) return true
  if (d <= 90) d += 32
  return 97 <= d && d <= 122 }

const [LT, SL, EQ, DQ, SQ, DASH, QUE, BANG, GT, AMP, SEMI, HASH, X] =
  '</="\'-?!>&;#x' .split('') .map (_ => _.charCodeAt(0))

function Lexer () {
  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let context           // charref-context
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname queue
  let tag

  // Stream and Emitter  state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0, label1    // output labels

  const self = this
  Object.assign (this, { restart, write, end, batchRead, read, _unwrite })
  Object.defineProperty (this, 'state', { get: $=> ({ st, sub, content, last, quote, tag, tagname, tagname_, label0, label1 })})
  restart () // init

  function restart () {
    st = content = context = Data
    tag = sub = null
    last = quote = 0
    tagname = tagname_ = rest = ''
    writable = true
    queue = []
    input = ''
    lastEmit = 0
    label0 = Data
    label1 = null
    return self
  }

  function write (str) {
    if (writable && str.length)
      queue[queue.length] = str
    return self
  }

  function end (str = '') {
    if (writable && str.length)
      queue[queue.length] = str
    writable = false
    return self
  }

  function* read () {
    for (let x of batchRead (1))
      yield* x
  }

  function _unwrite () {
    const b = queue
    b.unshift (input.substr (lastEmit))
    ;[rest, input, queue] = ['', '', []]
    return b
  }

  function* batchRead (n = 4) {
    let output = []
    while (queue.length) {
      lastEmit = 0
      input = rest ? rest + queue.shift () : queue.shift ()
      //log ('readLoop', { rest, input, lastEmit, queue})
      for (let i=rest.length, l=input.length; i<l; i++) {
        //log (input[i], 'in', stateInfo (self.state))

        //////////  This is the Lexer Core  ///////////
        ////////// Start of transition table //////////

        let l0 = label0
        const c = input.charCodeAt (i)
        do {

          if (c === AMP && st & allowRef) { // cells - potential charref
            const _st = st & inRef ? context : st;
            [l0, label1, context] = [_st, null, _st]
            continue
          }

          if (last === AMP && st & allowRef) {
            [label1, st] = isAlpha (c) ? [NamedRef, NamedRef]
              : c === HASH ? [null, NumRef]
              : [context, context]
            continue
          }
          
          if (c === SEMI && st & inRef) {
            [label1, st] = [st, context]
            continue
          }

          if (st === NamedRef) {
            [l0, label1, st] = isAlphaDigit (c) ? [st, st, st] : [st, context, context]
            continue
          }

          if (st === NumRef) {
            if (c === X && last === HASH) // TODO or lowercase x
              [label1, st] = [null, HexRef]
            else
              [l0, label1, st] = isDigit (c) ? [st, st, st]
                : last === HASH ? [context|Warn, context, context]
                : [st, context, context]
            continue
          }

          if (st === HexRef) {
            [l0, label1, st] = isHexDigit (c) ? [st, st, st] // TODO isHexDigit
              : last === X ? [context|Warn, context, context]
              : [st, context, context]
            continue
          }

          if (st === Value && quote) { // rows - quoted values
            [label1, st] = c === quote ? [Value|End, BeforeAtt] : [Value, Value]
            continue
          }

          if (c === SL && last === LT && st & inContent) { // cells - start closetag
            [label1, st] = [null, CLOSE]
            continue
          }

          if (c === LT && st & inContent) { // cells - potential tag
            label1 = null
            continue
          }

          if (last === LT && st === Data) { // row - potential start tag in data
            [label1, st, tag, tagname_]
              = isAlpha (c) ? [null, TAG_NAME, StartTag, input[i]]
              : c === BANG  ? [null, MDECL, null, null]
              : c === QUE   ? [Bogus|Start, Bogus, null, null]
              : [Data|Warn, Data, null, null]
            continue
          }

          if (c === GT && st & inTag) { // cells
            if (tag === EndTag && content !== Data && tagname !== tagname_)
              [label1, st] = [content, content]
            else {
              [tagname, content]
                = tag === StartTag ? [tagname_, contentMap [tagname_] || Data] : ['', Data];
              [l0, label1, st, tag, sub] = [st === TAG_NAME ? tag|Start : st, tag|End, content, null, null];
            }
            continue
          }

          if (c === GT) { // remains of the '>' column
            if (st === Comment) [label1, st, sub]
              = (sub === End || sub === Start && last === DASH) ? [Comment|End, Data, null]
              : [Comment, Comment, null]
            else [l0, label1, st, sub]
              = (st === CLOSE || st === MDECL) ? [Bogus|Start, Bogus|End, content, null]
              : (st === Bogus) ? [Bogus, Bogus|End, content, null]
              : [content, content, content, null]
            continue
          }

          if (st === CLOSE) { // rows - start closetag - tagname or bogus
            [l0, label1, st, tag, tagname_]
              = isAlpha (c) ? [null, null, TAG_NAME, EndTag, input[i]]
              : [Bogus|Start, Bogus, Bogus, null, null]
            continue
          }

          if (st === TAG_NAME) { // row
            if (c === SL || isSpace (c)) // cells '/' and space
              [l0, label1, st]
                = (tag === EndTag && content !== Data && tagname !== tagname_) ? [content, content, content]
                : [tag|Start, null, BeforeAtt]
            else [label1, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
            [l0, label1, st]
              = st & inContent ? [content, Space, st]
              : st & inComment ? [st, Space, st]
              : st === Value && !quote ? [Value, null, BeforeAtt]
              : st === AttName ? [AttName, null, AfterAttName]
              : [st, st, st]
            continue
          }

          label1 = st

          if (st === Comment) {
            if (c === BANG)
              [label1, sub] = [null, sub === End && last !== BANG ? sub : null]
            else if (c === DASH)
              [label1, sub] = [null, sub === End ? null : last === DASH ? End : sub]
            else sub = null
          }

          if (st === MDECL) { // rows (cells first)
            if (c === DASH) [label1, st, sub]
              = last === DASH ? [Comment|Start, Comment, Start]
              : [null, MDECL, null]
            else [l0, label1, st] = [Bogus|Start, Bogus, Bogus]
            continue
          }

          if (st === BeforeValue) { let l // row
            [l0, label1, st, quote] = c === DQ || c === SQ ? [BeforeValue, Value|Start, Value, c] : [BeforeValue, Value, Value, 0];
            continue
          }

          if (c === EQ && (st === AfterAttName || st === AttName)) { // cells
            [l0, label1, st] = [st, Assign, BeforeValue]
            continue
          }

          if (c === SL) { // column // TODO clean this up
            [label1, st]
              = st === AfterAttName || st === AttName ?  [null, BeforeAtt]
              : st !== Value && st > TAG_NAME ? [null, st]
              : [st, st]
            continue
          }

          if (st === BeforeAtt || st === AfterAttName) { // rows - start attribute name
            [l0, label1, st] = [st, AttName, AttName]
            continue
          }

        }
        while (false) // Just to use continue as a break
        last = c // And this is outside the loop for that very reason

        ////////// End of transition table //////////
        //////////  Start of emitter code  //////////

        if (label0 === null) label0 = l0
        if (label0 && label0 !== label1) { // Indicates a cut
          sub = null // TODO clean this up, bug somewhere
          output[output.length] = [label0, input.substring (lastEmit, (lastEmit = i))]
          if (output.length === n) { yield output; output = [] }
        }
        label0 = label1
      }
      rest = input.substring (lastEmit, input.length)
    }

    // The input queue is now empty, but there may be an incomplete chunk that
    // has to be retained -- unless there has been an end call. 

    if (!writable && rest) {
      // TODO what if label0 is null?
      output[output.length] = [label0, rest]
      yield output
      output = []
    }
  }

}


// Exports
// -------
// log (tokenTypes)

module.exports = { Lexer, stateInfo, tokenName, tokenTypes, tokenRoles, typeMask, roleMask }
