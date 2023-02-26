import { E, C, Any, None, printKind, states as S, Kind } from './categories.js'
const All = Any
const log = console.log.bind (console)

// Rules
// =====

const _scope =
  ~(E.table | C.Tabular | C.object | C.block &~ E.form) | E.p // p a bit superflous, but ok

const _tableIsh = 
  E.table | E.caption | C.tbody | E.tr | C.cell

const Rules = {

  // ### The 'document' rules

  documentRule: {
    state: S.main,
    hide: All,
    escalate: None,
    allow: E.html | C.COMMENT | C.DOCTYPE,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
    paths: { '#default':'html' },
    siblingRules: true,
  },

  fragmentRule: {
    state: S.main,
    hide: All,
    escalate: None,
    allow: Any,
  },

  beforeHtml: {
    hide: All,
    escalate: None,
    allow: E.html | C.COMMENT,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular),
      paths: { '#default':'html' },
    siblingRules: true,
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

  // ### The 'html' rules

  beforeHead: {
    hide: All,
    escalate: None,
    allow: E.head | C.COMMENT,
    openFor: ~(C.SPACE | C.DOCTYPE | C.Tabular | E.html),
      paths: { '#default':'head' },
    siblingRules: true,
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


  // ### Immediate children of the html element

  inHead: {
    for: E.head,
    hide: All,
    escalate: C.Flow | E.body | E.frameset,
    allow: C.Meta | C.SPACE | C.COMMENT,
  },

  inBody: {
    for: E.body,
    hide: All,
    escalate: E.table | C.Tabular,
    allow: C.Flow | E.frameset,
    trap: E.frameset
  },

  inFrameset: {
    for: E.frameset,
    hide: All,
    escalate: None,
    allow: E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
  },


  // ### Table Rules

  inTable: {
    for: E.table,
    state: S.inTable,
    hide: All,
    escalate: E.table,
    allow: E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT,
    inherit: E.form,
    openFor: E.col | E.tr | C.cell,
      paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    trap: C.fosterParented,
  },

  inCaption: {
    for: E.caption,
    hide: ~E.table,
    escalate: C.Tabular,
    allow:  C.Flow &~ E.form,
    inherit: E.form,
  },

  inColgroup: { // Flow container
    for: E.colgroup,
    hide: ~E.table,
    escalate: E.table | C.Tabular | C.Flow,
    allow:  E.col | E.template | C.SPACE | C.COMMENT,
    trap: None,
  },

  inTableBody: {
    for: C.tbody,
    hide: ~E.table,
    escalate: E.table | C.Tabular &~ (E.tr | C.cell),
    allow: E.tr | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
    inherit: E.form,
    openFor: C.cell,
      paths: { td:'tr', th:'tr' },
    trap: C.fosterParented
  },

  inTableRow: {
    for: E.tr,
    hide: ~(E.table | C.tbody),
    escalate: E.table | C.Tabular &~ C.cell,
    allow: C.cell | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
    inherit: E.form,
    trap: C.fosterParented
  },

  inTableCell: { // Flow container
    for: C.td,
    hide: ~(E.table | E.tr | C.tbody),
    escalate: E.table | C.Tabular,
    allow: C.Flow &~ E.form,
    inherit: E.form,
  },


  // ### Select Rules


  inSelect: {
    for: E.select,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell,
    allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  inSelectInTable: {
    for: E.select,
    state: S.inSelect | S.main,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell),
    escalate: E.input | E.keygen | E.textarea | E.caption | C.tbody | E.tr | C.cell | E.table, // As above, only add | E.table...
    allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optgroupInSelect: {
    for: E.optgroup,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell | E.select),
    escalate: E.frameset | C.Tabular | E.optgroup,
    inherit: C.Flow &~ E.optgroup,
    // escalate: E.input | E.keygen | E.textarea | _tableIsh | E.optgroup,
    // allow: E.option | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },

  optionInSelect: {
    for: E.option,
    hide: ~(E.table | E.caption | C.tbody | E.tr | C.cell | E.select | E.optgroup),
    escalate: E.frameset | C.Tabular | E.option | E.optgroup,
    inherit: C.Flow &~ (E.option | E.optgroup),
    // escalate: E.input | E.keygen | E.textarea | _tableIsh | E.optgroup | E.option,
    // allow: E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  },


  // ### Flow containers

  inObject: { // applet, object, marquee
    for: C.object,
    hide: ~(E.table | C.Tabular),
    escalate: C.Tabular,
    allow: C.Flow &~ (E.form | E.table),
    inherit: E.form | E.table,
  },

  inButton: {
    for: E.button,
    hide: _scope,
    escalate: E.frameset | C.Tabular | E.button,
    allow: C.Flow &~ (E.table | E.button),
    inherit: E.table,
  },

  inForm: {
    for: E.form,
    hide: _scope,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow &~ (E.table | E.button | E.form),
    inherit: E.table | E.button,
  },

  inDList: {
    for: E.dl,
    hide: _scope,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow &~ (E.table | E.button | E.form),
    inherit: E.table | E.button | E.form,
  },

  inList: {
    for: C.list,
    hide: _scope | E.li,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow &~ (E.table | E.button | E.form),
    inherit: E.table | E.button | E.form,
  },

  inHeading: {
    for: C.h1_h6,
    hide: _scope,
    escalate: E.frameset | C.Tabular | C.h1_h6,
    allow: C.Flow &~ (E.table | C.h1_h6 | E.button | E.form),
    inherit: E.table | E.button | E.form,
  },

  inListItem: {
    for: E.li,
    hide: _scope &~ E.form,
    escalate: C.Tabular | E.li,
    allow: C.Flow &~ (E.table | E.button | E.form | E.li),
    inherit: E.table | E.button | E.form,
  },

  inDListItem: {
    for: C.dddt,
    hide: _scope &~ E.form,
    escalate: C.Tabular | C.dddt,
    allow: C.Flow &~ (E.table | E.button | E.form | C.dddt),  
    inherit: E.table | E.button | E.form,
  },

  inDivAddress: {
    for: E.div | E.address,
    hide: _scope,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow &~ (E.table | E.button | E.form | C.dddt | E.li),
    inherit: E.table | E.button | E.form | C.dddt | E.li,
  },

  inOtherBlock: { // Special block except address, div
    for: C.block,
    hide: _scope,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow &~ (E.table | E.button | E.form | C.dddt),
    inherit: E.table | E.button | E.form | C.dddt,
  },

  // ### In flow rules

  optionInFlow: {
    for: E.option,
    hide: E.svg | E.math | E.html | E.body | C.otherXml,
    escalate: E.frameset | C.Tabular | E.option | E.optgroup,
    allow: C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6),
  },

  optgroupInFlow: { // otherInFlow but not hiding E.form
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | C.otherXml,
    escalate: E.frameset | C.Tabular,
    // allow: C.Flow &~ (E.button | E.form | C.dddt | E.li),
    // inherit: E.button | E.form | C.dddt | E.li,
    allow: E.option | E.optgroup | C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6)
  },

  otherInFlow: {
    // for: TODO how model that
    hide: E.svg | E.math | E.html | E.body | E.form | C.otherXml,
    escalate: E.frameset | C.Tabular,
    // allow: C.Flow &~ (E.button | E.form | C.dddt | E.li),
    // inherit: E.button | E.form | C.dddt | E.li,
    allow: E.option | E.optgroup | C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6)
  },

  // ### Phrasing

  inParagraph: {
    state: S.main | S.inParagraph,
    hide: _scope,
    escalate: E.frameset | C.Tabular | C.block &~ E.button,
    allow: C.Phrasing &~ E.table,
    inherit: E.table | E.button,
  },

  optionInPhrasing: {
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.otherXml,
    escalate: E.frameset | C.Tabular | E.option | E.optgroup | C.h1_h6,
    inherit: C.Flow &~ (E.option | E.optgroup | C.h1_h6),
    // Alternative; this also works and makes it almost possible to merge with optionInFlow (were it not for the heading)
    // escalate: E.table | C.Tabular | C.block | E.option | E.optgroup | E.button | E.form | C.dddt | E.li,
    // inherit: E.button | E.form | C.block,
  },

  otherInPhrasing: {
    state: S.main | S.inParagraph,
    hide: E.svg | E.math | E.html | E.body | C.otherXml | E.form, // REVIEW
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

  inAnnotationXml: {
    state: S.main|S.inMath|S.inSvg, // REVIEW
    hide: E.html | E.body,
    escalate: C.breakout,
    allow: C.Foreign,
  },

  inEmbeddedHtml: {
    state: S.main,
    hide: ~(E.svg | E.math | E.table | C.Tabular), // NB. note that most all other rules disallow closing svg elements!
    escalate: E.frameset | E.table | C.Tabular,
    allow: C.Flow, // Problem, I'd inherit E.form, but the svg in between blocks it from allow
    // I think... I should use the closable propery instead, rather than the inherit one,
    // so mess around with the actions there again
  },

}


// Export
// ------

export { Rules }