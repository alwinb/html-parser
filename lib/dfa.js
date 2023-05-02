function* range (a, z = Infinity) { while (a <= z) yield a++ }
const intsInto = (map, i = 0) => new Proxy ({}, { get:($,k) => (map [k] = i, i++) })
const log = console.log.bind (console)


// HTML Lexer
// ==========

// TODO: Doctypes, CDATA, Plaintext, ...
// and clean up the produced token tags


// Characters - Equivalence Classes
// --------------------------------

// const [
//   nul, cr, lf, other, quot, squo, space, term, hash, amp, eq, que,
//   excl, dash, lt, gt, slash, digit, A_F, G_WYZ, X, a_f, g_wyz, x ] = range (1)

const defaultClass = 4 // other

const eqClass = new Uint8Array ([
//NUL SOH STX ETX EOT ENQ ACK BEL BS  HT  LF  VT  FF  CR  SO  SI
   1,  4,  4,  4,  4,  4,  4,  4,  4,  7,  3,  4,  4,  2,  4,  4,
//DLE DC1 DC2 DC3 DC4 NAK SYN ETB CAN EM  SUB ESC FS  GS  RS  US
   4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,
// SP  !   "   #   $   %   &   '   (   )   *   +   ,   -   .   /                    
   7,  13, 5,  9,  4,  4,  10, 6,  4,  4,  4,  4,  4,  14,  4, 17,
// 0   1   2   3   4   5   6   7   8   9   :   ;   <   =   >   ?
  18, 18, 18, 18, 18, 18, 18, 18, 18, 18,  4,  8, 15, 11, 16,  12
// @   A   B   C   D   E   F   G   H   I   J   K   L   M   N   O
,  4,  19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20,
// P   Q   R   S   T   U   V   W   X   Y   Z   [   \   ]   ^   _
  20, 20, 20, 20, 20, 20, 20, 20, 21, 20, 20,  4,  4,  4,  4,  4,
// '   a   b   c   d   e   f   g   h   i   j   k   l   m   n   o
   4,  22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23,
// p   q   r   s   t   u   v   w   x   y   z   {   |   }   ~  DEL
   23, 23, 23, 23, 23, 23, 23, 23, 24, 23, 23, 4,  4,  4,  4,  4
])

// Token Ids 
// ---------

const errorToken = 0
const tokens = { errorToken }
const {
  data, rawtext, rcdata, plaintext,
  nulls, space, newline, amp, lt,
  charRefDecimal, charRefHex, charRefNamed, charRefLegacy,
  mDeclStart, commentStart, commentData, commentEnd,
  bogusStart, bogusData, bogusEnd,

  startTag, endTag,
  startTag_, endTag_,
  startTagStart, endTagStart,
  startTagStart_, endTagStart_, tagEnd,

  attrSpace, attrSpaceNL, tagSpace, tagSpaceNL, 
  attributeName_, attributeName, attributeAssign,
  valueStartApos, valueStartQuot, valueEnd,
  unquoted, squoted, quoted,
} = intsInto (tokens, 1)

const names = []
for (const k in tokens) names[tokens[k]] = k
// log (tokens, names)


// DFA States
// ----------

const [
  
  // Entry States

  Main, RcData, RawText,
  BeforeAttribute, BeforeAssign, BeforeValue,
  BeforeCommentData, InCommentData, Bogus,
  ValueQuoted, ValueAposed, ValueUnquoted,

  // Internal States

  RLTs, LXD, DD, DX, AmpH, AmpX, Nul, 
  TOP, Txt, Raw, Rcd, Att, att, Val, ValQ, ValS,
  Bog, Cmt, CmtD, CmtSD,
  Amp, Ref, xRef, dRef,
  LT, LTs, LTx,
  STN, ETN, stn, etn, DTN,
  RawLT, RcdLT, 
  Eq, Wsp, Tsp, Vsp, Asp, 
  CR, TCR, VCR, ACR,  
  LXDD,  TagE, Bog_, Cmt_,
  lQ_, Sq_, rQ_, nRef_, dRef_, xRef_, 
  NL_, TNL_, ANL_, ST_, ET_, st_, et_
] = range (1)


const Fail = 0
const states = {
  Fail, Main, RcData, RawText, PlainText:TOP,
  BeforeAttribute, BeforeAssign, BeforeValue,
  BeforeCommentData, InCommentData, Bogus,
  ValueQuoted, ValueAposed, ValueUnquoted,
}


// State Transitions
// -----------------

// Columns are character classes, rows are states.
// The first column marks the acceptance of states, by labeling
// it with a nonzero token-type. The runtime assumes that states
// are pre-sorted, such that all states st >= minAccepts are
// accepting states that produce an output token. 

const ___ = Fail
const minAccepts = Nul

// REVIEW How shshould NUL be handled in rawtext / rcdata?
// TODO handle newlines separately always
// NB nulls in attribute names and values are to be always
// converted to u+fffd and they do not end unquoted values.


const table =  [
//                 nul   CR    LF    other  "     '    \s     ;     #     &     =     ?     !     -     <     >     /    0-9   A-F   G-WYZ  X    a-f   g-wyz  x  ;
[ 0,               ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Fail
[ 0,               Nul,   CR,   NL_, Txt,  Txt,  Txt,  Wsp,  Txt,  Txt,  Amp,  Txt,  Txt,  Txt,  Txt,  LT,   Txt,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt ], // Main
[ 0,               Nul,   CR,   NL_, Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Amp,  Rcd,  Rcd,  Rcd,  Rcd,  RcdLT,Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd ], // RcData
[ 0,               Nul,   CR,   NL_, Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  RawLT,Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw ], // RawText
[ 0,               Att,  ACR,  ANL_, att,  att,  att,  Asp,  att,  att,  att,  att,  att,  att,  att,  att,  TagE, Asp,  att,  Att,  Att,  Att,  att,  att,  att ], // BeforeAttribute
[ 0,               Att,  TCR,  TNL_, att,  att,  att,  Tsp,  att,  att,  att,  Eq,   att,  att,  att,  att,  TagE, Asp,  att,  Att,  Att,  Att,  att,  att,  att ], // BeforeAssign
[ 0,               Val,  VCR,  TNL_, Val,  lQ_,  Sq_,  Vsp,  Val,  Val,  Amp,  Val,  Val,  Val,  Val,  Val,  TagE, Val,  Val,  Val,  Val,  Val,  Val,  Val,  Val ], // BeforeValue
[ 0,               Nul,   CR,   NL_, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  CmtSD,Cmt,  Cmt_, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // BeforeCommentData
[ 0,               Nul,   CR,   NL_, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  CmtD, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // InCommentData
[ 0,               Nul,   CR,   NL_, Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog_, Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog ], // Bogus
[ 0,               Nul,   CR,   NL_, ValQ, rQ_,  ValQ, ValQ, ValQ, ValQ, Amp,  ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ], // ValueQuoted
[ 0,               Nul,   CR,   NL_, ValS, ValS, rQ_,  ValS, ValS, ValS, Amp,  ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS], // ValueAposed
[ 0,               Val,  ACR,  ANL_, Val,  Val,  Val,  Asp,  Val,  Val,  Amp,  Val,  Val,  Val,  Val,  Val,  TagE, Val,  Val,  Val,  Val,  Val,  Val,  Val,  Val ], // ValueUnquoted
[ 0,               ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN ], // RLTs   after </ in rcdata/raw
[ 0,               ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  LXDD, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // LXD    after <!-
[ 0, /*TODO CRLF*/ Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  DX,   ___,  Cmt,  Cmt_, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // DD     after --
[ 0, /*TODO CRLF*/ Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt_, Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // DX     after -!
[ 0,               ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  dRef, ___,  ___,  AmpX, ___,  ___,  AmpX], // AmpH   after &#
[ 0,               ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  xRef, xRef, ___,  ___,  xRef, ___,  ___ ], // AmpX   after &#x or &#X
[ nulls,           Nul,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Nul    null bytes
[ plaintext,       TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP,  TOP ], // TOP    anyting / plaintext  
[ data,            ___,  ___,  ___,  Txt,  Txt,  Txt,  ___,  Txt,  Txt,  ___,  Txt,  Txt,  Txt,  Txt,  ___,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt,  Txt ], // Txt    data / non-space
[ rawtext,         ___,  ___,  ___,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  ___,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw ], // Raw    rawtext
[ rcdata,          ___,  ___,  ___,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  ___,  Rcd,  Rcd,  Rcd,  Rcd,  ___,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd ], // Rcd    rcdata
[ attributeName_,  Att,  ___,  ___,  Att,  Att,  Att,  ___,  Att,  Att,  Att,  ___,  Att,  Att,  Att,  Att,  ___,  ___,  Att,  Att,  Att,  Att,  Att,  Att,  Att ], // Att   (non-normal attribute name)
[ attributeName,   Att,  ___,  ___,  att,  att,  att,  ___,  att,  att,  att,  ___,  att,  att,  att,  att,  ___,  ___,  att,  Att,  Att,  Att,  att,  att,  att ], // att   (normal attribute name)
[ unquoted,        Val,  ___,  ___,  Val,  Val,  Val,  ___,  Val,  Val,  ___,  Val,  Val,  Val,  Val,  Val,  ___,  Val,  Val,  Val,  Val,  Val,  Val,  Val,  Val ], // Val
[ quoted,          ___,  ___,  ___,  ValQ, ___,  ValQ, ValQ, ValQ, ValQ, ___,  ValQ, ValQ, ValQ, ValQ, ValQ,ValQ,  ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ, ValQ], // ValQ   double-quoted value
[ squoted,         ___,  ___,  ___,  ValS, ValS, ___,  ValS, ValS, ValS, ___,  ValS, ValS, ValS, ValS, ValS,ValS,  ValS, ValS, ValS, ValS, ValS, ValS, ValS, ValS], // ValS   single-quoted value
[ bogusData,       ___,  ___,  ___,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  ___,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog,  Bog ], // Bog    bogus-comment-data
[ commentData,     ___,  ___,  ___,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  ___,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // Cmt    comment-data
[ commentData,     ___,  ___,  ___,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  DD,   Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // CmtD   after - in comment
[ commentData,     ___,  ___,  ___,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  DX,   DD,   Cmt, Cmt_,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt,  Cmt ], // CmtSD  after - after <!--
[ amp,             ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  AmpH, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  Ref,  Ref,  Ref,  Ref,  Ref,  Ref ], // Amp
[ charRefLegacy,   ___,  ___,  ___,  ___,  ___,  ___,  ___,  nRef_,___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  Ref,  Ref,  Ref,  Ref,  Ref,  Ref,  Ref ], // Ref
[ charRefHex,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  xRef_,___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  xRef, xRef, ___,  ___,  xRef, ___,  ___ ], // xRef
[ charRefDecimal,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  dRef_,___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  dRef, ___,  ___,  ___,  ___,  ___,  ___ ], // dRef
[ lt,              ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  LTx,  LTx,  ___,  ___,  ___,  LTs,  ___,  STN,  STN,  STN,  stn,  stn,  stn ], // LT     after <
[ bogusStart,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ETN,  ETN,  ETN,  etn,  etn,  etn ], // LTs    after </
[ bogusStart,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  LXD,  ___,  ___,  ___,  ___,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN ], // LTx    after <! or <?
[ startTagStart_,  STN,  ___,  ___,  STN,  STN,  STN,  ___,  STN,  STN,  STN,  STN,  STN,  STN,  STN,  STN,  ST_,  ___,  STN,  STN,  STN,  STN,  STN,  STN,  STN ], // STN    after <A  -- non-normal
[ endTagStart_,    ETN,  ___,  ___,  ETN,  ETN,  ETN,  ___,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ET_,  ___,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN,  ETN ], // ETN    after </A -- non-normal
[ startTagStart,   STN,  ___,  ___,  stn,  stn,  stn,  ___,  stn,  stn,  stn,  stn,  stn,  stn,  stn,  stn,  st_,  ___,  stn,  STN,  STN,  STN,  stn,  stn,  stn ], // stn    after <a  -- normal
[ endTagStart,     ETN,  ___,  ___,  etn,  etn,  etn,  ___,  etn,  etn,  etn,  etn,  etn,  etn,  etn,  etn,  et_,  ___,  etn,  ETN,  ETN,  ETN,  etn,  etn,  etn ], // etn    after </a -- normal
[ mDeclStart,      DTN,  ___,  ___,  DTN,  DTN,  DTN,  ___,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  ___,  ___,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN,  DTN ], // DTN    after <!a
[ rawtext,         ___,  ___,  ___,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  ___,  Raw,  RLTs, Raw,  Raw,  Raw,  Raw,  Raw,  Raw,  Raw ], // RawLT  after <
[ rcdata,          ___,  ___,  ___,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  ___,  Rcd,  RLTs, Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd,  Rcd ], // RcdLT  after <
[ attributeAssign, ___,  ___,  ___,  ___,  ___,  ___,  Eq,   ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Eq     after =
[ space,           ___,  ___,  ___,  ___,  ___,  ___,  Wsp,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Wsp    whitespace
[ tagSpace,        ___,  TCR,  TNL_, ___,  ___,  ___,  Tsp,  ___,  ___,  ___,  Eq,   ___,  ___,  ___,  ___,  TagE, Asp,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Tsp    after attname-space
[ tagSpace,        ___,  VCR,  TNL_, ___,  ___,  ___,  Vsp,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  TagE, Asp,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Vsp    after attname-=-space
[ attrSpace,       ___,  ACR,  ANL_, ___,  ___,  ___,  Asp,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  TagE, Asp,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Asp    space before attribute
[ newline,         ___,  ___,   NL_, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // CR     after CR
[ tagSpaceNL,      ___,  ___,  TNL_, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // TCR    after attname-space-CR
[ tagSpaceNL,      ___,  ___,  TNL_, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // VCR    after attname-=-space-CR
[ attrSpaceNL,     ___,  ___,  ANL_, ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // ACR    space+cr before attribute
[ commentStart,    ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // LXDD   after <!--
[ tagEnd,          ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // TagE   after >
[ bogusEnd,        ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Bog_   after >
[ commentEnd,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Cmt_   
[ valueStartQuot,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // lQ_    after "
[ valueStartApos,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // Sq_    after '
[ valueEnd,        ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // rQ_    after ' or " (or space)
[ charRefNamed,    ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // nRef_  after eg. &amp;
[ charRefDecimal,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // dRef_  after eg. &#10;
[ charRefHex,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // xRef_  after eg. &#xAA;
[ newline,         ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // NL_    after (CR)LF
[ tagSpaceNL,      ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // TNL_   after (CR)LF after attname
[ attrSpaceNL,     ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // ANL_   after (CR)LF between attrs
[ startTag_,       ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // ST_ 
[ endTag_,         ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // ET_
[ startTag,        ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // st_ 
[ endTag,          ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___,  ___ ], // et_
//                 nul   CR    LF    other  "     '    \s     ;     #     &     =     ?     !     -     <     >     /    0-9   A-F   G-WYZ  X    a-f   g-wyz  x  ;
]


// State machine bundle
// --------------------

const DFA = {
  eqClass,
  defaultClass,
  tokens,
  states,
  table,
  initialState: Main,
  minAccepts,
}

export default DFA