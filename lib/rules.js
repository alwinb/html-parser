import { E, C, Any, None, printKind, states as S, Kind } from './categories.js'
const All = Any
const log = console.log.bind (console)

// Content models

const FlowContainer = {
  hide:     ~(E.table | C.Tabular | C.block | C.object) | E.form | E.p,
  escalate: E.frameset | C.Tabular,
  allow:    C.Flow &~ (E.table | E.button | E.form),
  inherit:  E.table | E.button | E.form,
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
    allow: C.Flow | E.frameset,
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
    allow: E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT,
    inherit: E.form,
    openFor: E.col | E.tr | C.cell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    trap: C.fosterParented,
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
    inherit: E.form,
    openFor: C.cell,
      paths: { td:'tr', th:'tr' },
    trap: C.fosterParented
  },

  inTableRow: {
    hide: ~(E.table | C.tbody),
    escalate: E.table | C.Tabular &~ C.cell,
    allow: C.cell | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
    inherit: E.form,
    trap: C.fosterParented
  },


  // ### Select Rules

  inSelect: {
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell,
    allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  inSelectInTable: {
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
    // escalate: E.input | E.keygen | E.textarea | _tableIsh | E.optgroup | E.option,
    // allow: E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },


  // ### Flow containers

  inCaption: { // Flow container
    hide:     ~E.table,
    escalate: FlowContainer.escalate &~ E.frameset,
    allow:    FlowContainer.allow     | (E.table | E.button),
    inherit:  FlowContainer.inherit  &~ (E.table | E.button),
  },

  inTableCell: { // Flow container
    hide:     ~(E.table | E.tr | C.tbody),
    escalate: FlowContainer.escalate &~ E.frameset,
    allow:    FlowContainer.allow     | (E.table | E.button),
    inherit:  FlowContainer.inherit  &~ (E.table | E.button),
  },

  inObject: { // applet, object, marquee
    hide:     FlowContainer.hide | C.block | C.object,
    escalate: FlowContainer.escalate &~ E.frameset,
    allow:    FlowContainer.allow    | E.button,
    inherit:  FlowContainer.inherit &~ E.button,
  },

  inButton: {
    hide:     FlowContainer.hide,
    escalate: FlowContainer.escalate | E.button,
    allow:    FlowContainer.allow    | E.form,
    inherit:  FlowContainer.inherit &~ (E.button | E.form),
  },

  inForm: {
    hide:     FlowContainer.hide,
    escalate: FlowContainer.escalate,
    allow:    FlowContainer.allow,
    inherit:  FlowContainer.inherit &~ E.form,
  },

  inDList:
    FlowContainer,

  inList: {
    hide:     FlowContainer.hide | E.li,
    escalate: FlowContainer.escalate,
    allow:    FlowContainer.allow,
    inherit:  FlowContainer.inherit,
  },

  inHeading: {
    hide:     FlowContainer.hide,
    escalate: FlowContainer.escalate | C.h1_h6,
    allow:    FlowContainer.allow   &~ C.h1_h6,
    inherit:  FlowContainer.inherit,
  },

  inListItem: {
    hide:     FlowContainer.hide  &~ E.form,
    escalate: C.Tabular            | E.li,
    allow:    FlowContainer.allow &~ E.li,
    inherit:  FlowContainer.inherit,
  },

  inDListItem: {
    hide:     FlowContainer.hide  &~ E.form,
    escalate: C.Tabular            | C.dddt,
    allow:    FlowContainer.allow &~ C.dddt,
    inherit:  FlowContainer.inherit,
  },

  inDivAddress: {
    hide:     FlowContainer.hide,
    escalate: FlowContainer.escalate,
    allow:    FlowContainer.allow  &~ (C.dddt | E.li),
    inherit:  FlowContainer.inherit | (C.dddt | E.li),
  },

  inOtherBlock: { // other special block except address, div
    hide:     FlowContainer.hide,
    escalate: FlowContainer.escalate,
    allow:    FlowContainer.allow  &~ C.dddt,
    inherit:  FlowContainer.inherit | C.dddt,
  },

  inEmbeddedHtml: {
    state: S.main,
    hide: ~(E.svg | E.math | E.table | C.Tabular), // NB. note that most all other rules disallow closing svg elements!
    escalate: FlowContainer.escalate | E.table,
    allow: C.Flow, // Problem, I'd inherit E.form, but the svg in between blocks it from allow
    // I think... I should use the closable propery instead, rather than the inherit one,
    // so mess around with the actions there again
  },

  // ### Phrasing

  inParagraph: {
    state: S.main | S.inParagraph,
    hide: _scope,
    escalate: FlowContainer.escalate | C.block &~ E.button,
    allow: C.Phrasing &~ E.table,
    inherit: E.table | E.button,
  },


  // ### Transparant content model special overrides

  optionInFlow: {
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | E.option | E.optgroup,
    allow: C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6),
  },

  optionInPhrasing: {
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular | E.option | E.optgroup | C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6),
    // Alternative; this also works and makes it almost possible to merge with optionInFlow (were it not for the heading)
    // escalate: E.table | C.Tabular | C.block | E.option | E.optgroup | E.button | E.form | C.dddt | E.li,
    // inherit: E.button | E.form | C.block,
  },

  optgroupInFlow: { // otherInFlow but not hiding E.form
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml,
    escalate: E.frameset | C.Tabular,
    // allow: C.Flow &~ (E.button | E.form | C.dddt | E.li),
    // inherit: E.button | E.form | C.dddt | E.li,
    allow: E.option | E.optgroup | C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6)
  },

  otherInFlow: {
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    escalate: E.frameset | C.Tabular,
    // allow: C.Flow &~ (E.button | E.form | C.dddt | E.li),
    // inherit: E.button | E.form | C.dddt | E.li,
    allow: E.option | E.optgroup | C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6)
  },

  otherInPhrasing: {
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.annotationXml | C.annotationHtml | C.otherXml | E.form,
    escalate: E.frameset | C.Tabular,
    allow: E.option | E.optgroup,
    inherit: C.Flow &~ (E.option | E.optgroup),
    // allow: C.Phrasing,
    // inherit: E.button,
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
    state: S.inSvg,
    hide: E.html | E.body | E.form,
    escalate: E.frameset | C.Tabular | C.breakout, // REVIEW
    allow: C.Foreign &~ C.annotationHtml, // annotationHtml not, true, but that's tagged as a mathML thing
  },

  inMath: {
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