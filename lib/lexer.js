const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 lexer
// ============

// States and Tokens
// -----------------

// These are represnted by integers. 
// I am using a bitfield encoding with four sections: 
// role, modifiers, flags and token-type - using 8 bits per section,
// though flags are considered part of the type

const roleMask = 0xFF000000
const modMask  = 0x00FF0000
const typeMask = 0x0000FFFF

// Roles
const End   = 1 << 25
const Start = 1 << 24
const tokenRoles = { Start, End }

// Modifiers
const Warn = 1 << 16

// Flags
const
  _GT   = 1 << 15, // responds to '>'
  _TS   = 1 << 14, // responds to 'tagspace'
  _tag  = 1 << 13, // allows tag
  _ref  = 1 << 12, // allows charref
  _SP   = 1 << 11, // produce Space tokens
  _att  = 1 << 10, // 
  _EQ   = 1 << 9,  // responds to '='
  isRef = 1 << 8   // inside charref

// Token-Types
// NB. The token-types FormatTag, FormatEndTag and VoidTag are not produced by
// the Lexer, but they are used by the tokeniser/ parser. 

let t = 1;
const
  Assign = t++,
  Space  = t++

// Token-Types doubling as States
const
  Data         = t++ | _SP | _tag | _ref,
  RcData       = t++ | _SP | _tag | _ref,
  RawText      = t++ | _SP | _tag ,
  PlainText    = t++ | _SP ,
  Comment      = t++ | _SP ,
  Bogus        = t++ | _SP | _GT,
  StartTag     = t++ | _TS ,
  VoidTag      = t++ | _TS ,
  FormatTag    = t++ | _TS ,
  FormatEndTag = t++ | _TS ,
  EndTag       = t++ | _TS ,
  BeforeAtt    = t++ | _TS | _att,
  AttName      = t++ | _TS | _EQ,
  AfterAttName = t++ | _TS | _att | _EQ,
  BeforeValue  = t++ | _ref ,
  Value        = t++ | _ref | _GT,
  NamedRef     = t++ | isRef | _ref,
  NumRef       = t++ | isRef | _ref,
  HexRef       = t++ | isRef | _ref

// States
const
  MDecl = t++ | _GT

const tokenTypes =  {
  Data, RcData, RawText, PlainText, Value, Space,
  Comment, Bogus,
  NamedRef, NumRef, HexRef, MDecl,
  BeforeAtt, AttName, AfterAttName, BeforeValue,
  Assign, StartTag, EndTag, FormatTag, FormatEndTag, VoidTag
}

// ### Printing states and tokens
// This defines an inverse map from tokenTypes to their (string) names. 

const names = {}
for (let k in tokenTypes) names[tokenTypes[k] & typeMask] = k

const tokenName = type => {
  let s = names [type & typeMask]
  if (s) {
    s += type & Start ? 'Start' : type & End ? 'End' : ''
    s += type & Warn ? ' Warn' : ''
  }
  return s || null
}


// Lexer configuration
// -------------------

// The lexer is parameterized by a configuration
// that specifies rawtext, plaintext and rcdata tags. 
// And in addition, format tags and void tags.
// All other tags will be tokenised as ordinary start / end tags

// It might be an idea to do additional annotations here.
// Maybe tag categories/ scope boundaries already.

const contentMap = 
  { textarea:  [StartTag, RcData, EndTag]
  , title:     [StartTag, RcData, EndTag]
  , plaintext: [StartTag, PlainText, EndTag]
  //, noscript: RawText // if scripting is enabled in a UA
  }

const _raw = `
  style script xmp iframe noembed noframes`

const _fmt = `
  a b big code em font i nobr s small strike strong tt u`

const _void = `
  area base basefont bgsound br col embed frame img
  input keygen link meta param source track wbr`

for (let x of _raw.split(/\s+/g))
  contentMap [x] = [StartTag, RawText, EndTag]

for (let x of _fmt.split(/\s+/g))
  contentMap [x] = [FormatTag, Data, FormatEndTag]

for (let x of _void.split(/\s+/g))
  contentMap [x] = [VoidTag, Data, EndTag]

// log (contentMap)


// Characters
// ----------

const isSpace = d =>
  9 <= d && d <= 13 && d !== 11 || d === 32
  // /^[\t\n\r\f ]$/

const isDigit = d => 
  48 <= d && d <= 57

const isAlpha = d => {
  if (d <= 90) d += 32
  return 97 <= d && d <= 122 }

const isHexAlpha = d => {
  if (d <= 90) d += 32
  return 97 <= d && d <= 102 }

const [LT, SL, EQ, DQ, SQ, DASH, QUE, BANG, GT, AMP, SEMI, HASH, X, _X, CR, LF] =
  '</="\'-?!>&;#Xx\r\n' .split('') .map (_ => _.charCodeAt (0))


// Lexer
// -----

// Internally this is a lazy pull parser. The main loop
// is driven by batchRead and/(or) read calls. 

function stateInfo (st) {
  const ch = String.fromCharCode
  const { line, col, last, quote, tagname, tagname_ } = st
  const r = { line, col, last: ch (st.last), quote:st.quote ? ch (st.quote) : null, tagname, tagname_ }
  for (let k in st) if (!(k in r))
    r[k] = tokenName (st[k])
  return r
}

function Lexer () {

  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let tag, refIn      // tag-context, charref-context
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname buffer

  // Stream and Emitter state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let line, lastNl
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0            // output labels

  // API
  const self = this
  Object.assign (this, { reset, write, end, batchRead, read, _unwrite })
  Object.defineProperty (this, 'state', { get: $=> {
    const col = lastEmit - lastNl
    return { line, col, st, sub, content, tag, refIn, last, quote, tagname, tagname_, label0 }
  }})

  // Init
  return reset ()

  // Implementation
  function reset () {
    st = content = Data
    sub = tag = refIn = null
    last = quote = 0
    tagname = tagname_ = rest = ''
    writable = true
    queue = []
    input = ''
    label0 = Data
    lastEmit = lastNl = 0
    line = 1
    return self
  }

  function write (str) {
    if (writable && str.length)
      queue[queue.length] = str
    return self
  }

  function end (str = '') {
    writable = false
    return str ? write (str) : self
  }

  function* read () {
    for (let x of batchRead (1))
      yield* x
  }

  function _unwrite () {
    const b = queue
    b.unshift (input.substr (lastEmit));
    [rest, input, queue] = ['', '', []]
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

        let l0 = label0, label1 = st
        let _line = line, _nl = lastNl
        const c = input.charCodeAt (i)
        do {

          // ### Line count

          if (c === CR || c === LF && last !== CR) {
            _line++
            _nl = i+1
          }

          // ### Character References

          if (st & _ref && last === AMP) {
            if (isAlpha (c)) {
              [refIn, label1, st] = [st, NamedRef, NamedRef]
              continue
            }
            if (c === HASH) {
              [refIn, label1, sub] = [st, null, NumRef];
              continue
            }
          }

          if (sub & isRef && last === HASH && (c === X || c === _X)) {
            [label1, sub] = [null, HexRef]
            continue
          }

          if ((sub || st) & isRef && isDigit (c)) {
            st = sub || st;
            [label1, st, sub] = [st, st, null]
            continue
          }

          if ((sub || st) === HexRef && isHexAlpha (c)) {
            [label1, st, sub] = [HexRef, HexRef, null]
            continue
          }

          if (st === NamedRef && isAlpha (c)) {
            [label1, st, sub] = [NamedRef, NamedRef, null]
            continue
          }

          if (st & isRef && c === SEMI) {
            [label1, st, sub, refIn] = [st, refIn, null, null]
            continue
          }

          if ((sub||st) & isRef) {
            // NB fallthrough!
            [st, sub, refIn] = [refIn, null, null]
          }

          // ### Quoted Attribute Values

          if (quote && (st === Value || refIn === Value)) { // rows
            [l0, label1, st, sub, quote]
              = c === quote ? [st, Value|End, BeforeAtt, null, 0]
              : [st, c === AMP ? null : st, Value, null, quote]
            continue
          }

          // ### Tag Starters

          if (c === LT && st & _tag) {
            [l0, label1] = [content, null]
            continue
          }

          if (c === SL && last === LT && st & _tag) {
            [label1, st] = [null, MDecl]
            continue
          }

          if (st === Data && last === LT) {

            if (c === BANG || c === SL) {
              [label1, st] = [null, MDecl]
              continue
            } 

            if (c === QUE) {
              [label1, st] = [Bogus|Start, Bogus]
              continue
            } 

            if (isAlpha (c)) { // row - potential tag in data
              [label1, st, tag, tagname_] = [null, StartTag, StartTag, input[i]]
              // : [Data|Warn, Data, null, '']
              continue
            }
          }

          // ### Tag Endings

          if (tag && c === GT) { // cells
            if (tag === EndTag && content !== Data && tagname !== tagname_)
              [label1, st, tag] = [content, content, null] // not a tag after all
            else {
              const taginfo = contentMap [tagname_] || [StartTag, Data, EndTag];
              const _tag = tag === StartTag ? taginfo[0] : taginfo[2]
              if (tag === StartTag)
                [tagname, content] = [tagname_, taginfo[1]]
              else
                [tagname, content] = ['', Data];
              [l0, label1, st, tag] = [st === StartTag || st === EndTag ? _tag|Start : st, _tag|End, content, null];
            }
            continue
          }

          if (st & _GT && c === GT) { // cells
            const mark = st === MDecl ? Start : 0;
            [l0, label1, st, sub] = [Bogus|mark, Bogus|End, content, null]
            continue
          }

          if (st === Comment && c === GT) { // cells
            [label1, st, sub]
              = (sub === End || sub === Start && last === DASH) ? [Comment|End, Data, null]
              : [st, st, null]
            continue
          }

          // ...
          if (st === MDecl) { // row - start closetag - tagname or bogus
            if (last === SL && isAlpha (c)) {
              [label1, st, tag, tagname_] = [null, EndTag, EndTag, input[i]]
              continue
            }
            if (isSpace(c)) {
              [l0, label1, st] = [Bogus|Start, Space, Bogus]
              continue
            }
            if (c === DASH) {
              [l0, label1, st, sub]
              = last === DASH ? [Comment|Start, Comment|Start, Comment, Start]
              : [null, null, MDecl, null]
            continue
            }
            else [label0, label1, st] = [Bogus|Start, Bogus, Bogus]
            continue
          }


          if (st === StartTag || st === EndTag) { // row (inside tag name)
            if (c === SL || isSpace (c)) { // cells '/' and space
              const taginfo = contentMap [tagname_] || [StartTag, Data];
              const _tag = st === StartTag ? taginfo[0] : taginfo[3];
              [l0, label1, st, tag]
                = (tag === EndTag && content !== Data && tagname !== tagname_) ? [content, content, content, null]
                : [_tag|Start, null, BeforeAtt, tag]
            }
            else [label1, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
            [l0, label1, st]
              = st & _SP ? [st, Space, st]
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

          if (st === BeforeValue) { let l // row
            [l0, label1, st, quote] = c === DQ || c === SQ
              ? [BeforeValue, Value|Start, Value, c]
              : [BeforeValue, c === AMP ? null : Value, Value, 0];
            continue
          }

          if (c === AMP && st & _ref) {
            [l0, label1] = [refIn || st, null]
            continue
          }

          if (c === EQ && st & _EQ) { // cells
            [l0, label1, st] = [st, Assign, BeforeValue]
            continue
          }

          if (c === SL && st & _TS) { // cells
            [label1, st] = [null, BeforeAtt]
            continue
          }

          if (st & _att) { // rows - start attribute name
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
          output[output.length] = [label0, input.substring (lastEmit, (lastEmit = i))]
          if (output.length === n) { yield output; output = [] }
        }
        label0 = label1
        line = _line
        lastNl = _nl
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
