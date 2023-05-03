import { C, classVecs as eq, classIds as c, states as S, Any, None, printKind } from './categories.js'
const All = Any
const log = console.log.bind (console)


// Rules
// =====

const hideInFlow = 
   ~(C.table | C.Tabular | C.button | C.Applet | C.Block /*| C.OtherFmt*/) | C.form | C.p
   // form and p are in Block, button and object are not

const Rules = {

  fragmentRule: { // TODO
    hide: All,
    state: S.main,
    content: Any,
  },

  documentRule: {
    state: S.main,
    hide: All,
    content: C.html | C.COMMENT | C.DOCTYPE,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
    paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHtml: {
    content: C.html | C.COMMENT,
    hide: All,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
      paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHead: {
    content: C.head | C.COMMENT,
    hide: ~C.html,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular | C.html),
      paths: { '#default':'head' },
    siblingRules: true,
  },

  inHead: {
    hide: ~(C.html | C.head),
    escalate: C.Flow | C.body | C.frameset,
    content: C.Meta | C.SPACE | C.COMMENT,
  },

  afterHead: {
    hide: ~C.html,
    content:  C.body | C.frameset | C.COMMENT | C.SPACE, 
    openFor: ~(C.Meta &~ C.noscript | C.frame | C.frameset | C.SPACE | C.DOCTYPE | C.Tabular | C.html | C.head), 
      paths: { '#default':'body' },
    trap: C.Meta &~ C.noscript,
    // trap: C.SPACE,
    siblingRules: true,
  },

  inBody: {
    hide: ~(C.html | C.body),
    content: C.Flow,
    trap: C.frameset
  },

  inFrameset: {
    hide: ~(C.html | C.body | C.frameset),
    content: C.frameset | C.frame | C.noframes | C.SPACE | C.COMMENT,
  },


  // ### Table Rules

  inTable: {
    state: S.inTable,
    hide: All,
    content: C.caption | C.colgroup | C.TBody | C.script | C.template | C.style | C.hiddenInput | C.SPACE | C.COMMENT | C.form,
    openFor: C.col | C.tr | C.TCell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    trap: C.FosterParented,
  },

  inColgroup: {
    hide: ~C.table,
    escalate: C.Tabular | C.Flow,
    content:  C.col | C.template | C.SPACE | C.COMMENT,
    trap: None,
  },

  inTableBody: {
    hide: ~C.table,
    escalate: C.Tabular &~ (C.tr | C.TCell),
    content: C.tr | C.script | C.template | C.style | C.hiddenInput | C.SPACE | C.COMMENT | C.form,
    openFor: C.TCell,
      paths: { td:'tr', th:'tr' },
    trap: C.FosterParented,
  },

  inTableRow: {
    hide: ~(C.table | C.TBody),
    escalate: C.Tabular &~ C.TCell,
    content: C.TCell | C.script | C.style | C.template | C.hiddenInput | C.SPACE | C.COMMENT,
    trap: C.FosterParented,
  },


  // ### Select Rules

  inSelect: {
    hidenest: C.option,
    state: S.inSelect | S.main,
    hide: ~(C.table | C.caption | C.TBody | C.tr | C.TCell),
    escalate: C.input | C.keygen | C.textarea | C.caption | C.TBody | C.tr | C.TCell,
    content: C.option | C.optgroup | C.script | C.template | C.TEXT | C.SPACE | C.COMMENT,
  },

    // As above, only add C.table to escalate
  inSelectInTable: {
    hidenest: C.option,
    state: S.inSelect | S.main,
    hide: ~(C.table | C.caption | C.TBody | C.tr | C.TCell),
    escalate: C.input | C.keygen | C.textarea | C.caption | C.TBody | C.tr | C.TCell | C.table,
    content: C.option | C.optgroup | C.script | C.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optgroupInSelect: {
    hide: ~(C.table | C.caption | C.TBody | C.tr | C.TCell | C.select),
    escalate: C.caption | C.tr | C.TBody | C.TCell | C.optgroup,
    content: C.option | C.script | C.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optionInSelect: {
    hide: ~(C.table | C.caption | C.TBody | C.tr | C.TCell | C.select | C.optgroup),
    escalate: C.caption | C.tr | C.TBody | C.TCell | C.optgroup | C.option,
    content: C.script | C.template | C.TEXT | C.SPACE | C.COMMENT,
  },


  // ### Flow containers

  inCaption: {
    hidenest: C.table,
    hide:     ~C.table,
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inTableCell: {
    hidenest: C.table,
    hide:     ~(C.table | C.tr | C.TBody),
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inObject: { // applet, object, marquee
    hidenest: C.li | C.DListItem | C.Heading | C.option | C.button,
    hide:     hideInFlow | C.Block | C.Applet,
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inList: {
    hidenest: C.li | C.DListItem | C.Heading | C.option,
    hide:     hideInFlow | C.li,
    escalate: C.frameset | C.Tabular,
    content:  C.Flow,
  },

  inListItem: {
    hidenest: C.DListItem | C.Heading | C.option,
    hide:     hideInFlow &~ C.form,
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inDListItem: {
    hidenest: C.li | C.Heading | C.option,
    hide:     hideInFlow &~ C.form,
    escalate: C.frameset | C.Tabular,
    content:  C.Flow,
  },

  inDivAddress: {
    hidenest: C.Heading | C.option,
    hide:     hideInFlow,
    escalate: C.frameset | C.Tabular,
    content:  C.Flow,
  },

  // NB the system is set up such that elements cannot hide themselves for nesting,
  // this is relevant for h1-h6 elements -> inOtherBlock

  inOtherBlock: { // other special block except address, div
    hidenest: C.li | C.DListItem | C.Heading | C.option,
    hide:     hideInFlow,
    escalate: C.frameset | C.Tabular,
    content:  C.Flow,
  },

  inEmbeddedHtml: {
    state: S.main,
    hidenest: C.li | C.DListItem | C.Heading | C.option,
    hide: ~(C.svg | C.math | C.table | C.Tabular), // NB. note that most all other rules disallow closing svg elements!
    escalate: C.frameset | C.Tabular,
    content: C.Flow,
  },

  // ### Transparant content model in Flow

  optionInFlow: {
    hidenest: C.Heading,
    hide: C.Foreign | C.html | C.body,
    escalate: C.frameset | C.Tabular | C.optgroup,
    content: C.Flow &~ C.optgroup,
  },

  optgroupInFlow: { // otherInFlow but not hiding C.form
    hidenest: C.Heading,
    hide: C.Foreign | C.html | C.body,
    escalate: C.frameset | C.Tabular,
    content: C.Flow,
  },

  otherInFlow: {
    hidenest: C.Heading | C.option,
    hide: C.Foreign | C.html | C.body | C.form,
    escalate: C.frameset | C.Tabular,
    content: C.Flow
  },

  // ### Phrasing Container

  inPhrasing: {
    hidenest: C.option,
    state: S.main | S.inPhrasing,
    hide: ~(C.table | C.Tabular | C.button | C.Applet | C.Block) | C.form,
    escalate: C.frameset | C.Tabular | C.Block,
    content: C.Phrasing
  },

  // ### Transparant content model in Phrasing

  optionInPhrasing: {
    state: S.main | S.inPhrasing,
    hide: C.Foreign | C.html | C.body,
    escalate: C.frameset | C.Tabular | C.optgroup | C.Heading | C.Block,
    content: C.Phrasing &~ C.optgroup,
  },

  optgroupInPhrasing: {
    hidenest: C.Heading,
    hide: C.Foreign | C.html | C.body,
    escalate: C.frameset | C.Tabular | C.Block,
    content: C.Phrasing,
  },

  otherInPhrasing: {
    hidenest: C.option,
    state: S.main | S.inPhrasing,
    hide: C.Foreign | C.html | C.body | C.form,
    escalate: C.frameset | C.Tabular | C.Block,
    content: C.Phrasing
  },

  // ### Rawtext and RCData content

  inData: {
    content: C.SPACE | C.TEXT,
    escalate: All,
  },

  // ### Foreign Content Rules

  inSvg: {
    state: S.inSvg,
    hide: C.form,
    escalate: C.frameset | C.Tabular | C.Breakout, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },

  inMath: {
    state: S.inMath,
    hide: C.form,
    escalate: C.frameset | C.Tabular | C.Breakout, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },

  otherInForeign: {
    hide: C.form,
    escalate: C.frameset | C.Tabular | C.Breakout, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },

  // ### XML Container 

  inEmbeddedXml: {
    state: S.main | S.inMath | S.inSvg, // REVIEW
    escalate: C.Breakout | C.frameset, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },


  // ### After* rules

  afterBody: {
    // This should never be reached,
    //  the body tag should never be closed.
    hide: All,
  },

  afterFrameset: {
    hide: All,
    content: C.noframes | C.SPACE | C.COMMENT
  },

  afterHtmlAfterBody: {
    // This should never be reached,
    //  the html tag should never be closed.
    hide: All,
    content: None,
  },

  afterHtmlAfterFrameset: {
    hide: All,
    content: C.COMMENT,
  },

}

for (const k in Rules)
  Rules[k].name = k


// Ruleset
// =======

const R = Rules
const r = []; {

  r [c.html]      = R.beforeHead
  r [c.math]      = R.inMath
  r [c.svg]       = R.inSvg

  r [c.head]      = R.inHead
  r [c.frameset]  = R.inFrameset
  r [c.template]  = R.fragmentRule

  r [c.table]     = R.inTable
  r [c.colgroup]  = R.inColgroup
  r [c.TBody]     = R.inTableBody
  r [c.tr]        = R.inTableRow

  // Flow containers

  r [c.body]      = R.inBody
  r [c.Applet]    = R.inObject
  r [c.caption]   = R.inCaption
  r [c.TCell]     = R.inTableCell
  r [c.List]      = R.inList
  r [c.li]        = R.inListItem
  r [c.DListItem] = R.inDListItem
  r [c.address]   = R.inDivAddress
  r [c.div]       = R.inDivAddress
  r [c.DlQuote]   = R.inOtherBlock
  r [c.Heading]   = R.inOtherBlock
  r [c.button]    = R.inOtherBlock
  r [c.Listing]   = R.inOtherBlock
  r [c.OtherSpecial] = R.inOtherBlock
  r [c.form]      = R.inOtherBlock

  // 'Phrasing container'
  
  r [c.p] = R.inPhrasing

  // Rawtext and RcData

  r [c.noframes]  = R.inData
  r [c.script]    = R.inData // rawtext
  r [c.style]     = R.inData // rawtext
  r [c.textarea]  = R.inData // rcdata
  r [c.title]     = R.inData // rcdata
  r [c.xmp]       = R.inData
  r [c.OtherRaw]  = R.inData
  //r [c.plaintext] // in c.OtherSpecial instead

  // Void tags

  r [c.OtherMeta] = null
  r [c.OtherVoid] = null
  r [c.br]        = null
  r [c.col]       = null
  r [c.hr]        = null
  r [c.embed]     = null
  r [c.frame]     = null
  r [c.image]     = null
  r [c.img]       = null
  r [c.input]     = null
  r [c.hiddenInput] = null
  r [c.keygen]    = null
  r [c.meta]      = null
  r [c.AreaWbr]   = null

  // Non-Element Nodes

  r [c.DOCTYPE]   = null
  r [c.COMMENT]   = null
  r [c.TEXT]      = null
  r [c.SPACE]     = null

  // Foreign namespaces, these should
  // be unreachable in html context.

  r [c.EmbedXml]  = R.inEmbeddedXml
  r [c.EmbedHtml] = R.inEmbeddedHtml
  r [c.OtherForeign] = R.otherInForeign

  // Context dependent

  r [c.select]    = R.inSelect       // alt R.inSelectInTable
  r [c.optgroup]  = R.optgroupInFlow // alt R.optgroupInSelect, R.optgroupInPhrasing 
  r [c.option]    = R.optionInFlow   // alt R.optionInSelect,   R.optionInPhrasing 

  // Formatting elements

  r [c.a]         = R.otherInFlow // alt: R.otherInPhrasing
  r [c.nobr]      = R.otherInFlow
  r [c.HtmlFont]  = R.otherInFlow
  r [c.OtherFmt]  = R.otherInFlow

  // Other

  r [c.SubSup]    = R.otherInFlow // alt: R.otherInPhrasing
  r [c.noscript]  = R.otherInFlow
  r [c.OtherHtml] = R.otherInFlow

}


// Export
// ------

export { r as defaultRules, Rules }