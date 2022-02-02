function* range (a, z = Infinity) { while (a <= z) yield a++ }
const intsInto = (map, i = 0) => new Proxy ({}, { get:($,k) => (map [k] = i, i++) })
const log = console.log.bind (console)


// HTML Lexer
// ==========

// TODO: Doctypes, CDATA, Plaintext, ...
// And legacy charRefs
// and clean up the produced token tags


// Characters, equivalence classes
// -------------------------------

const eqClass = (() => {

  const
    [ nul, rest, quot, squo, space, term, hash, amp, eq, que, excl, dash, lt, gt, slash, digit, A_F, G_WYZ, X ] = range (1)

  const eqClassFn = c =>
    0x00 === c ? nul :
    0x09 === c ? space :
    0x0A === c ? space :
    0x0D === c ? space :
    0x20 === c ? space :
    0x21 === c ? excl :
    0x22 === c ? quot :
    0x23 === c ? hash :
    0x26 === c ? amp  :
    0x27 === c ? squo :
    0x2D === c ? dash :
    0x2F === c ? slash : 
    0x30 <= c && c <= 0x39 ? digit :
    0x3B === c ? term : 
    0x3C === c ? lt : 
    0x3D === c ? eq :
    0x3E === c ? gt : 
    0x3F === c ? que :
    0x41 <= c && c <= 0x46 ? A_F :
    0x47 <= c && c <= 0x5A ? G_WYZ :
    0x58 === c ? X :
    0x61 <= c && c <= 0x66 ? A_F :
    0x66 <= c && c <= 0x7A ? G_WYZ :
    0x78 === c ? X : rest;

  // Precompute a lookup table

  const table = []
  for (let i=0, l=0x7A; i<=l; i++)
    table [i] = eqClassFn (i)

  return table
}) ()


// Token Ids 
// ---------

const errorToken = 0
const tokens = { errorToken }
const {
  rawtext, rcdata, nulls, space, other, text, ampersand, lt,
  charRefDecimal, charRefHex, charRefLegacy, charRefNamed,
  commentStart, bogusStart, bogusData, commentData, mDeclStart,
  startTagStart, endTagStart, tagEnd, 
  attributeAssign, attributeName, attributeSep,
  valueEnd, valueStartQuot, valueStartSquo,
  unquoted, squoted, quoted,
} = intsInto (tokens, 1)

const names = []
for (const k in tokens) names[tokens[k]] = k
// log (tokens, names)


// Lexer States
// ------------

const [
  
  // Tokeniser States

  Main, RcData, RawText,
  BeforeAttribute, BeforeAssign, BeforeValue,
  CommentData, InComment, Bogus,
  ValueQuoted, ValueSQuoted, ValueUnquoted,

  // Lexer-internal States

  LXD, DD, DX,
  AmpH, AmpX,
  Nul, Wsp, Wrd, Oth, Raw, Rcd, Att,
  Val, ValQ, ValS,
  Bog, Cmt, CmtD, CmtSD, Sep,   
  Amp, Ref, xRef, dRef,
  LT, LTs, LTx,
  STN, ETN, DTN,
  RawLT, RcdLT, LXDD, TagE,
  Eq, Q, Sq, QEnd, nRef, dRefE, xRefE,

] = range (1)

// Exported states

const FAIL = 0
const states = {
  Main, RcData, RawText,
  BeforeAttribute, BeforeAssign, BeforeValue,
  CommentData, InComment, Bogus,
  ValueQuoted, ValueSQuoted, ValueUnquoted,
}


// State Transitions
// -----------------

// Columns are character classes, rows are states.
// The first column marks the acceptance of states, by labeling
// it with a nonzero token-type. The runtime assumes that states
// are pre-sorted, such that all states st >= minAccepts are
// accepting states that produce an output token. 

const ___ = FAIL
const minAccepts = Nul

const table =  [
//                   nul   other  "     '    \s     ;     #     &     =     ?     !     -     <     >     /    0-9   A-F   G-WYZ  X   ;
[ 0,                 ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // FAIL
[ 0,                 Nul,  Oth,  Oth,  Oth,  Wsp,  Oth,  Oth,  Amp,  Oth,  Oth,  Oth,  Oth,  LT,   Oth,  Oth,  Wrd,  Wrd,  Wrd,  Wrd  ], // Main
[ 0,                 Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Amp,  Rcd,  Rcd,  Rcd,  Rcd,  RcdLT,Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd  ], // RcData
[ 0,                 Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  RawLT,Raw,  Raw,  Raw,  Raw,  Raw,  Raw  ], // RawText
[ 0,                 Att,  Att,  Att,  Att,  Wsp,  Att,  Att,  Att,  Att,  Att,  Att,  Att,  Att,  TagE, Sep,  Att,  Att,  Att,  Att  ], // BeforeAttribute
[ 0,                 Att,  Att,  Att,  Att,  Wsp,  Att,  Att,  Att,  Eq,   Att,  Att,  Att,  Att,  TagE, Sep,  Att,  Att,  Att,  Att  ], // BeforeAssign
[ 0,                 Val,  Val,  Q,    Sq,   Wsp,  Val,  Val,  Amp,  Val,  Val,  Val,  Val,  Val,  TagE, Val,  Val,  Val,  Val,  Val  ], // BeforeValue
[ 0,                 Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  CmtSD,Cmt,  TagE, Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // CommentData
[ 0,                 Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  CmtD, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // InComment
[ 0,                 Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  TagE, Bog,  Bog,  Bog,  Bog,  Bog  ], // Bogus
[ 0,                 ValQ, ValQ, QEnd, ValQ, ValQ, ValQ, ValQ, Amp,  ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ ], // ValueQuoted
[ 0,                 ValS, ValS, ValS, QEnd, ValS, ValS, ValS, Amp,  ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS ], // ValueSQuoted
[ 0,                 Val,  Val,  Val,  Val,  QEnd, Val,  Val,  Amp,  Val,  Val,  Val,  Val,  Val,  TagE, Val,  Val,  Val,  Val,  Val  ], // ValueUnquoted
[ 0,                 ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  LXDD, ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // LXD:   after <!-
[ 0,                 Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  DX,   ___,  Cmt,  TagE, Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // DD:    after --
[ 0,                 Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  TagE, Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // DX:    after -!
[ 0,                 ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  dRef, ___,  ___,  AmpX ], // AmpH:  after &#x or &#X
[ 0,                 ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  xRef, xRef, ___,  ___  ], // AmpX:  after &#
[ nulls,             Nul,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // Nul    null bytes
[ space,             ___,  ___,  ___,  ___,  Wsp,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // Wsp    whitespace
[ text,              ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  Wrd,  Wrd,  Wrd,  Wrd  ], // Wrd    alphanumeric
[ other,             ___,  Oth,  Oth,  Oth,  ___,  Oth,  Oth,  ___,  Oth,  Oth,  Oth,  Oth,  ___,  Oth,  Oth,  ___,  ___,  ___,  ___  ], // Oth    non-alphanumeric
[ rawtext,           Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  ___,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw  ], // Raw    rawtext
[ rcdata,            Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  ___,  Rcd,  Rcd,  Rcd,  Rcd,  ___,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd  ], // Rcd    rcdata
[ attributeName,     Att,  Att,  Att,  Att,  ___,  Att,  Att,  Att,  ___,  Att,  Att,  Att,  Att,  ___,  ___,  Att,  Att,  Att,  Att  ], // Att
[ unquoted,          Val,  Val,  Val,  Val,  ___,  Val,  Val,  ___,  Val,  Val,  Val,  Val,  Val,  ___,  Val,  Val,  Val,  Val,  Val  ], // Val
[ quoted,            ValQ, ValQ, ___,  ValQ, ValQ, ValQ, ValQ, ___,  ValQ, ValQ, ValQ, ValQ, ValQ,ValQ,  ValQ, ValQ, ValQ, ValQ, ValQ ], // ValQ   double-quoted value
[ squoted,           ValS, ValS, ValS, ___,  ValS, ValS, ValS, ___,  ValS, ValS, ValS, ValS, ValS,ValS,  ValS, ValS, ValS, ValS, ValS ], // ValS   single-quoted value
[ bogusData  ,       Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  ___,  Bog,  Bog,  Bog,  Bog,  Bog  ], // Bog    bogus-comment-data
[ commentData,       Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  ___,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // Cmt:   comment-data
[ commentData,       Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  DD,   Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // CmtD:  after - in comment
[ commentData,       Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  DX,   DD,   Cmt, TagE,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt  ], // CmtSD: after - after <!--
[ attributeSep,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___, TagE,  Sep,  ___,  ___,  ___,  ___  ], // Sep
[ ampersand,         ___,  ___,  ___,  ___,  ___,  ___,  AmpH, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  Ref,  Ref,  Ref  ], // Amp
[ charRefLegacy,     ___,  ___,  ___,  ___,  ___,  nRef, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  Ref,  Ref,  Ref,  Ref  ], // Ref
[ charRefHex,        ___,  ___,  ___,  ___,  ___,  xRefE,___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  xRef, xRef, ___,  ___  ], // xRef
[ charRefDecimal,    ___,  ___,  ___,  ___,  ___,  dRefE,___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  dRef, ___,  ___,  ___  ], // dRef
[ lt,                ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  LTx,  LTx,  ___,  ___,  ___,  LTs,  ___,  STN,  STN,  STN  ], // LT:    after <
[ bogusStart,        ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ETN,  ETN,  ETN  ], // LTs:   after </
[ bogusStart,        ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  LXD,  ___,  ___,  ___,  ___,  DTN,  DTN,  DTN  ], // LTx:   after <!
[ startTagStart,     STN,  STN,  STN,  STN,  ___,  STN,  STN,  STN,  STN,  STN,  STN,  STN,  STN,  ___,  ___,  STN,  STN,  STN,  STN  ], // STN:   after <a
[ endTagStart,       ETN,  ETN,  ETN,  ETN,  ___,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ___,  ___,  ETN,  ETN,  ETN,  ETN  ], // ETN:   after </a
[ mDeclStart,        DTN,  DTN,  DTN,  DTN,  ___,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  ___,  ___,  DTN,  DTN,  DTN,  DTN  ], // DTN:   after <!a
[ rawtext,           Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  LTs,  Raw,  Raw,  Raw,  Raw  ], // RawLT: after </
[ rcdata,            Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  LTs,  Rcd,  Rcd,  Rcd,  Rcd  ], // RcdLT: after </
[ commentStart,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // LXDD:  after <!--
[ tagEnd,            ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // TagE:  after >
[ attributeAssign,   ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // Eq:    after =
[ valueStartQuot,    ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // Q      after "
[ valueStartSquo,    ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // Sq     after '
[ valueEnd,          ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // QEnd   after ' or " (or space)
[ charRefNamed,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // nRef   after eg. &amp;
[ charRefDecimal,    ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // dRefE  after eg. &#10;
[ charRefHex,        ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___  ], // xRefE  after eg. &#xAA;
]


// State machine bundle
// --------------------

const machine = {
  eqClass,
  defaultClass: other,
  tokens,
  states,
  table,
  initialState: Main,
  minAccepts,
}

export default machine