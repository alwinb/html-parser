import { E, elemIds as e, C, classIds as c, states as S, Any, None, printKind } from './categories.js'
const All = Any
const log = console.log.bind (console)


// Rules
// =====

const hideInFlow = 
   ~(E.table | C.Tabular | E.button | C.object | C.block /*| C.otherFmt*/) | E.form | E.p
   // form and p are in block, button and object are not

const Rules = {

  fragmentRule: { // TODO
    hide: All,
    state: S.main,
    content: Any,
  },

  documentRule: {
    state: S.main,
    hide: All,
    content: E.html | C.COMMENT | C.DOCTYPE,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
    paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHtml: {
    content: E.html | C.COMMENT,
    hide: All,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
      paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHead: {
    content: E.head | C.COMMENT,
    hide: ~E.html,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular | E.html),
      paths: { '#default':'head' },
    siblingRules: true,
  },

  inHead: {
    hide: ~(E.html | E.head),
    escalate: C.Flow | E.body | E.frameset,
    content: C.Meta | C.SPACE | C.COMMENT,
  },

  afterHead: {
    hide: ~E.html,
    content:  E.body | E.frameset | C.COMMENT | C.SPACE, 
    openFor: ~(C.Meta &~ E.noscript | E.frame | E.frameset | C.SPACE | C.DOCTYPE | C.Tabular | E.html | E.head), 
      paths: { '#default':'body' },
    trap: C.Meta &~ E.noscript,
    // trap: C.SPACE,
    siblingRules: true,
  },

  inBody: {
    hide: ~(E.html | E.body),
    content: C.Flow,
    trap: E.frameset
  },

  inFrameset: {
    hide: ~(E.html | E.body | E.frameset),
    content: E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
  },


  // ### Table Rules

  inTable: {
    state: S.inTable,
    hide: All,
    content: E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT | E.form,
    openFor: E.col | E.tr | C.cell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    trap: C.fosterParented,
  },

  inColgroup: {
    hide: ~E.table,
    escalate: C.Tabular | C.Flow,
    content:  E.col | E.template | C.SPACE | C.COMMENT,
    trap: None,
  },

  inTableBody: {
    hide: ~E.table,
    escalate: C.Tabular &~ (E.tr | C.cell),
    content: E.tr | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT | E.form,
    openFor: C.cell,
      paths: { td:'tr', th:'tr' },
    trap: C.fosterParented
  },

  inTableRow: {
    hide: ~(E.table | C.tbody),
    escalate: C.Tabular &~ C.cell,
    content: C.cell | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
    trap: C.fosterParented
  },


  // ### Select Rules

  inSelect: {
    hidenest: E.option,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell,
    content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

    // As above, only add E.table to escalate
  inSelectInTable: {
    hidenest: E.option,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell | E.table,
    content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optgroupInSelect: {
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell | E.select),
    escalate: E.caption | E.tr | C.tbody | C.cell | E.optgroup,
    content: E.option | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optionInSelect: {
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell | E.select | E.optgroup),
    escalate: E.caption | E.tr | C.tbody | C.cell | E.optgroup | E.option,
    content: E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },


  // ### Flow containers

  inCaption: {
    hidenest: E.table,
    hide:     ~E.table,
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inTableCell: {
    hidenest: E.table,
    hide:     ~(E.table | E.tr | C.tbody),
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inObject: { // applet, object, marquee
    hidenest: E.li | C.dddt | C.h1_h6 | E.option | E.button,
    hide:     hideInFlow | C.block | C.object,
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inList: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow | E.li,
    escalate: E.frameset | C.Tabular,
    content:  C.Flow,
  },

  inListItem: {
    hidenest: C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow &~ E.form,
    escalate: C.Tabular,
    content:  C.Flow,
  },

  inDListItem: {
    hidenest: E.li | C.h1_h6 | E.option,
    hide:     hideInFlow &~ E.form,
    escalate: E.frameset | C.Tabular,
    content:  C.Flow,
  },

  inDivAddress: {
    hidenest: C.h1_h6 | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:  C.Flow,
  },

  // NB the system is set up such that elements cannot hide themselves for nesting,
  // this is relevant for h1-h6 elements -> inOtherBlock

  inOtherBlock: { // other special block except address, div
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:  C.Flow,
  },

  inEmbeddedHtml: {
    state: S.main,
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide: ~(E.svg | E.math | E.table | C.Tabular), // NB. note that most all other rules disallow closing svg elements!
    escalate: E.frameset | C.Tabular,
    content: C.Flow,
  },

  // ### Transparant content model in Flow

  optionInFlow: {
    hidenest: C.h1_h6,
    hide: C.Foreign | E.html | E.body,
    escalate: E.frameset | C.Tabular | E.optgroup,
    content: C.Flow &~ E.optgroup,
  },

  optgroupInFlow: { // otherInFlow but not hiding E.form
    hidenest: C.h1_h6,
    hide: C.Foreign | E.html | E.body,
    escalate: E.frameset | C.Tabular,
    content: C.Flow,
  },

  otherInFlow: {
    hidenest: C.h1_h6 | E.option,
    hide: C.Foreign | E.html | E.body | E.form,
    escalate: E.frameset | C.Tabular,
    content: C.Flow
  },

  // ### Phrasing Container

  inParagraph: {
    hidenest: E.option,
    state: S.main | S.inParagraph,
    hide: ~(E.table | C.Tabular | E.button | C.object | C.block) | E.form,
    escalate: E.frameset | C.Tabular | C.block,
    content: C.Phrasing
  },

  // ### Transparant content model in Phrasing

  optionInPhrasing: {
    state: S.main | S.inParagraph,
    hide: C.Foreign | E.html | E.body,
    escalate: E.frameset | C.Tabular | E.optgroup | C.h1_h6 | C.block,
    content: C.Phrasing &~ E.optgroup,
  },

  optgroupInPhrasing: {
    hidenest: C.h1_h6,
    hide: C.Foreign | E.html | E.body,
    escalate: E.frameset | C.Tabular | C.block,
    content: C.Phrasing,
  },

  otherInPhrasing: {
    hidenest: E.option,
    state: S.main | S.inParagraph,
    hide: C.Foreign | E.html | E.body | E.form,
    escalate: E.frameset | C.Tabular | C.block,
    content: C.Phrasing
  },

  // ### Rawtext and RCData content

  inData: {
    content: C.SPACE | C.TEXT,
    escalate: All,
  },

  // ### Foreign Content Rules

  // NB I am currently doing context / namespace dependent
  // kind annotations.

  inSvg: {
    state: S.inSvg,
    hide: E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },

  inMath: {
    state: S.inMath,
    hide: E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },

  otherInForeign: {
    hide: E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    content: C.Foreign | C.SPACE | C.TEXT | C.COMMENT,
  },

  // ### XML Container 

  inEmbeddedXml: {
    state: S.main | S.inMath | S.inSvg, // REVIEW
    escalate: C.breakout | E.frameset, // REVIEW
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
    content: E.noframes | C.SPACE | C.COMMENT
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

  r [e.html]      = R.beforeHead
  r [e.math]      = R.inMath
  r [e.svg]       = R.inSvg

  r [e.head]      = R.inHead
  r [e.frameset]  = R.inFrameset
  r [e.template]  = R.fragmentRule

  r [e.table]     = R.inTable
  r [e.colgroup]  = R.inColgroup
  r [c.tbody]     = R.inTableBody
  r [e.tr]        = R.inTableRow

  // Flow containers

  r [e.body]      = R.inBody
  r [c.object]    = R.inObject
  r [e.caption]   = R.inCaption
  r [c.cell]      = R.inTableCell
  r [c.list]      = R.inList
  r [e.li]        = R.inListItem
  r [c.dddt]      = R.inDListItem
  r [e.address]   = R.inDivAddress
  r [e.div]       = R.inDivAddress
  r [c.dlquote]   = R.inOtherBlock
  r [c.h1_h6]     = R.inOtherBlock
  r [e.button]    = R.inOtherBlock
  r [c.pre]       = R.inOtherBlock
  r [c.section]   = R.inOtherBlock
  r [e.form]      = R.inOtherBlock

  // Phrasing container
  r [e.p]         = R.inParagraph

  // Rawtext and RcData

  r [e.noframes]  = R.inData
  r [e.script]    = R.inData // rawtext
  r [e.style]     = R.inData // rawtext
  r [e.textarea]  = R.inData // rcdata
  r [e.title]     = R.inData // rcdata
  r [e.xmp]       = R.inData
  r [c.otherRaw]  = R.inData
  //r [e.plaintext] // in c.section instead

  // Void tags

  r [c.otherMeta] = null
  r [c.otherVoid] = null
  r [e.br]        = null
  r [e.col]       = null
  r [e.hr]        = null
  r [e.embed]     = null
  r [e.frame]     = null
  r [e.image]     = null
  r [e.img]       = null
  r [e.input]     = null
  r [e.keygen]    = null
  r [e.meta]      = null
  r [c.areawbr]   = null

  // Non-Element Nodes

  r [c.DOCTYPE]   = null
  r [c.COMMENT]   = null
  r [c.TEXT]      = null
  r [c.SPACE]     = null

  // Foreign namespaces, these should
  // be unreachable in html context.

  r [e.embedXml]  = R.inEmbeddedXml
  r [c.embedHtml] = R.inEmbeddedHtml
  r [c.otherForeign] = R.otherInForeign

  // Context dependent

  r [e.select]    = R.inSelect       // alt R.inSelectInTable
  r [e.optgroup]  = R.optgroupInFlow // alt R.optgroupInSelect, R.optgroupInPhrasing 
  r [e.option]    = R.optionInFlow   // alt R.optionInSelect,   R.optionInPhrasing 

  // Formatting elements

  r [e.a]         = R.otherInFlow // alt: R.otherInPhrasing
  r [e.font]      = R.otherInFlow
  r [e.nobr]      = R.otherInFlow
  r [c.otherFmt]  = R.otherInFlow

  r [c.subsup]    = R.otherInFlow
  r [e.noscript]  = R.otherInFlow
  r [c.otherHtml] = R.otherInFlow

}


// Export
// ------

export { r as defaultRules, Rules }