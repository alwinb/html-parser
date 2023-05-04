const IntsOnto = (map = {}, start = 0) =>
  new Proxy ({}, { get:(_,k) => map [k] || (map[k] = start++) })
const log = console.log.bind (console)


// Equivalence classes of Nodes / Elements
// =======================================

const classIds = {}
const eq = classIds // alias

// The following specifies a collection of equivalence classes of Node-types
// and especially, DOM elements. Some of these classes correspond to a single
// element-tagName. Yet, others correspond to a finite set of element-
// tagNames, or to the non-element node-types. However there are three cases
// where attributes are taken into account:
//
// * <input type=hidden> is distinguished from other <input> tags
// * <font> tags are distinguished by their attributes
// * <annotation-xml> tags are distinguished by their encoding attribute
//
// NB this assigns the category in a html vs svg vs math namespace dependent
// mannar.

const {

  DOCTYPE, COMMENT, TEXT, SPACE,
  html, head, body, frameset, frame, math, svg, table,
  caption, colgroup, col, tr, select, optgroup, option, hr,
  script, style, template, div, address, button, p, li, br,
  title, meta, noframes, xmp, a, textarea, nobr,
  keygen, embed, img, image, noscript, form,
  HtmlFont, input, hiddenInput, EmbedXml, // distinguished by attribute
  Heading, TBody, TCell, List, DListItem, Applet,
  Listing, AreaWbr, SubSup, DlQuote, EmbedHtml,
  OtherMeta, OtherVoid, OtherSpecial, OtherFmt, OtherRaw,
  OtherHtml, OtherForeign,

} = IntsOnto (classIds)


// log ('Min id:', DOCTYPE, 'Max id:', OtherForeign)

// There are (phew!) 63 equivalence classes. Boolean combinations
// (i.e. set-theoretic union and intersections) of the equivalnce
// classes can thus be represented as a bitvector (an int) of 64 bits.

const classVecs = {}
for (const k in classIds)
  classVecs[k] = 1n << BigInt (classIds[k])


// Equivalence class assignment
// ----------------------------

// Math namespace

const mathEqClasses = {
  mi:    EmbedHtml,
  mo:    EmbedHtml,
  mn:    EmbedHtml,
  ms:    EmbedHtml,
  mtext: EmbedHtml,
  'annotation-xml': EmbedXml, // depending on encoding attribute,
  svg:   svg // depending on EmbedXml context
  // #default: OtherForeign
}

// Svg namespace

const svgEqClasses = {
  foreignobject: EmbedHtml,
  title: EmbedHtml,
  desc: EmbedHtml,
  // #default: OtherForeign
}

// Breakout tags - these are always considered to be elements in the
// html namespace, also if they occur inside of svg and mathML.

const breakoutEqClasses = {

  b:       OtherFmt,
  big:     OtherFmt,
  code:    OtherFmt,
  em:      OtherFmt,
  i:       OtherFmt,
  s:       OtherFmt,
  small:   OtherFmt,
  strike:  OtherFmt,
  strong:  OtherFmt,
  tt:      OtherFmt,
  u:       OtherFmt,

  h1:      Heading,
  h2:      Heading,
  h3:      Heading,
  h4:      Heading,
  h5:      Heading,
  h6:      Heading,

  sub:     SubSup,
  sup:     SubSup,
  var:     SubSup,
  ruby:    SubSup,
  span:    SubSup,

  dl:      DlQuote,
  menu:    DlQuote,
  center:  DlQuote,
  blockquote: DlQuote,

  listing: Listing,
  pre:     Listing,

  dd:      DListItem,
  dt:      DListItem,

  ul:      List,
  ol:      List,

  font:    HtmlFont, // if it has a specialFontAttribute

  body:    body,
  br:      br,
  div:     div,
  embed:   embed,
  head:    head,
  hr:      hr,
  img:     img,
  li:      li,
  meta:    meta,
  nobr:    nobr,
  p:       p,
  table:   table
}

const _specialFontAttributes =
  { color:1, face:1, size:1 }

// Html namespace, consisting of
// the above, extended as follows,

const htmlEqClasses = Object.assign ({

  summary:    OtherSpecial,
  article:    OtherSpecial,
  aside:      OtherSpecial,
  details:    OtherSpecial,
  dialog:     OtherSpecial,
  dir:        OtherSpecial,
  fieldset:   OtherSpecial,
  figcaption: OtherSpecial,
  figure:     OtherSpecial,
  footer:     OtherSpecial,
  header:     OtherSpecial,
  hgroup:     OtherSpecial,
  main:       OtherSpecial,
  nav:        OtherSpecial,
  plaintext:  OtherSpecial,
  section:    OtherSpecial,

  base:       OtherMeta,
  basefont:   OtherMeta,
  bgsound:    OtherMeta,
  link:       OtherMeta,

  param:      OtherVoid,
  source:     OtherVoid,
  track:      OtherVoid,

  applet:     Applet,
  marquee:    Applet,
  object:     Applet,

  tbody:      TBody,
  tfoot:      TBody,
  thead:      TBody,

  td:         TCell,
  th:         TCell,

  area:       AreaWbr,
  wbr:        AreaWbr,

  iframe:     OtherRaw,
  noembed:    OtherRaw,

  col:        col,
  address:    address,
  form:       form,
  option:     option,
  frame:      frame,
  keygen:     keygen,
  style:      style,
  noframes:   noframes,
  html:       html,
  tr:         tr,
  button:     button,
  textarea:   textarea,
  caption:    caption,
  template:   template,
  xmp:        xmp,
  image:      image,
  math:       math,
  title:      title,
  select:     select,
  colgroup:   colgroup,
  a:          a,
  noscript:   noscript,
  svg:        svg,
  script:     script,
  optgroup:   optgroup,
  input:      input,
  frameset:   frameset,
  // #default: OtherHtml,
}, breakoutEqClasses)


// ### The eqClass function

function elementClass ({ name, attrs }, context = S.main) {

  // in math

  if (context & S.inMath) {
    const id = breakoutEqClasses [name]
      ?? mathEqClasses [name]
      ?? eq.OtherForeign // UUh! NB careful svg is reassigned

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
    const id = breakoutEqClasses [name]
      ?? svgEqClasses [name]
      ?? eq.OtherForeign

    if (id === eq.HtmlFont) {
      for (const name in attrs)
        if (name in _specialFontAttributes)
          return eq.HtmlFont;
      return eq.OtherForeign
    }
    return id
  }
  
  // In html

  const id = htmlEqClasses [name]
    ?? eq.OtherHtml

  if (id === eq.input && attrs && attrs.type && attrs.type.toLowerCase () === 'hidden')
    return eq.hiddenInput
  return id
}

// Kind returns the element class converted to a bitvector

function Kind (arg1, context) {
  return 1n << BigInt (elementClass (arg1, context))
}


// Printing
// --------

function printKind (info) {
  if (info === ~0n) return 'Any'
  if (info === 0n) return 'None'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in classVecs) if (classVecs [k] & _info) r.push (k)
  return `${info < 0n ? '~' : '' }` + (r.length === 1 ? r[0] : `(${r.join (' | ')})`)
}


// General
// -------

const None = 0n
const Any = -1n

const C = Object.assign ({}, classVecs)

C.Void =
  C.AreaWbr | C.input | C.keygen | C.embed | C.img | C.OtherMeta | C.meta |
  C.br | C.col | C.frame | C.hr | C.hiddenInput | C.OtherVoid 

C.RcDataElement =
 C.textarea | C.title

C.RawTextElement =
  C.style | C.script | C.xmp | C.noframes | C.OtherRaw

C.Formatting =
  C.a | C.nobr | C.HtmlFont | C.OtherFmt


// Formatting and Re-opening
// -------------------------

C.FormattingContext = 
  C.html | C.template | C.caption | C.table | C.TCell | C.Applet
  // Used by the parser to direct format tag reopening

C.Reformat =
  C.AreaWbr | C.input | C.keygen | C.Applet | C.OtherHtml | C.Formatting | C.select |
  C.optgroup | C.option | C.button | C.math | C.svg | C.br | C.xmp |  C.TEXT |
  C.SPACE,

C.FramesetOK =
  C.optgroup | C.option | C.div | C.address | C.p | C.Heading | C.List | C.Formatting |
  C.OtherVoid | C.DlQuote | C.OtherSpecial | C.form | C.OtherHtml | C.COMMENT | C.SPACE | C.DOCTYPE |
  C.html | C.head | C.body | C.svg | C.math | C.SubSup | C.hiddenInput | C.EmbedHtml | C.OtherForeign | C.EmbedXml |
  C.frame | C.frameset | C.noframes // last line, hack it


// Content sets
// ------------

// Breakout tags for svg, math, p and select elements

C.Breakout = 
  C.div | C.li | C.List | C.Heading | C.DListItem | C.DlQuote | C.Listing | C.p | 
  C.body | C.br | C.head | C.table | C.SubSup | C.meta |
  C.OtherFmt | C.nobr | C.embed | C.img | C.hr | C.HtmlFont

// Content sets

C.Meta = // goes into the <head>
  C.title | C.script | C.style | C.template | C.noscript | C.noframes | C.meta | C.OtherMeta

C.Tabular = // sectioning within <table>
  C.caption | C.colgroup | C.col | C.TBody | C.tr | C.TCell

C.Block = // Note: does not contain Object nor button (they are allowed in phrasing)
  C.div | C.li | C.List | C.Heading | C.DListItem | C.DlQuote | C.Listing | C.p | 
  C.address | C.OtherSpecial | C.xmp | C.form

C.Flow = // goes into <body>, <caption>, <td>, <object>, <div>, <ul>, block-elements alike
  ~ ( C.DOCTYPE | C.html | C.head | C.body | C.frameset | C.frame | C.Tabular | C.EmbedXml | C.EmbedHtml | C.OtherForeign )

C.Phrasing = // goes into <p> elements
  C.Flow &~ C.Block

C.Foreign =
  C.math | C.svg | C.EmbedXml | C.EmbedHtml | C.OtherForeign // | C.SPACE | C.TEXT | C.COMMENT

C.FosterParented =
  C.Flow &~ (C.table | C.Tabular | C.script | C.style | C.template | C.hiddenInput | C.COMMENT | C.SPACE | C.form)


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



log (C)


// Exports
// =======

export {
  classIds, classVecs, elementClass, Kind, printKind, 
  Any, None, C,
  S as states
}