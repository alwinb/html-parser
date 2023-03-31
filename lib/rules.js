import { E, C, Any, None, printKind, states as S, Kind } from './categories.js'
const All = Any
const log = console.log.bind (console)


// Rules
// =====

const hideInFlow = 
   ~(E.table | C.Tabular | C.block | C.object /*| C.otherFmt*/) | E.form | E.p

const _tableIsh = 
  E.table | E.caption | C.tbody | E.tr | C.cell

const _scope =
  ~(E.table | C.Tabular | C.object | C.block &~ E.form) | E.p // p a bit superflous, but ok

const Rules = {

  fragmentRule: { // TODO
    state: S.main,
    hide: All,
    escalate: None,
    content: Any,
  },

  documentRule: {
    state: S.main,
    hide: All,
    escalate: None,
    content: E.html | C.COMMENT | C.DOCTYPE,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
    paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHtml: {
    hide: All,
    escalate: None,
    content: E.html | C.COMMENT,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
      paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHead: {
    hide: All,
    escalate: None,
    content: E.head | C.COMMENT,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular | E.html),
      paths: { '#default':'head' },
    siblingRules: true,
  },

  inHead: {
    hide: All,
    escalate: C.Flow | E.body | E.frameset,
    content: C.Meta | C.SPACE | C.COMMENT,
  },

  afterHead: {
    hide: All,
    escalate: None,
    content:  E.body | E.frameset | C.COMMENT | C.SPACE, 
    openFor: ~(C.Meta &~ E.noscript | E.frame | E.frameset | C.SPACE | C.DOCTYPE | C.Tabular | E.html | E.head), 
      paths: { '#default':'body' },
    trap: C.Meta &~ E.noscript,
    // trap: C.SPACE,
    siblingRules: true,
  },

  inBody: {
    hide: All,
    escalate: C.Tabular,
    content: C.Flow,
    trap: E.frameset
  },

  inFrameset: {
    hide: All,
    escalate: None,
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

  otherInTable: { // adapted otherInFlow
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    content: C.Flow &~ (E.table | E.form),
    trap: C.Tabular,
    openFor: E.col | E.tr | C.cell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
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
    content: E.tr | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
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

  // As above, only add | E.table...
  inSelectInTable: {
    hidenest: E.option,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell | E.table,
    content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optgroupInSelect: {
    escalate: E.frameset | C.Tabular | E.optgroup,
    content: E.option | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optionInSelect: {
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell | E.select | E.optgroup),
    escalate: E.frameset | C.Tabular | E.option | E.optgroup | E.option,
    content: E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },


  // ### Flow containers

  inCaption: {
    hidenest: E.table,
    hide:     ~E.table,
    escalate: C.Tabular,
    content:    C.Flow,
  },

  inTableCell: {
    hidenest: E.table,
    hide:     ~(E.table | E.tr | C.tbody),
    escalate: C.Tabular,
    content:    C.Flow,
  },

  inObject: { // applet, object, marquee
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow | C.block | C.object,
    escalate: C.Tabular,
    content:    C.Flow,
  },

  inButton: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },
 
  inForm: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },
  
  inDList: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },

  inList: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow | E.li,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },

  inHeading: {
    hidenest: E.li | C.dddt | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow &~ C.h1_h6,
  },

  inListItem: {
    hidenest: C.dddt | C.h1_h6,
    hide:     hideInFlow &~ E.form,
    escalate: C.Tabular,
    content:    C.Flow,
  },

  inDListItem: {
    hidenest: E.li | C.h1_h6 | E.option,
    hide:     hideInFlow &~ E.form,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },

  inDivAddress: {
    hidenest: C.h1_h6,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },

  inOtherBlock: { // other special block except address, div
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     hideInFlow,
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },

  inEmbeddedHtml: {
    // REVIEW hidenest
    state: S.main,
    hide: ~(E.svg | E.math | E.table | C.Tabular), // NB. note that most all other rules discontent closing svg elements!
    escalate: E.frameset | C.Tabular,
    content:    C.Flow,
  },

  // ### Phrasing

  inParagraph: {
    hidenest: E.option,
    state: S.main | S.inParagraph,
    hide: _scope,
    escalate: E.frameset | C.Tabular | C.block,
    content: C.Phrasing
  },


  // ### Transparant content model special overrides

  optionInFlow: {
    hidenest: C.h1_h6,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | E.optgroup,
    content: C.Flow &~ E.optgroup,
  },

  optionInPhrasing: {
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | E.optgroup | C.h1_h6 | C.block,
    content: C.Phrasing &~ E.optgroup,
  },

  optgroupInPhrasing: {
    hidenest: C.h1_h6,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | C.block,
    content: C.Phrasing,
  },

  optgroupInFlow: { // otherInFlow but not hiding E.form
    hidenest: C.h1_h6,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular,
    content: C.Flow,
  },

  otherInFlow: {
    // for: TODO how model that
    hidenest: C.h1_h6 | E.option,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    escalate: E.frameset | C.Tabular,
    content: C.Flow
  },

  otherInPhrasing: {
    hidenest: E.option,
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
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
    hidenest: E.option, // REVIEW
    state: S.inSvg,
    hide: E.html | E.body | E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    content: C.Foreign &~ C.annotationHtml, // annotationHtml not, true, but that's tagged as a mathML thing
  },

  inMath: {
    hidenest: E.option, // REVIEW
    state: S.inMath,
    hide: E.html | E.body | E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    content: C.Foreign,
  },

  // ### XML Container 

  inAnnotationXml: {
    state: S.main|S.inMath|S.inSvg, // REVIEW
    hide: E.html | E.body,
    escalate: C.breakout,
    content: C.Foreign,
  },


  // ### After* rules

  afterBody: {
    // This should never be reached,
    //  the body tag should never be closed.
    hide: All,
    escalate: None,
  },

  afterFrameset: {
    hide: All,
    escalate: None,
    content: E.noframes | C.SPACE | C.COMMENT
  },

  afterHtmlAfterBody: {
    // This should never be reached,
    //  the html tag should never be closed.
    hide: All,
    escalate: None,
    content: None,
  },

  afterHtmlAfterFrameset: {
    hide: All,
    escalate: None,
    content: C.COMMENT,
  },

}


// Export
// ------

export { Rules }