const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 lexer
// ============

// States and Tokens
// -----------------

// These are represnted by integers. 
// I am using a bitfield encoding with four sections: 
// role, modifiers, flags and token-type - using 8 bits per section. 
// though flags are considered part of the type

const typeMask =  (1 << 16) - 1
const roleMask = ((1 << 8) - 1) << 24

// Roles
const Start = 1 << 24
const End = 1 << 25
const tokenRoles = { Start, End }

// Modifiers
const Warn = 1 << 16

// Flags
const
  allowSpace = 1<<8,
  allowRef  = 1<<11,
  allowTag  = 1<<12,
  inRef     = 1<<10

// States
const
  CLOSE = 5  ,
  MDECL = 6  | allowSpace

// States / Token-Types
const
  Data         = 1  | allowSpace | allowTag | allowRef,
  RcData       = 2  | allowSpace | allowTag | allowRef,
  RawText      = 3  | allowSpace | allowTag ,
  PlainText    = 4  | allowSpace,
  Comment      = 7  | allowSpace,
  Bogus        = 8  | allowSpace,
  StartTag     = 19 ,
  EndTag       = 20 ,
  BeforeAtt    = 10 ,
  AttName      = 11 ,
  AfterAttName = 12 ,
  BeforeValue  = 13 | allowRef,
  Value        = 14 | allowRef,
  NamedRef     = 15 | inRef | allowRef,
  NumRef       = 16 | inRef | allowRef,
  HexRef       = 17 | inRef | allowRef

// Token-Types
const
  Assign       = 18,
  Space        = 21,
  FormatTag    = 22,
  FormatEndTag = 23,
  VoidTag      = 24

// The token-types FormatTag, FormatEndTag and VoidTag are not produced by the Lexer,
// But they are used by the tokeniser/ parser. 

const tokenTypes =  {
  Data, RcData, RawText, PlainText, Value, Space,
  Comment, Bogus,
  NamedRef, NumRef, HexRef, MDECL,
  BeforeAtt, AttName, AfterAttName, BeforeValue,
  Assign, StartTag, EndTag, FormatTag, FormatEndTag, VoidTag
}

// Inverse map from tokenTypes to their (string) names. 

const names = {}
for (let k in tokenTypes) names[tokenTypes[k] & typeMask] = k

const tokenName = type =>
  names [type & typeMask]
  + (type & Start ? 'Start' : type & End ? 'End' : '')

function stateInfo (st) {
  st = Object.assign ({}, st)
  st.st = tokenName (st.st)
  st.content = tokenName (st.content)
  st.context = tokenName (st.context)
  st.sub = st.sub ? tokenName (st.sub) : null
  st.last = String.fromCharCode (st.last)
  st.quote = String.fromCharCode (st.quote)
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

const isHexAlpha = d => {
  if (d <= 90) d += 32
  return 97 <= d && d <= 102 }

const [LT, SL, EQ, DQ, SQ, DASH, QUE, BANG, GT, AMP, SEMI, HASH, X, _X] =
  '</="\'-?!>&;#xX' .split('') .map (_ => _.charCodeAt(0))

function Lexer () {
  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let tag, context      // tag-context, charref-context
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname buffer

  // Stream and Emitter  state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0, label1    // output labels

  const self = this
  Object.assign (this, { restart, write, end, batchRead, read, _unwrite })
  Object.defineProperty (this, 'state', { get: $=> ({ st, sub, content, tag, context, last, quote, tagname, tagname_, label0, label1 })})
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

          // ### Potential Character References

          if (st & allowRef) {

            if (c === AMP) {
              context = st & inRef ? context : tag ? Value : content;
              [l0, label1] = [st & inRef ? context : st, null] // FIXME
              continue
            }
            
            if (c === HASH && last === AMP) {
              [label1, st] = [null, NumRef]
              continue
            }

            if (last === AMP && isAlpha (c)) {
              [label1, st] = [NamedRef, NamedRef]
              continue
            }
          }
          
          // ### Character References

          if (st & inRef) {

            if (last === HASH && (c === X || c === _X)) {
              [label1, st] = [null, HexRef]
              continue
            }

            if (isDigit (c)) {
              [l0, label1] = [st, st]
              continue
            }

            if (st === NamedRef && isAlpha (c)) {
              [l0, label1] = [st, st]
              continue
            }

            if (st === HexRef && isHexAlpha (c)) {
              [l0, label1] = [st, st]
              continue
            }

            const invalid = last === HASH || last === X || last === _X
            if (c === SEMI && !invalid) {
              [label1, st] = [st, context]
              continue
            }

            // NB fallthrough, switch state
            [l0, st] = [context|(invalid ? Warn : 0), context]
          }

          // ### Quoted Values

          if (st === Value && quote) { // rows
            [label1, st, quote] = c === quote ? [Value|End, BeforeAtt, 0] : [Value, Value, quote]
            continue
          }

          // ### Tag Starts

          if (c === SL && last === LT && st & allowTag) { // cells - start closetag
            [label1, st] = [null, CLOSE]
            continue
          }

          if (c === LT && st & allowTag) { // cells - potential tag
            label1 = null // REVIEW what about <<
            continue
          }

          if (last === LT && st === Data) { // row - potential tag in data
            [label1, st, tag, tagname_]
              = isAlpha (c) ? [null, StartTag, StartTag, input[i]]
              : c === BANG  ? [null, MDECL, null, null]
              : c === QUE   ? [Bogus|Start, Bogus, null, null]
              : [Data|Warn, Data, null, null]
            continue
          }

          // ### Tag ends

          if (c === GT && tag) { // cells
            if (tag === EndTag && content !== Data && tagname !== tagname_)
              [label1, st, tag] = [content, content, null] // not a tag after all
            else {
              [tagname, content]
                = tag === StartTag ? [tagname_, contentMap [tagname_] || Data] : ['', Data];
              [l0, label1, st, tag] = [st === StartTag || st === EndTag ? tag|Start : st, tag|End, content, null];
            }
            continue
          }

          if (c === GT) { // remains of the '>' column
            if (st === Comment) [label1, st, sub]
              = (sub === End || sub === Start && last === DASH) ? [Comment|End, Data, null]
              : [Comment, Comment, null]
            else [l0, label1, st, sub]
              = (st === CLOSE || st === MDECL) ? [Bogus|Start, Bogus|End, content, null]
              : (st === Bogus) ? [Bogus, Bogus|End, Data, null]
              : [content, content, content, null]
            continue
          }

          // ...

          if (st === CLOSE) { // rows - start closetag - tagname or bogus
            [l0, label1, st, tag, tagname_]
              = isAlpha (c) ? [null, null, EndTag, EndTag, input[i]]
              : [Bogus|Start, Bogus, Bogus, null, null]
            continue
          }

          if (st === StartTag || st === EndTag) { // row (inside tag name)
            if (c === SL || isSpace (c)) // cells '/' and space
              [l0, label1, st, tag]
                = (tag === EndTag && content !== Data && tagname !== tagname_) ? [content, content, content, null]
                : [tag|Start, null, BeforeAtt, tag]
            else [label1, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
            [l0, label1, st]
              = st & allowSpace ? [st, Space, st]
              : st === Value && !quote ? [Value, null, BeforeAtt]
              : st === AttName ? [AttName, null, AfterAttName]
              : [st, st, st]
            continue
          }

          label1 = st

          if (st === Comment) {
            if (c === BANG)
              [label1, sub] = [sub !== End ? Comment : null, sub === End && last !== BANG ? sub : null]
            else if (c === DASH)
              [label1, sub] = [null, sub === End || last === DASH ? End : sub]
              // [label1, sub] = [null, sub === End ? null : last === DASH ? End : sub]
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
              : st !== Value && tag ? [null, st] // TODO && st !== TAG_NAME?
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
