const IntsOnto = (map = {}, start = 0) =>
  new Proxy ({}, { get:(_,k) => map [k] || (map[k] = start++) })
const log = console.log.bind (console)


// Equivalence classes of Nodes / Elements
// =======================================

const classIds = {}
const eq = classIds // alias

// The following specifies a collection of equivalence classes of Node-types
// and especially, DOM elements. Some of these classes correspond to a single
// element-tagName. Others correspond to a finite or cofinite set of element-
// tagNames, or to non-element node-types. However there are three cases where
// attributes are taken into account:
//
// * <input type=hidden> is distinguished from other <input> tags
// * <font> tags are distinguished by their attributes
// * <annotation-xml> tags are distinguished by their encoding attribute
//
// NB this assignment distinguishes between elements in the html vs foreign
// namespaces.

const {

  COMMENT, SPACE, TEXT, DOCTYPE, html, head, frameset, frame,
  style, script, template, noscript, meta, title, noframes, OtherMeta,
  body, col, colgroup, caption, TCell, tr, TBody, table,
  xmp, form, p, address, div, Listing, List, DlQuote, li, DListItem, 
  Heading, OtherBlock, button, Applet, select, optgroup, option,  
  a, nobr, HtmlFont, OtherFmt, SubSup, 
  hr, br, img, image, embed, textarea, keygen, input, hiddenInput,
  AreaWbr, OtherVoid, OtherRaw, OtherHtml, 
  math, svg, EmbedXml, EmbedHtml, OtherForeign,

} = IntsOnto (classIds)


// Boolean combinations of node-equivalence classes
// -------------------------------------------------

// log ('Min id:', COMMENT, 'Max id:', OtherForeign)

// There are (phew!) 64 equivalence classes. Boolean combinations
// (i.e. set-theoretic union and intersections) of the equivalence
// classes can thus be represented as a bitvector (an int) of 64 bits.

const ClassVecs = {}
for (const k in classIds)
  ClassVecs[k] = 1n << BigInt (classIds[k])

function printKind (info) {
  // prints an element-equivalence-class-bitvector
  if (info === ~0n) return 'Any'
  if (info === 0n) return 'None'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in ClassVecs) if (ClassVecs [k] & _info) r.push (k)
  return `${info < 0n ? '~' : '' }` + (r.length === 1 ? r[0] : `(${r.join (' | ')})`)
}

// Boolean combinations;

const C = Object.assign ({}, ClassVecs)

const None = 0n
const Any = -1n

C.RcDataElement =
 C.textarea | C.title

C.RawTextElement =
  C.style | C.script | C.xmp | C.noframes | C.OtherRaw

C.VoidElement =
  C.embed | C.img | C.image | C.hr | C.br |
  C.col | C.frame | C.AreaWbr | C.input | C.keygen | C.hiddenInput | C.OtherVoid |
  C.OtherMeta | C.meta

C.FormattingContextElement = 
  C.html | C.template | C.caption | C.table | C.TCell | C.Applet
  // Used by the parser to direct format tag reopening

C.FormattingElement =
  C.a | C.nobr | C.HtmlFont | C.OtherFmt

C.SpecialBlockElement = // NB: does not contain C.Applet nor button, nor table (they are allowed in phrasing)
  C.div | C.address | C.li | C.List | C.Heading | C.DListItem | C.DlQuote | C.Listing |
  C.p | C.OtherBlock | C.xmp | C.form

C.BreakoutElement = 
  C.body | C.head | C.table |
  C.SubSup | C.FormattingElement &~ C.a |
  C.embed | C.img | C.image | C.hr | C.br | C.meta |
  C.div | C.li | C.List | C.Heading | C.DListItem | C.DlQuote | C.Listing | C.p
  // C.SpecialBlockElement &~ (C.address | C.OtherBlock | C.xmp | C.form)// i.e.

C.Tabular = // sectioning within <table>
  C.caption | C.colgroup | C.col | C.TBody | C.tr | C.TCell

C.Meta = // goes into the <head>
  C.title | C.script | C.style | C.template | C.noscript | C.noframes | C.meta | C.OtherMeta

C.FlowContent = // goes into <body>, <caption>, <td>, <object>, <div>, <ul>, block-elements alike
  ~ ( C.DOCTYPE | C.html | C.head | C.body | C.frameset | C.frame | C.Tabular | C.EmbedXml | C.EmbedHtml | C.OtherForeign )

C.PhrasingContent = // goes into <p> elements
  C.FlowContent &~ C.SpecialBlockElement

C.FosterParentedContent = // is this even necessary?
  C.FlowContent &~ (C.table | C.Tabular | C.script | C.style | C.template | C.hiddenInput | C.COMMENT | C.SPACE | C.form)

C.ForeignElement =
  C.math | C.svg | C.EmbedXml | C.EmbedHtml | C.OtherForeign // | C.SPACE | C.TEXT | C.COMMENT

//

C.Reformat =
  C.AreaWbr | C.input | C.keygen | C.Applet | C.OtherHtml | C.FormattingElement | C.select |
  C.optgroup | C.option | C.button | C.math | C.svg | C.br | C.xmp |  C.TEXT | C.SPACE,

C.FramesetOK =
  C.optgroup | C.option | C.div | C.address | C.p | C.Heading | C.List | C.FormattingElement |
  C.OtherVoid | C.DlQuote | C.OtherBlock | C.form | C.OtherHtml | C.COMMENT | C.SPACE | C.DOCTYPE |
  C.html | C.head | C.body | C.svg | C.math | C.SubSup | C.hiddenInput | C.EmbedHtml | C.OtherForeign | C.EmbedXml |
  C.frame | C.frameset | C.noframes // last line, hack it



// Equivalence class assignment
// ----------------------------

// Breakout tags - these are always considered to be elements in the
// html namespace, also if they occur inside of svg and mathML.

const breakoutEqClasses = {

  b:       [ OtherFmt ],
  big:     [ OtherFmt ],
  code:    [ OtherFmt ],
  em:      [ OtherFmt ],
  i:       [ OtherFmt ],
  s:       [ OtherFmt ],
  small:   [ OtherFmt ],
  strike:  [ OtherFmt ],
  strong:  [ OtherFmt ],
  tt:      [ OtherFmt ],
  u:       [ OtherFmt ],

  sub:     [ SubSup ],
  sup:     [ SubSup ],
  var:     [ SubSup ],
  ruby:    [ SubSup ],
  span:    [ SubSup ],

  h1:      [ Heading ],
  h2:      [ Heading ],
  h3:      [ Heading ],
  h4:      [ Heading ],
  h5:      [ Heading ],
  h6:      [ Heading ],

  dl:      [ DlQuote ],
  menu:    [ DlQuote ],
  center:  [ DlQuote ],
  blockquote: [ DlQuote ],

  listing: [ Listing ],
  pre:     [ Listing ],

  dd:      [ DListItem ],
  dt:      [ DListItem ],

  ul:      [ List ],
  ol:      [ List ],

  font:    [ HtmlFont ], // if it has a specialFontAttribute

  body:    [ body ],
  br:      [ br, null ],
  div:     [ div ],
  embed:   [ embed ],
  head:    [ head ],
  hr:      [ hr, null ],
  img:     [ img, null ],
  li:      [ li ],
  meta:    [ meta, null ],
  nobr:    [ nobr ],
  p:       [ p ],
  table:   [ table ]
}

const _specialFontAttributes =
  { color:1, face:1, size:1 }

// Html namespace, consisting of
// the above, extended as follows,

const htmlEqClasses = Object.assign ({

  summary:    [ OtherBlock ],
  article:    [ OtherBlock ],
  aside:      [ OtherBlock ],
  details:    [ OtherBlock ],
  dialog:     [ OtherBlock ],
  dir:        [ OtherBlock ],
  fieldset:   [ OtherBlock ],
  figcaption: [ OtherBlock ],
  figure:     [ OtherBlock ],
  footer:     [ OtherBlock ],
  header:     [ OtherBlock ],
  hgroup:     [ OtherBlock ],
  main:       [ OtherBlock ],
  nav:        [ OtherBlock ],
  plaintext:  [ OtherBlock ],
  section:    [ OtherBlock ],

  base:       [ OtherMeta  ],
  basefont:   [ OtherMeta  ],
  bgsound:    [ OtherMeta  ],
  link:       [ OtherMeta  ],

  param:      [ OtherVoid  ],
  source:     [ OtherVoid  ],
  track:      [ OtherVoid  ],

  applet:     [ Applet     ],
  marquee:    [ Applet     ],
  object:     [ Applet     ],

  thead:      [ TBody      ],
  tbody:      [ TBody      ],
  tfoot:      [ TBody      ],

  td:         [ TCell      ],
  th:         [ TCell      ],

  area:       [ AreaWbr    ],
  wbr:        [ AreaWbr    ],

  iframe:     [ OtherRaw   ],
  noembed:    [ OtherRaw   ],

  a:          [ a          ],
  address:    [ address    ],
  button:     [ button     ],
  caption:    [ caption    ],
  col:        [ col        ],
  colgroup:   [ colgroup   ],
  form:       [ form       ],
  frame:      [ frame      ],
  frameset:   [ frameset   ],
  html:       [ html       ],
  image:      [ image      ],
  input:      [ input      ],
  keygen:     [ keygen     ],
  math:       [ math       ],
  noframes:   [ noframes   ],
  noscript:   [ noscript   ],
  optgroup:   [ optgroup   ],
  option:     [ option     ],
  script:     [ script     ],
  select:     [ select     ],
  style:      [ style      ],
  svg:        [ svg        ],
  template:   [ template   ],
  textarea:   [ textarea   ],
  title:      [ title      ],
  tr:         [ tr         ],
  xmp:        [ xmp        ],
  // #default: OtherHtml,
}, breakoutEqClasses)


// Math namespace

const mathEqClasses = Object.assign ({
  mi:    [ EmbedHtml ],
  mo:    [ EmbedHtml ],
  mn:    [ EmbedHtml ],
  ms:    [ EmbedHtml ],
  mtext: [ EmbedHtml ],
  'annotation-xml': [ EmbedXml ], // depending on encoding attribute,
  svg:   [ svg ] // depending on EmbedXml context
  // #default: OtherForeign
}, breakoutEqClasses)

// Svg namespace

const svgEqClasses = Object.assign ({
  foreignobject: [ EmbedHtml ],
  title: [ EmbedHtml ],
  desc: [ EmbedHtml ],
  // #default: OtherForeign
}, breakoutEqClasses)

// ### The eqClass function

function elementClass ({ name, attrs }, context = S.main) {

  // in math

  if (context & S.inMath) {
    const id = ( mathEqClasses [name]
      ?? [ eq.OtherForeign ] ) [0] // UUh! NB careful svg is reassigned

    if (id === eq.HtmlFont) {
      for (const name in attrs)
        if (name in _specialFontAttributes)
          return eq.HtmlFont;
      return eq.OtherForeign
    }

    else if (id === eq.svg && !(context & S.inSvg))
      return eq.OtherForeign

    else if (id === eq.EmbedXml && attrs && attrs.encoding) {
      const v = attrs.encoding.toLowerCase ()
      if (v === 'text/html' || v === 'application/xhtml+xml')
        return eq.EmbedHtml
    }
    return id
  }
  
  // in svg

  else if (context & S.inSvg) {
    const id = ( svgEqClasses [name]
      ?? [ eq.OtherForeign ] ) [0]

    if (id === eq.HtmlFont) {
      for (const name in attrs)
        if (name in _specialFontAttributes)
          return eq.HtmlFont;
      return eq.OtherForeign
    }
    return id
  }
  
  // In html

  const id = ( htmlEqClasses [name]
    ?? [ eq.OtherHtml ]) [0]

  if (id === eq.input && attrs && attrs.type && attrs.type.toLowerCase () === 'hidden')
    return eq.hiddenInput
  return id
}

// Kind returns the element class converted to a bitvector

function Kind (arg1, context) {
  return 1n << BigInt (elementClass (arg1, context))
}


// Content model / parser states
//  Temporary, this is being reworked

const S = {
  main:        1 << 0,
  inTable:     1 << 1,
  inSvg:       1 << 2,
  inMath:      1 << 3,
  inSelect:    1 << 4,
  inPhrasing:  1 << 5,
}


// Exports
// =======

export {
  classIds, ClassVecs, elementClass, Kind, printKind, 
  Any, None, C,
  S as states
}