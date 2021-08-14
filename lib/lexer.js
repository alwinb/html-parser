const { defineProperty:def, assign, setPrototypeOf:setProto } = Object
const hidden  = (obj, dict) => { for (const k in dict) def (obj, k, { value: dict[k], enumerable:false, configurable:true }) }
const getters = (obj, dict) => { for (const k in dict) def (obj, k, {   get: dict[k], enumerable:false, configurable:true }) }
const log = console.log.bind (console)

function* flags (a = 0n)
  { for (;;) yield 1n << a++ }


// HTML5 lexer
// ============

// Tokens and Token Roles
// ----------------------

// These are represented by integers. 
// I am using a bitfield encoding types:roles
// I am using BigInts because they are much faster!

// ### Roles

const
  Start = 1n << 1n,
  End   = 1n << 2n,
  Space = 1n << 3n,
  Leaf  = 1n << 4n
  Warn  = 1n << 5n // NB not exclusive with the others

const roleMask =
  0b11111n

const tokenRoles =
  { Start, End, Leaf, Space, Warn }


// ### States and Tokens

const [ 
  StartTag, EndTag, Comment, Bogus, MDecl,
  Data, RcData, RawText, PlainText, 
  NamedRef, NumRef, HexRef, 
  BeforeAtt, AttName, AfterAttName, 
  BeforeValue, Value, Assign ] = flags (6n)

const typeMask = ~roleMask

const None = 0n

const canHaveTag =
  Data | RcData | RawText

const hasSpace =
  Data | RcData | RawText | PlainText | Comment | Bogus

const hasTagSpace =
  BeforeAtt | StartTag | EndTag | AfterAttName | AttName

const isCharRef =
  NamedRef | NumRef | HexRef

const canStartCharRef =
  Data | RcData | BeforeValue | Value | isCharRef

const canEndTag =
  MDecl | Bogus | Value


// Building the map of token-types,
// along with an inverse map from types to their (string) names. 

const tokenTypes = {
  StartTag, EndTag, Comment, Bogus, MDecl,
  Data, RcData, RawText, PlainText, 
  NamedRef, NumRef, HexRef, 
  BeforeAtt, AttName, AfterAttName, 
  BeforeValue, Value, Assign }

const names = {}
for (let k in tokenTypes)
  names [tokenTypes[k]] = k


/* Test
const T = tokenTypes
for (const k in T)
  log (k.padStart (13, ' '), T[k].toString(2).padStart (32, '0').replace (/0/g, '_'))
//*/

// typeName also currently prints the role

const typeName = type => {
  let s = names [type & typeMask] || ''
  s += type & Start ? 'Start' : type & End ? 'End' : type & Space ? 'Space' : type & Leaf ? 'Leaf' : ''
  s += type & Warn ? ' Warn' : ''
  return s
}


// Character Classes
// -----------------

// I am using a 'Rolled Radix Tree' (which I really enjoy!)
// as a tiny, yet fast map from characters to character classes.

const [
  NUL, TAB, LF, FF, CR, SPACE, 
  EXCL, QUOT, HASH, AMP, SQUO, DASH, SL, 
  DIGIT, SEMI, LT, EQ, GT, QMARK, 
  HEXA, XA, ALPHA0, OTHER ] = flags ()

const HEX   = DIGIT | HEXA
const ALPHA = HEXA | ALPHA0 | XA
const WSP   = LF | FF | CR | SPACE
// The Character Class Rolled Radix Map :D

function RRMap (trie) {
  const len = trie.length - 1
  return i => {
    const i1 = i >> 4
    const trie_ = trie [ len <= i1 ? len : i1 ]

    const i2 = (i + trie_[0]) & 0b1111
    const len2 = trie_.length - 1
    return trie_ [ len2 <= i2 ? len2 : i2 + 1 ]
  }
}

const _ = OTHER
const _charClass = [
  [ 7n, TAB, LF, _, FF, CR, _, _, NUL, _ ],
  [ 0n, _ ],
  [ 3n, DASH, _, SL, SPACE, EXCL, QUOT, HASH, _, _, AMP, SQUO, _ ],
  [ 6n, _, SEMI, LT, EQ, GT, QMARK, DIGIT ],
  [ 0n, _, HEXA, HEXA, HEXA, HEXA, HEXA, HEXA, ALPHA0 ],
  [ 8n, XA, ALPHA0, ALPHA0, _, _, _, _, _, ALPHA0 ],
  [ 0n, _, HEXA, HEXA, HEXA, HEXA, HEXA, HEXA, ALPHA0 ],
  [ 8n, XA, ALPHA0, ALPHA0, _, _, _, _, _, ALPHA0 ],
  [ 0n, _ ],
]

const charClass = RRMap (_charClass)


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


// Lexer
// -----

// Internally this is a lazy pull parser. The main loop
// is driven by batchRead and/(or) read calls. 

function stateInfo (st) {
  const ch = String.fromCharCode
  const { line, col, last, quote, tagname, tagname_ } = st
  const r = { line, col, last: st.last, quote:st.quote ? st.quote : null, tagname, tagname_ }
  for (let k in st) if (!(k in r) && r[k])
    r[k] = typeName (st[k])
  r.st = typeName (st.st)
  return r
}

function Lexer () {

  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let tag, refIn        // tag-context, charref-context
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname buffer
  let namespace

  // Stream and Emitter state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let line, lastNl
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0            // output labels

  // API
  hidden  (this, { reset, write, end, setNamespace, batchRead, read, _unwrite })
  getters (this, { state: () => {
    const col = lastEmit - lastNl
    return { line, col, st, sub, content, tag, refIn, last, quote, tagname, tagname_, label0 } } })

  // Init
  const self = this
  return reset ()

  // Implementation
  function reset () {
    st = content = Data
    sub = tag = refIn = None
    last = quote = None
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

  function setNamespace (ns) {
    namespace = ns
  }

  function* batchRead (n = 4) {
    let output = []
    while (queue.length) {
      lastEmit = 0
      input = rest ? rest + queue.shift () : queue.shift ()
      //log ('readLoop', { rest, input, lastEmit, queue})
      
      for (let i=rest.length, l=input.length; i<l; i++) {
        // log (input[i], 'in', stateInfo (self.state))

        //////////  This is the Lexer Core  ///////////
        ////////// Start of transition table //////////

        let l0 = label0, label1 = st
        let _line = line, _nl = lastNl
        const c = BigInt (input.charCodeAt(i))

        // Inlined for speed
        // Look up the character class
        const i1 = c >> 4n
        const trie_ = _charClass [ i1 ] || [ 0n, _ ]
        const i2 = (c + trie_[0]) & 0b1111n
        const len2 = BigInt (trie_.length) - 1n
        const cc = trie_ [ len2 <= i2 ? len2 : i2 + 1n ]

        do {

          // ### Line count

          if (cc & (CR|LF) && last !== CR) {
            _line++
            _nl = i+1
          }

          // ### Character References

          if (st & canStartCharRef && last & AMP) {
            if (cc & ALPHA) {
              [refIn, label1, st] = [st, NamedRef, NamedRef]
              continue
            }
            if (cc === HASH) {
              [refIn, label1, sub] = [st, null, NumRef];
              continue
            }
          }

          if (sub & isCharRef && last & HASH && cc === XA) {
            [label1, sub] = [null, HexRef]
            continue
          }

          if ((sub || st) & isCharRef && cc === DIGIT) {
            st = sub || st;
            [label1, st, sub] = [st, st, None]
            continue
          }

          if ((sub || st) & HexRef && cc === HEX) {
            [label1, st, sub] = [HexRef, HexRef, None]
            continue
          }

          if (st & NamedRef && cc & ALPHA) {
            [label1, st, sub] = [NamedRef, NamedRef, None]
            continue
          }

          if (st & isCharRef && cc === SEMI) {
            [label1, st, sub, refIn] = [st, refIn, None, None]
            continue
          }

          if ((sub||st) & isCharRef) {
            // NB fallthrough!
            [st, sub, refIn] = [refIn, None, None]
          }

          // ### Quoted Attribute Values

          if (quote && (st|refIn) & Value) { // rows
            [l0, label1, st, sub, quote]
              = cc === quote ? [st, Value|End, BeforeAtt, None, None]
              : [st, cc === AMP ? null : st, Value, None, quote]
            continue
          }

          // ### Tag Starters

          if (cc === LT && st & canHaveTag) {
            [l0, label1] = [content, null]
            continue
          }

          if (cc === SL && last & LT && st & canHaveTag) {
            [label1, st] = [null, MDecl]
            continue
          }

          if (st & Data && last & LT) {

            if (cc & (EXCL|SL)) {
              [label1, st] = [null, MDecl]
              continue
            } 

            if (cc === QMARK) {
              [label1, st] = [Bogus|Start, Bogus]
              continue
            } 

            if (cc & ALPHA) { // row - potential tag in data
              [label1, st, tag, tagname_] = [null, StartTag, StartTag, input[i]]
              // : [Data|Warn, Data, null, '']
              continue
            }
          }

          // ### Tag Endings

          if (tag && cc === GT) { // cells
            if (tag === EndTag && content !== Data && tagname !== tagname_)
              [label1, st, tag] = [content, content, null] // not a tag after all
            else {
              if (tag === StartTag) {
                content = namespace ? Data : contentMap [tagname_] || Data
                tagname = tagname_
              }
              else {
                content = Data
                tagname = ''
              }
              [l0, label1, st, tag] = [st & StartTag || st & EndTag ? tag|Start : st, tag|End, content, null];
            }
            continue
          }

          if (st & canEndTag && cc === GT) { // cells
            const mark = st & MDecl ? Start : None;
            [l0, label1, st, sub] = [Bogus|mark, Bogus|End, content, None]
            continue
          }

          if (st & Comment && cc === GT) { // cells
            [label1, st, sub]
              = (sub === End || sub === Start && last & DASH) ? [Comment|End, Data, None]
              : [st, st, None]
            continue
          }

          // ...
          if (st === MDecl) { // row - start closetag - tagname or bogus
            if (last & SL && cc & ALPHA) {
              [label1, st, tag, tagname_] = [null, EndTag, EndTag, input[i]]
              continue
            }
            if (cc & WSP) {
              [l0, label1, st] = [Bogus|Start, Comment|Space, Bogus]
              continue
            }
            if (cc === DASH) {
              [l0, label1, st, sub]
              = last === DASH ? [Comment|Start, Comment|Start, Comment, Start]
              : [null, null, MDecl, None]
            continue
            }
            else [label0, label1, st] = [Bogus|Start, Bogus, Bogus]
            continue
          }


          if (st & (StartTag|EndTag)) { // row (inside tag name)
            if (cc & (SL|WSP)) // cells '/' and space
              [l0, label1, st, tag]
                = (tag === EndTag && content !== Data && tagname !== tagname_) ? [content, content, content, null]
                : [tag|Start, null, BeforeAtt, tag]
            else [label1, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (cc & WSP) { // column; (handles deviating cell in BeforeValue row too)
            [l0, label1, st]
              = st & hasSpace ? [st, st|Space, st]
              : st === Value && !quote ? [Value, null, BeforeAtt]
              : st === AttName ? [AttName, null, AfterAttName]
              : [st, st, st]
            continue
          }

          label1 = st
      
          if (st === Comment) {
            if (cc === EXCL)
              [label1, sub] = [sub !== End ? Comment : null, sub === End && last !== EXCL ? sub : None]
            else if (cc === DASH)
              [label1, sub] = [null, sub === End || last === DASH ? End : sub]
              // [label1, sub] = [null, sub === End ? null : last === DASH ? End : sub]
            else sub = None
          }

          if (st === BeforeValue) { let l // row
            [l0, label1, st, quote] = cc & (QUOT|SQUO)
              ? [BeforeValue, Value|Start, Value, cc]
              : [BeforeValue, cc === AMP ? null : Value, Value, None];
            continue
          }

          if (cc === AMP && st & canStartCharRef) {
            [l0, label1] = [refIn || st, null]
            continue
          }

          if (cc === EQ && st & (AttName | AfterAttName)) { // cells
            [l0, label1, st] = [st, Assign, BeforeValue]
            continue
          }

          if (cc === SL && st & hasTagSpace) { // cells
            [label1, st] = [null, BeforeAtt]
            continue
          }

          if (st & (BeforeAtt | AfterAttName)) { // rows - start attribute name
            [l0, label1, st] = [st, AttName, AttName]
            continue
          }

        }
        while (false) // Just to use continue as a break
        last = cc // And this is outside the loop for that very reason

        ////////// End of transition table //////////
        //////////  Start of emitter code  //////////

        if (label0 === null) label0 = l0
        if (label0 && label0 !== label1) { // Indicates a cut
          output[output.length] = [label0, input.substring (lastEmit, (lastEmit = i))]
          if (output.length === n || !queue.length) { yield output; output = [] }
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

Object.assign (Lexer, { Lexer, stateInfo, typeName, tokenTypes, tokenRoles, typeMask, roleMask })
module.exports = Lexer
