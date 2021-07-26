const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 lexer
// ============

// States and Tokens
// -----------------

// These are represnted by integers. 
// I am using a bitfield encoding for roles, flags and token-types

const roleMask = 0b1111
const typeMask = ~roleMask

// Roles
const Start = 1 << 1
const End   = 1 << 2
const Space = 1 << 3
const Warn  = 1 << 4 // NB not a role, but a role-flag
const tokenRoles = { Start, End, Space, Warn }

// Flags
const
  _SP   = 1 << 23, // produce Space tokens
  _att  = 1 << 24, // 
  _EQ   = 1 << 25, // responds to '='
  isRef = 1 << 26,  // inside charref
  _GT   = 1 << 27, // responds to '>'
  _TS   = 1 << 28, // responds to 'tagspace'
  _tag  = 1 << 29, // allows tag
  _ref  = 1 << 30 // allows charref

// Token-Types doubling as States

const
  Data         = 1 << 17 | _SP | _tag | _ref,
  RcData       = 1 << 18 | _SP | _tag | _ref,
  RawText      = 1 << 19 | _SP | _tag ,
  PlainText    = 1 << 20 | _SP ,
  Comment      = 1 << 5  | _SP ,
  Bogus        = 1 << 6  | _SP | _GT,
  StartTag     = 1 << 7  | _TS ,
  EndTag       = 1 << 8  | _TS ,
  BeforeAtt    = 1 << 9  | _TS | _att,
  AttName      = 1 << 10 | _TS | _EQ,
  AfterAttName = 1 << 11 | _TS | _att | _EQ,
  BeforeValue  = 1 << 12 | _ref ,
  Value        = 1 << 13 | _ref | _GT,
  NamedRef     = 1 << 14 | isRef | _ref,
  NumRef       = 1 << 15 | isRef | _ref,
  HexRef       = 1 << 16 | isRef | _ref

// Token-Types

const Assign = 1 << 21        // Token-Type
const MDecl  = 1 << 22 | _GT  // State only


//

const tokenTypes =  {
  Data, RcData, RawText, PlainText, Value,
  Comment, Bogus,
  NamedRef, NumRef, HexRef, MDecl,
  BeforeAtt, AttName, AfterAttName, BeforeValue,
  Assign, StartTag, EndTag
}

// ### Printing states and tokens
// This defines an inverse map from tokenTypes to their (string) names. 

const names = {}
for (let k in tokenTypes) names[tokenTypes[k] & typeMask] = k
// log (names)

const typeName = type => {
  let s = names [type & typeMask]
  log (type, s)
  if (s) {
    s += type & Start ? 'Start' : type & End ? 'End' : type & Space ? 'Space' : ''
    s += type & Warn ? ' Warn' : ''
  }
  return s || null
}


// Lexer configuration
// -------------------

// The lexer is parameterized by a configuration
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
  for (let k in st) if (!(k in r) && r[k])
    r[k] = typeName (st[k])
  return r
}

function Lexer () {

  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let tag, refIn        // tag-context, charref-context
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
              [tagname, content]
                = tag === StartTag ? [tagname_, contentMap [tagname_] || Data] : ['', Data];
              [l0, label1, st, tag] = [st === StartTag || st === EndTag ? tag|Start : st, tag|End, content, null];
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
              [l0, label1, st] = [Bogus|Start, Comment|Space, Bogus]
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
            if (c === SL || isSpace (c)) // cells '/' and space
              [l0, label1, st, tag]
                = (tag === EndTag && content !== Data && tagname !== tagname_) ? [content, content, content, null]
                : [tag|Start, null, BeforeAtt, tag]
            else [label1, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
            [l0, label1, st]
              = st & _SP ? [st, st|Space, st]
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

Object.assign (Lexer, { stateInfo, typeName, tokenTypes, tokenRoles, typeMask, roleMask })
module.exports = Lexer
