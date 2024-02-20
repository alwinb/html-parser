const { assign } = Object
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
// tagNames, or to non-element node-types. There are also three cases where
// attributes are taken into account:
//
// * <input type=hidden> is distinguished from other <input> tags
// * <font> tags are distinguished by certain attributes
// * <annotation-xml> tags are distinguished by their encoding attribute
//
// NB this assignment distinguishes between elements in the html vs foreign
// namespaces, i.e. it is context dependent

const {
  DOCTYPE,
  COMMENT,
  TEXT,
  SPACE,

  Applet,
  AreaWbr,
  DListItem,
  DlQuote,
  EmbedHtml,
  EmbedXml,
  Heading,
  HtmlFont,
  List,
  Listing,
  OtherBlock,
  OtherFmt,
  OtherForeign,
  OtherHtml,
  OtherMeta,
  OtherRaw,
  OtherVoid,
  SubSup,
  TBody,
  TCell,

  a,
  address,
  body,
  br,
  button,
  caption,
  col,
  colgroup,
  div,
  embed,
  form,
  frame,
  frameset,
  head,
  hiddenInput,
  hr,
  html,
  image,
  img,
  input,
  keygen,
  li,
  math,
  meta,
  nobr,
  noframes,
  noscript,
  optgroup,
  option,
  p,
  script,
  select,
  style,
  svg,
  table,
  template,
  textarea,
  title,
  tr,
  xmp,

} = IntsOnto (classIds)


// Boolean combinations of node-equivalence classes
// -------------------------------------------------

// log ('Min id:', DOCTYPE, 'Max id:', xmp)

// There are (phew!) 64 equivalence classes. Boolean combinations
// (i.e. set-theoretic union and intersections) of the equivalence
// classes can thus be represented as a bitvector (an int) of 64 bits.

const ClassVecs = {}
for (const k in classIds)
  ClassVecs[k] = 1n << BigInt (classIds[k])

// printKind converts an element-equivalence-class-bitvector
// to a human readable string.

function printKind (info) {
  if (info === ~0n) return 'Any'
  if (info === 0n) return 'None'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in ClassVecs) if (ClassVecs [k] & _info) r.push (k)
  return `${info < 0n ? '~' : '' }` + (r.length === 1 ? r[0] : `(${r.join (' | ')})`)
}

// Boolean combinations;

const C = assign ({}, ClassVecs)

const None = 0n
const Any = -1n
const All = Any

C.RcDataElement
  = C.textarea
  | C.title

C.RawTextElement
  = C.OtherRaw
  | C.noframes
  | C.script
  | C.style
  | C.xmp

C.VoidElement
  = C.AreaWbr
  | C.OtherMeta
  | C.OtherVoid
  | C.br
  | C.col
  | C.embed
  | C.frame
  | C.hiddenInput
  | C.hr
  | C.image
  | C.img
  | C.input
  | C.keygen
  | C.meta

// Formatting Contexts
// Used by the parser to direct format tag reopening

C.FormattingContextElement
  = C.Applet
  | C.TCell
  | C.caption
  | C.html
  | C.table
  | C.template

C.FormattingElement
  = C.HtmlFont
  | C.OtherFmt
  | C.a
  | C.nobr

// Blocks alike

C.BreakoutElement
  = C.DListItem
  | C.DlQuote
  | C.FormattingElement &~ C.a
  | C.Heading
  | C.List
  | C.Listing
  | C.SubSup
  | C.body
  | C.br
  | C.div
  | C.embed
  | C.head
  | C.hr
  | C.image
  | C.img
  | C.li
  | C.meta
  | C.p
  | C.table

C.ForeignElement
  = C.EmbedHtml     // => R.inEmbedHtml
  | C.EmbedXml      // => R.inEmbeddedXml
  | C.OtherForeign  // => R.otherInForeign
  | C.math          // => R.inMath
  | C.svg           // => R.inSvg

C.TableSectioning // sectioning within <table>
  = C.TBody
  | C.TCell
  | C.caption
  | C.col
  | C.colgroup
  | C.tr

C.Meta // goes into the <head>
  = C.OtherMeta
  | C.meta
  | C.noframes
  | C.noscript
  | C.script
  | C.style
  | C.template
  | C.title

C.FlowNonContent
  = C.DOCTYPE 
  | C.EmbedHtml 
  | C.EmbedXml 
  | C.TableSectioning 
  | C.OtherForeign
  | C.body 
  | C.frame 
  | C.frameset 
  | C.head 
  | C.html

C.FlowContent // goes into <body>, <caption>, <td>, <object>, <div>, <ul>, block-elements alike
  = ~C.FlowNonContent

C.selectContent
  = C.COMMENT
  | C.SPACE 
  | C.TEXT 
  | C.hr
  | C.optgroup 
  | C.option 
  | C.script
  | C.template

C.SpecialBlockElement // Block alikes not allowed in phrasing
  = C.DListItem
  | C.DlQuote
  | C.Heading
  | C.List
  | C.Listing
  | C.OtherBlock
  | C.address
  | C.div
  | C.form
  | C.li
  | C.p
  | C.xmp
  // C.Applet // is excluded as it is allowed in Phrasing
  // C.button // likewise
  // C.table  // likewise

C.PhrasingContent = // goes into <p> elements
  C.FlowContent &~ C.SpecialBlockElement

C.FosterParentedContent = // is this even necessary?
  C.FlowContent &~ (C.table | C.TableSectioning | C.script | C.style | C.template | C.hiddenInput | C.COMMENT | C.SPACE | C.form)

C.ForeignElement
  = C.EmbedHtml
  | C.EmbedXml
  | C.OtherForeign
  | C.math
  | C.svg

C.Reformat
  = C.Applet
  | C.AreaWbr
  | C.FormattingElement
  | C.OtherHtml
  | C.SPACE
  | C.TEXT
  | C.br
  | C.button
  | C.input
  | C.keygen
  | C.math
  | C.optgroup
  | C.option
  | C.select
  | C.svg
  | C.xmp

C.FramesetOK
  = C.COMMENT
  | C.DOCTYPE
  | C.DlQuote
  | C.EmbedHtml
  | C.EmbedXml
  | C.FormattingElement
  | C.Heading
  | C.List
  | C.OtherBlock
  | C.OtherForeign
  | C.OtherHtml
  | C.OtherVoid
  | C.SPACE
  | C.SubSup
  | C.address
  | C.body
  | C.div
  | C.form
  | C.head
  | C.hiddenInput
  | C.html
  | C.math
  | C.optgroup
  | C.option
  | C.p
  | C.svg
  | C.frame | C.frameset | C.noframes // last line, hack it


// C.NonNestable
//   = C.DListItem
//   | C.Heading
//   | C.TBody
//   | C.TCell
//   | C.a
//   | C.button
//   | C.li
//   | C.nobr
//   | C.option
//   | C.p
//   | C.table
//   | C.tr
//
// C.Nestable
//   = ~C.NonNestable

const _unclosable
  = C.COMMENT
  | C.DOCTYPE
  | C.SPACE
  | C.TEXT
  | C.RawTextElement
  | C.RcDataElement
  | C.VoidElement
  | C.body
  | C.html


// Rules
// -----
// Rules declare
// * properties:
//   namespace, content, pathsFor, paths, trap, 
//   namespace and content are inherited if absent,
//   pathsFor and paths are reset if absent.
// * modifiers:
//   closableAncestors, clearContext, escalate

// S: Namespaces (flags, so namespaceSet, actually)
//  Temporary, this is being reworked

const S = {
  html:   1 << 0,
  inSvg:  1 << 1,
  inMath: 1 << 2,
}

// Content model bases

function FlowContainer (initfn) {
  const r = {
    clearContext: C.Heading | C.li | C.option | C.DListItem,
    // NB form and p are in SpecialBlockElement, button and applet are not (but form and p are)
    closableAncestors: C.table | C.TableSectioning | C.button | C.Applet | C.SpecialBlockElement &~ (C.form | C.p),
    escalate: C.frameset | C.TableSectioning,
    content:  C.FlowContent,
  }
  return initfn ? (initfn (r), r) : r
}

function TransparentContentModel (initfn) {
  const r = {
    clearContext: None,
    closableAncestors: ~(C.ForeignElement | C.html | C.body),
    escalate: C.frameset | C.TableSectioning,
    content: C.FlowContent,
  }
  return initfn ? (initfn (r), r) : r
}


//

const Rules = {

  fragmentRule: { // TODO
    closableAncestors: None,
    namespace: S.html,
    content: Any,
  },

  documentRule: {
    namespace: S.html,
    closableAncestors: None,
    content: C.html | C.COMMENT | C.DOCTYPE,
    pathsFor: ~(C.SPACE | C.DOCTYPE | C.TableSectioning),
    paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHtml: {
    content: C.html | C.COMMENT,
    closableAncestors: None,
    pathsFor: ~(C.SPACE | C.DOCTYPE | C.TableSectioning),
      paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHead: {
    content: C.head | C.COMMENT,
    closableAncestors: C.html,
    pathsFor: ~(C.SPACE | C.DOCTYPE | C.TableSectioning | C.html),
      paths: { '#default':'head' },
    siblingRules: true,
  },

  inHead: {
    closableAncestors: C.html | C.head,
    escalate: C.FlowContent | C.body | C.frameset,
    content: C.Meta | C.SPACE | C.COMMENT,
  },

  afterHead: {
    closableAncestors: C.html,
    content:  C.body | C.frameset | C.COMMENT | C.SPACE, 
    pathsFor: ~(C.Meta &~ C.noscript | C.frame | C.frameset | C.SPACE | C.DOCTYPE | C.TableSectioning | C.html | C.head), 
      paths: { '#default':'body' },
    trap: C.Meta &~ C.noscript,
    // trap: C.SPACE,
    siblingRules: true,
  },

  inBody: {
    closableAncestors: C.html | C.body,
    content: C.FlowContent,
    trap: C.frameset
  },

  inFrameset: {
    closableAncestors: C.html | C.body | C.frameset,
    content: C.frameset | C.frame | C.noframes | C.SPACE | C.COMMENT,
  },

  // ### Table Rules

  inTable: {
    closableAncestors: None,
    content: C.caption | C.colgroup | C.TBody | C.script | C.template | C.style | C.hiddenInput | C.SPACE | C.COMMENT | C.form,
    pathsFor: C.col | C.tr | C.TCell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    trap: C.FosterParentedContent,
  },

  inColgroup: {
    closableAncestors: C.table,
    escalate: C.TableSectioning | C.FlowContent,
    content:  C.col | C.template | C.SPACE | C.COMMENT,
    trap: None,
  },

// C.TableSectioning ==  C.caption | C.colgroup | C.col | C.TBody | C.tr | C.TCell

  inTableBody: {
    closableAncestors: C.table,
    escalate: C.caption | C.colgroup | C.col,
    content: C.tr | C.script | C.template | C.style | C.hiddenInput | C.SPACE | C.COMMENT | C.form,
    pathsFor: C.TCell,
      paths: { td:'tr', th:'tr' },
    trap: C.FosterParentedContent,
  },

  inTableRow: {
    closableAncestors: C.table | C.TBody,
    escalate: C.caption | C.colgroup | C.col,
    content: C.TCell | C.script | C.style | C.template | C.hiddenInput | C.SPACE | C.COMMENT,
    trap: C.FosterParentedContent,
  },

  // ### Select Rules

  inSelect: {
    clearContext: C.option,
    closableAncestors: C.table | C.caption | C.TBody | C.tr | C.TCell,
    escalate: C.input | C.keygen | C.textarea | C.caption | C.TBody | C.tr | C.TCell,
    content: C.selectContent
  },

  // As above, only add C.table to escalate
  inSelectInTable: {
    clearContext: C.option,
    closableAncestors: C.table | C.caption | C.TBody | C.tr | C.TCell,
    escalate: C.input | C.keygen | C.textarea | C.caption | C.TBody | C.tr | C.TCell | C.table,
    content: C.selectContent
  },

  optgroupInSelect: {
    closableAncestors: C.table | C.caption | C.TBody | C.tr | C.TCell | C.select,
    escalate: C.caption | C.tr | C.TBody | C.TCell | C.optgroup | C.hr,
    content: C.option | C.script | C.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optionInSelect: {
    closableAncestors: C.table | C.caption | C.TBody | C.tr | C.TCell | C.select | C.optgroup,
    escalate: C.caption | C.tr | C.TBody | C.TCell | C.optgroup | C.option | C.hr,
    content: C.script | C.template | C.TEXT | C.SPACE | C.COMMENT,
  },


  // ### Flow containers

  // NB the system is set up such that elements cannot unclosable themselves for nesting,
  // this is relevant for h1-h6 elements -> inOtherBlock.

  inCaption: new FlowContainer (self => {
    self.clearContext = C.table
    self.closableAncestors = C.table
  }),

  inTableCell: new FlowContainer (self => {
    self.clearContext = C.table
    self.closableAncestors = C.table | C.tr | C.TBody
  }),

  inApplet: new FlowContainer (self => { // applet, object, marquee
    self.clearContext |= C.button
    self.closableAncestors &=~ (C.SpecialBlockElement | C.Applet)
  }),

  inList: new FlowContainer (self => {
    self.closableAncestors &=~ C.li // prevent implicitly closing parent <li> items.
  }),

  inListItem: new FlowContainer (self => {
    self.closableAncestors |= C.form
  }),

  inDListItem: new FlowContainer (self => {
    // self.unclosable = self.unclosable &~ C.form
    self.closableAncestors |= C.form
  }),

  inDivAddress: new FlowContainer (self => {
    self.clearContext &= ~(C.li | C.DListItem)
  }),

  inOtherBlock: new FlowContainer (), // Other special block except address, div

  inEmbedHtml: new FlowContainer (self => {
    self.namespace = S.html,
    self.closableAncestors = C.ForeignElement | C.table | C.TableSectioning,
    // NB. note that most all other rules disallow closing svg and OtherForeign elements!
    self.allowAutoClose = true
  }),


  // ### Phrasing Container

  inPhrasing: {
    clearContext: C.option,
    closableAncestors: C.table | C.TableSectioning | C.button | C.Applet | C.SpecialBlockElement | C.form,
    escalate: C.frameset | C.TableSectioning | C.SpecialBlockElement,
    content: C.PhrasingContent
  },

  // ### Transparent content model in Flow / Phrasing
  // (Defaults content to flowContent)

  optionInFlow: new TransparentContentModel (self => {
    self.clearContext |= C.Heading
    self.escalate |= C.optgroup
    self.content &=~ C.optgroup
  }),

  optionInPhrasing: new TransparentContentModel (self => {
    self.escalate |= (C.SpecialBlockElement | C.optgroup)
    self.content &=~ (C.SpecialBlockElement | C.optgroup)
  }),

  optgroupInFlow: new TransparentContentModel (self => {
    self.clearContext |= C.Heading
  }),
  
  optgroupInPhrasing: new TransparentContentModel (self => {
    self.escalate |= C.SpecialBlockElement
    self.content &=~ C.SpecialBlockElement
  }),

  otherInFlow: new TransparentContentModel (self => {
    self.clearContext |= C.Heading | C.option
    self.closableAncestors &=~ C.form
  }),

  otherInPhrasing: new TransparentContentModel (self => {
    self.clearContext |= C.option
    self.escalate |= C.SpecialBlockElement
    self.content &=~ C.SpecialBlockElement
  }),

  // ### Rawtext and RCData content

  inData: {
    content: C.SPACE | C.TEXT,
    escalate: All,
  },

  // ### ForeignElement Content Rules

  inSvg: {
    namespace: S.inSvg,
    closableAncestors: ~C.form,
    escalate: C.BreakoutElement,
    content: C.ForeignElement | C.SPACE | C.TEXT | C.COMMENT,
    allowAutoClose: true
  },

  inMath: {
    namespace: S.inMath,
    closableAncestors: ~C.form,
    escalate: C.BreakoutElement,
    content: C.ForeignElement | C.SPACE | C.TEXT | C.COMMENT,
    allowAutoClose: true
  },

  // ### XML Container 
  // TODO this would be math namespace, but it does need a separate rule 
  // for svg -> inSvg
  //
  // inEmbeddedXml: {
  //   namespace: S.inMath,
  //   closableAncestors: ~C.form,
  //   escalate: C.BreakoutElement,
  //   content: C.ForeignElement | C.SPACE | C.TEXT | C.COMMENT,
  //   allowAutoClose: true
  // },

  // ### After* rules

  afterBody: {
    // This should never be reached,
    //  the body tag should never be closed.
    closableAncestors: None,
  },

  afterFrameset: {
    closableAncestors: None,
    content: C.noframes | C.SPACE | C.COMMENT
  },

  afterHtmlAfterBody: {
    // This should never be reached,
    //  the html tag should never be closed.
    closableAncestors: None,
    content: None,
  },

  afterHtmlAfterFrameset: {
    closableAncestors: None,
    content: C.COMMENT,
  },

  voidRule: {},
}

///

class Rule {

  constructor (r, name = r.name) {
    this.name      = name
    this.namespace = r.namespace ?? 0 // 0 indicates 'inherit'
    this.clearContext = (r.clearContext ?? None)
    this.closableAncestors = (r.closableAncestors ?? All) & ~_unclosable
      // adding void / rc / raw is an optimisation
    this.escalate  = r.escalate ?? None
    this.content   = (r.content ?? None) | (r.trap ?? None)
    this.trap      = r.trap     ?? None
    this.pathsFor  = (r.pathsFor ?? None) &~ this.content // NB overlap
    this.paths     = r.paths    ?? null
    this.siblingRules = r.siblingRules ?? false
    this.allowAutoClose = r.allowAutoClose ?? false
    // this.viz ()
  }

  get info () {
    const info = assign ({}, this)
    for (let k in info) if (typeof info [k] === 'bigint')
      info [k] = printKind (info [k])
    return info
  }

  //*
  viz () {
    // precompile...
    let opens = '<table style="border-collapse:collapse;display:inline-table">'
    let closes = '<table style="border-collapse:collapse;display:inline-table">'
    let nests = '<table style="border-collapse:collapse;display:inline-table">'
    const actions = [], names = []
    for (let i=0; i<64; i++) {
      const x = 1n<<BigInt (i)
      const n = printKind (x)
      const h = `<td title=${n}>${this.closableAncestors & x ? '⇧' : '🈲'}</td>`;
      const hn = `<td title=${n}>${this.clearContext & x ? '⬛️' : '◽️'}</td>`;
      const a = 
        this.trap     & x ? `<td title=${n}>⚠️</td>` : 
        this.content  & x ? `<td title=${n}>✅</td>` : 
        this.pathsFor & x ? `<td title=${n}>▶️</td>` : 
        this.escalate & x ? `<td title=${n}>⇧</td>` : 
        `<td title=${n}>🈲</td>`
      if (i%8===0) { opens += '<tr>'; closes += '<tr>'; nests += '<tr>' }
      opens += a
      closes += h
      nests += hn
    }
    opens += '</table>'
    closes += '</table>'
    nests += '</table>'
    log (this.name ? `<h4 style=margin-bottom:0>${this.name}</h4><div>` : this, '<br>', opens, nests, closes, '</div>')
    if (typeof process !== 'undefined') process.exitCode = 205
    return this
  } //*/

}

// Compile the rules
for (const k in Rules)
  Rules[k] = new Rule (Rules[k], k)


// Rule assignment
// ---------------

// Breakout tags - these are always considered to be elements in the
// html namespace, also if they occur inside of svg and mathML.

const R = Rules
const breakoutRules = {

  b:       [ OtherFmt, R.otherInFlow ],
  big:     [ OtherFmt, R.otherInFlow ],
  code:    [ OtherFmt, R.otherInFlow ],
  em:      [ OtherFmt, R.otherInFlow ],
  i:       [ OtherFmt, R.otherInFlow ],
  s:       [ OtherFmt, R.otherInFlow ],
  small:   [ OtherFmt, R.otherInFlow ],
  strike:  [ OtherFmt, R.otherInFlow ],
  strong:  [ OtherFmt, R.otherInFlow ],
  tt:      [ OtherFmt, R.otherInFlow ],
  u:       [ OtherFmt, R.otherInFlow ],

  sub:     [ SubSup, R.otherInFlow ],
  sup:     [ SubSup, R.otherInFlow ],
  var:     [ SubSup, R.otherInFlow ],
  ruby:    [ SubSup, R.otherInFlow ],
  span:    [ SubSup, R.otherInFlow ],

  h1:      [ Heading, R.inOtherBlock ],
  h2:      [ Heading, R.inOtherBlock ],
  h3:      [ Heading, R.inOtherBlock ],
  h4:      [ Heading, R.inOtherBlock ],
  h5:      [ Heading, R.inOtherBlock ],
  h6:      [ Heading, R.inOtherBlock ],

  dl:      [ DlQuote, R.inOtherBlock ],
  menu:    [ DlQuote, R.inOtherBlock ],
  center:  [ DlQuote, R.inOtherBlock ],
  blockquote: [ DlQuote, R.inOtherBlock ],

  listing: [ Listing, R.inOtherBlock ],
  pre:     [ Listing, R.inOtherBlock ],

  dd:      [ DListItem, R.inDListItem ],
  dt:      [ DListItem, R.inDListItem ],

  ul:      [ List, R.inList],
  ol:      [ List, R.inList],

  font:    [ HtmlFont, R.otherInFlow ], // if font has a specialFontAttribute

  br:      [ br,    R.voidRule ],
  hr:      [ hr,    R.voidRule ],
  img:     [ img,   R.voidRule ],
  meta:    [ meta,  R.voidRule ],
  embed:   [ embed, R.voidRule ],

  body:    [ body,  R.inBody],
  head:    [ head,  R.inHead ],
  div:     [ div,   R.inDivAddress ],
  table:   [ table, R.inTable ],
  li:      [ li,    R.inListItem ],
  nobr:    [ nobr,  R.otherInFlow ],
  p:       [ p,     R.inPhrasing ],
}

function hasSpecialFontAttribute ({ attrs }) {
  for (const name in attrs) {
    if (name.length === 5 && name === 'color') return true
    if (name.length === 4 && (name === 'face' || name === 'size')) return true
  }
  return false
}

function hasTypeHiddenAttribute ({ attrs }) {
  return attrs && attrs.type && lowercaseEquiv (attrs.type, 'hidden')
}

function lowercaseEquiv (s1, s2) {
  const len = s1.length
  let r = len === s2.length
  for (let i=0; r && i<len; i++)
    r = (s1.charCodeAt(i) | 32) === (s2.charCodeAt(i) | 32)
  return r
}

// Html namespace, consisting of
// the above, extended as follows,

const htmlRules = assign ({

  html:       [ html,     R.beforeHead   ],
  svg:        [ svg,      R.inSvg        ],
  math:       [ math,     R.inMath       ],
  frameset:   [ frameset, R.inFrameset   ],
  template:   [ template, R.fragmentRule ],

  // Tabe contexts

  caption:    [ caption,  R.inCaption   ],
  colgroup:   [ colgroup, R.inColgroup  ],
  thead:      [ TBody,    R.inTableBody ],
  tbody:      [ TBody,    R.inTableBody ],
  tfoot:      [ TBody,    R.inTableBody ],
  tr:         [ tr,       R.inTableRow  ],
  td:         [ TCell,    R.inTableCell ],
  th:         [ TCell,    R.inTableCell ],

  // Blocks

  applet:     [ Applet, R.inApplet ],
  marquee:    [ Applet, R.inApplet ],
  object:     [ Applet, R.inApplet ],

  article:    [ OtherBlock, R.inOtherBlock ],
  aside:      [ OtherBlock, R.inOtherBlock ],
  details:    [ OtherBlock, R.inOtherBlock ],
  dialog:     [ OtherBlock, R.inOtherBlock ],
  dir:        [ OtherBlock, R.inOtherBlock ],
  fieldset:   [ OtherBlock, R.inOtherBlock ],
  figcaption: [ OtherBlock, R.inOtherBlock ],
  figure:     [ OtherBlock, R.inOtherBlock ],
  footer:     [ OtherBlock, R.inOtherBlock ],
  header:     [ OtherBlock, R.inOtherBlock ],
  hgroup:     [ OtherBlock, R.inOtherBlock ],
  main:       [ OtherBlock, R.inOtherBlock ],
  nav:        [ OtherBlock, R.inOtherBlock ],
  plaintext:  [ OtherBlock, R.inOtherBlock ],
  section:    [ OtherBlock, R.inOtherBlock ],
  summary:    [ OtherBlock, R.inOtherBlock ],

  address:    [ address, R.inDivAddress ],
  button:     [ button,  R.inOtherBlock ],
  form:       [ form,    R.inOtherBlock ],

  // Rawtext and RCData elements

  iframe:     [ OtherRaw,   R.inData ],
  noembed:    [ OtherRaw,   R.inData ],
  noframes:   [ noframes,   R.inData ],
  script:     [ script,     R.inData ],
  style:      [ style,      R.inData ],
  textarea:   [ textarea,   R.inData ],
  xmp:        [ xmp,        R.inData ],
  title:      [ title,      R.inData ],

  // Void elements

  area:       [ AreaWbr,   R.voidRule ],
  wbr:        [ AreaWbr,   R.voidRule ],

  base:       [ OtherMeta, R.voidRule ],
  basefont:   [ OtherMeta, R.voidRule ],
  bgsound:    [ OtherMeta, R.voidRule ],
  link:       [ OtherMeta, R.voidRule ],

  param:      [ OtherVoid, R.voidRule ],
  source:     [ OtherVoid, R.voidRule ],
  track:      [ OtherVoid, R.voidRule ],

  col:        [ col,       R.voidRule ],
  frame:      [ frame,     R.voidRule ],
  image:      [ image,     R.voidRule ],
  input:      [ input,     R.voidRule ],
  keygen:     [ keygen,    R.voidRule ],

  // Other

  select:     [ select,    R.inSelect ],       // alt secctInTableInPhrasing selectInTable
  optgroup:   [ optgroup,  R.optgroupInFlow ], // alt R.optgroupInSelect, R.optgroupInPhrasing 
  option:     [ option,    R.optionInFlow   ], // alt R.optionInSelect, R.optionInPhrasing 
  a:          [ a,         R.otherInFlow    ], // alt R.otherInPhrasing
  noscript:   [ noscript,  R.otherInFlow    ], // alt R.otherInPhrasing
  '#default': [ OtherHtml, R.otherInFlow    ], // alt R.otherInPhrasing

}, breakoutRules)



// NB does not reassign the id
const phrasingRules = assign ({}, htmlRules)
assign (phrasingRules, {
  option:     [ option,    R.optionInPhrasing ],
  optgroup:   [ optgroup,  R.optgroupInPhrasing ],
  a:          [ a,         R.otherInPhrasing ],
  noscript:   [ noscript,  R.otherInPhrasing ],
  '#default': [ OtherHtml, R.otherInPhrasing ],
})


// Math namespace

const mathRules = assign ({
  mi:    [ EmbedHtml, R.inEmbedHtml ],
  mo:    [ EmbedHtml, R.inEmbedHtml ],
  mn:    [ EmbedHtml, R.inEmbedHtml ],
  ms:    [ EmbedHtml, R.inEmbedHtml ],
  mtext: [ EmbedHtml, R.inEmbedHtml ],
  svg:   [ svg, R.inSvg ],                  // depending on EmbedXml context
  'annotation-xml': [ EmbedXml, R.inMath ], // depending on encoding attribute,
  '#default': [ OtherForeign, R.inMath ],

}, breakoutRules)

// Svg namespace

const svgRules = assign ({
  foreignobject: [ EmbedHtml, R.inEmbedHtml ],
  title:         [ EmbedHtml, R.inEmbedHtml ],
  desc:          [ EmbedHtml, R.inEmbedHtml ],
  '#default':    [ OtherForeign, R.inSvg ]

}, breakoutRules)


// ### The eqClass function

function childRule ({ name, attrs }, { id:parent, namespace=S.html, closableAncestors } = { }) {
  if (namespace & S.inMath) {
    const rule = (mathRules [name] ?? mathRules ['#default'])

    if (rule[0] === eq.HtmlFont)
      return hasSpecialFontAttribute ({attrs}) ? rule : eq.OtherForeign

    else if (rule[0] === eq.svg && parent !== eq.EmbedXml)
      return mathRules ['#default']

    else if (rule[0] === eq.EmbedXml && attrs && attrs.encoding) {
      const v = attrs.encoding
      if (lowercaseEquiv (v, 'text/html')
        || lowercaseEquiv (v, 'application/xhtml+xml'))
        return [eq.EmbedHtml, R.inEmbedHtml ]
    }
    return rule
  }
  
  // in svg

  else if (namespace & S.inSvg) {
    const rule = svgRules [name] ?? svgRules ['#default']
    return rule[0] === eq.HtmlFont && !hasSpecialFontAttribute ({attrs}) ?
      svgRules ['#default'] : rule;
  }

  const ruleset
    = closableAncestors & C.p
    ? phrasingRules
    : htmlRules

  const rule = ruleset [name] ?? ruleset ['#default']
  // log (name, rule)

  switch (rule[0]) {
    case eq.input:
      return hasTypeHiddenAttribute ({attrs}) ?
        [eq.hiddenInput, R.voidRule] : rule

    case eq.select:
      return closableAncestors & C.table ?
        [select, R.inSelectInTable] : htmlRules.select

    case eq.option:
      return closableAncestors & C.select ?
        [ option, R.optionInSelect ] : rule

    case eq.optgroup:
      return closableAncestors & C.select ?
       [ optgroup,  R.optgroupInSelect ] : rule

    default:
      return rule
  }

}


function siblingRule ({ id:parentId, children }, name, id, _allOpened) {
  // children is the  union of eq-classes of the child nodes
  if (parentId === -1) // '#document'
    return children & C.html
      ? (_allOpened & C.frameset ? R.afterHtmlAfterFrameset : R.afterHtmlAfterBody)
      : children & C.DOCTYPE ? R.beforeHtml : R.beforeDoctype

  if (parentId === html)
    return children & C.frameset ? R.afterFrameset
      : children & C.body ? R.afterBody
      : children & C.head ? R.afterHead : R.beforeHead

  return null // NB signals 'no update' which at the moment is different from the empty rule!
}

// Exports
// =======

const { documentRule, fragmentRule } = R

export {
  classIds, printKind,
  Any, None, C,
  // ---
  S as namespaces, Rules,
  breakoutRules, htmlRules, svgRules, mathRules,
  documentRule, fragmentRule, childRule, siblingRule
}