import { E, C, Any, None, printKind, states as S, Kind } from './categories.js'
const All = Any
const log = console.log.bind (console)

// Content models

const FlowContainer = {
  hidenest: E.li | C.dddt | C.h1_h6 | E.option,
  hide:     ~(E.table | C.Tabular | C.block | C.object) | E.form | E.p,
  escalate: E.frameset | C.Tabular,
  allow:    C.Flow,
}


// Rules
// =====

const _scope =
  ~(E.table | C.Tabular | C.object | C.block &~ E.form) | E.p // p a bit superflous, but ok

const _tableIsh = 
  E.table | E.caption | C.tbody | E.tr | C.cell

const Rules = {

  fragmentRule: { // TODO
    state: S.main,
    hide: All,
    escalate: None,
    allow: Any,
  },

  documentRule: {
    state: S.main,
    hide: All,
    escalate: None,
    allow: E.html | C.COMMENT | C.DOCTYPE,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
    paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHtml: {
    hide: All,
    escalate: None,
    allow: E.html | C.COMMENT,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
      paths: { '#default':'html' },
    siblingRules: true,
  },

  beforeHead: {
    hide: All,
    escalate: None,
    allow: E.head | C.COMMENT,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular | E.html),
      paths: { '#default':'head' },
    siblingRules: true,
  },

  inHead: {
    hide: All,
    escalate: C.Flow | E.body | E.frameset,
    allow: C.Meta | C.SPACE | C.COMMENT,
  },

  afterHead: {
    hide: All,
    escalate: None,
    allow:  E.body | E.frameset | C.COMMENT | C.SPACE, 
    openFor: ~(C.Meta &~ E.noscript | E.frame | E.frameset | C.SPACE | C.DOCTYPE | C.Tabular | E.html | E.head), 
      paths: { '#default':'body' },
    trap: C.Meta &~ E.noscript,
    // trap: C.SPACE,
    siblingRules: true,
  },

  inBody: {
    hide: All,
    escalate: E.table | C.Tabular,
    allow: C.Flow,
    trap: E.frameset
  },

  inFrameset: {
    hide: All,
    escalate: None,
    allow: E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
  },


  // ### Table Rules

  inTable: {
    state: S.inTable,
    hide: All,
    escalate: E.table,
    allow: E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT | E.form,
    openFor: E.col | E.tr | C.cell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    trap: C.fosterParented,
  },

  otherInTable: { // adapted otherInFlow
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    allow: C.Flow &~ (E.table | E.form),
    escalate: E.table,
    trap: C.Tabular,
    openFor: E.col | E.tr | C.cell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  },

  inColgroup: {
    hide: ~E.table,
    escalate: E.table | C.Tabular | C.Flow,
    allow:  E.col | E.template | C.SPACE | C.COMMENT,
    trap: None,
  },

  inTableBody: {
    hide: ~E.table,
    escalate: E.table | C.Tabular &~ (E.tr | C.cell),
    allow: E.tr | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
    openFor: C.cell,
      paths: { td:'tr', th:'tr' },
    trap: C.fosterParented
  },

  inTableRow: {
    hide: ~(E.table | C.tbody),
    escalate: E.table | C.Tabular &~ C.cell,
    allow: C.cell | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
    trap: C.fosterParented
  },


  // ### Select Rules

  inSelect: {
    hidenest: E.option,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell,
    allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  inSelectInTable: {
    hidenest: E.option,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell | E.table, // As above, only add | E.table...
    allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optgroupInSelect: {
    escalate: E.frameset | C.Tabular | E.optgroup,
    inherit: C.Flow &~ E.optgroup,
    // escalate: E.input | E.keygen | E.textarea | _tableIsh | E.optgroup,
    // allow: E.option | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optionInSelect: {
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell | E.select | E.optgroup),
    escalate: E.frameset | C.Tabular | E.option | E.optgroup,
    inherit: C.Flow &~ (E.option | E.optgroup),
  },


  // ### Flow containers

  inCaption: { // Flow container
    hidenest: E.table,
    hide:     ~E.table,
    escalate: C.Tabular,
    allow:    C.Flow,
  },

  inTableCell: { // Flow container
    hidenest: E.table,
    hide:     ~(E.table | E.tr | C.tbody),
    escalate: C.Tabular,
    allow:    C.Flow,
  },

  inObject: { // applet, object, marquee
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     FlowContainer.hide | C.block | C.object,
    escalate: C.Tabular,
    allow:    C.Flow,
  },

  inButton: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     FlowContainer.hide,
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow,
  },
 
  inForm:
    FlowContainer,

  inDList:
    FlowContainer,

  inList: {
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     FlowContainer.hide | E.li,
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow,
  },

  inHeading: {
    hidenest: E.li | C.dddt | E.option,
    hide:     FlowContainer.hide,
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow &~ C.h1_h6,
  },

  inListItem: {
    hidenest: C.dddt | C.h1_h6,
    hide:     FlowContainer.hide &~ E.form,
    escalate: C.Tabular,
    allow:    C.Flow,
  },

  inDListItem: {
    hidenest: E.li | C.h1_h6 | E.option,
    hide:     FlowContainer.hide &~ E.form,
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow,
  },

  inDivAddress: {
    hidenest: C.h1_h6,
    hide:     FlowContainer.hide,
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow,
  },

  inOtherBlock: { // other special block except address, div
    hidenest: E.li | C.dddt | C.h1_h6 | E.option,
    hide:     FlowContainer.hide,
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow,
  },

  inEmbeddedHtml: {
    // REVIEW hidenest
    state: S.main,
    hide: ~(E.svg | E.math | E.table | C.Tabular), // NB. note that most all other rules disallow closing svg elements!
    escalate: E.frameset | C.Tabular,
    allow:    C.Flow,
  },

  // ### Phrasing

  inParagraph: {
    hidenest: E.option,
    state: S.main | S.inParagraph,
    hide: _scope,
    escalate: E.frameset | C.Tabular | C.block,
    allow: C.Phrasing
  },


  // ### Transparant content model special overrides

  optionInFlow: {
    hidenest: C.h1_h6,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | E.optgroup, // | E.option
    allow: (C.Flow | C.h1_h6 | E.option) &~ E.optgroup,
    // inherit: C.Flow &~ E.optgroup, // &~ E.option &~ C.h1_h6
  },

  optionInPhrasing: {
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | E.optgroup | C.h1_h6, //  | E.option
    inherit: C.Flow &~ E.optgroup, // &~ E.option
  },

  optgroupInFlow: { // otherInFlow but not hiding E.form
    hidenest: C.h1_h6,
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular,
    allow: E.optgroup | C.h1_h6, // | E.option
    inherit: C.Flow &~ E.optgroup // &~ E.option
  },

  otherInFlow: {
    // for: TODO how model that
    hidenest: C.h1_h6 | E.option,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow
  },

  otherInPhrasing: {
    hidenest: E.option,
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    escalate: E.frameset | C.Tabular | C.block,
    allow: C.Phrasing
  },


  // ### Rawtext and RCData content

  inData: {
    allow: C.SPACE | C.TEXT,
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
    allow: C.Foreign &~ C.annotationHtml, // annotationHtml not, true, but that's tagged as a mathML thing
  },

  inMath: {
    hidenest: E.option, // REVIEW
    state: S.inMath,
    hide: E.html | E.body | E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    allow: C.Foreign,
  },

  // ### XML Container 

  inAnnotationXml: {
    state: S.main|S.inMath|S.inSvg, // REVIEW
    hide: E.html | E.body,
    escalate: C.breakout,
    allow: C.Foreign,
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
    allow: E.noframes | C.SPACE | C.COMMENT
  },

  afterHtmlAfterBody: {
    // This should never be reached,
    //  the html tag should never be closed.
    hide: All,
    escalate: None,
    allow: None,
  },

  afterHtmlAfterFrameset: {
    hide: All,
    escalate: None,
    allow: C.COMMENT,
  },

}


// Export
// ------

export { Rules }