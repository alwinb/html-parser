import { E, C, Any, None, printKind } from './categories.js'
const log = console.log.bind (console)

// Try, using states

let i=0
const S = {
  main:         1 << i++,
  inTable:      1 << i++,
  inSvg:        1 << i++,
  inMath:       1 << i++,
  inSelect:     1 << i++,
  inParagraph:  1 << i++,
}

// Schema
// ======

// A schema specifies a set of DOM trees with specific invariants. 
// The schema here also specifies how to handle mismatched and misplaced tags. 
// The schema can be thought of as a directed graph of Rules connected by 
// two kinds of transitions: childNode transitions and siblingNode transitions.
// It can also be thought of as a 'cannonical tree' -- A quotient of the set of
// all trees that conform to this schema 

// The rules of the schema may declare:
// * modifiers:
//   closable, escalate, inherit, allow
// * properties:
//   state, openFor, paths
//   where state is inherited if absent,
//   and openFor and paths are reset if absent.

function ruleInfo (rule) {
  const info = Object.assign ({}, rule)
  for (let k in info) if (typeof info [k] === 'bigint')
    info [k] = printKind (info [k])
  return info
}

// Rules
// =====

const documentRule = {
  name: '#document',
  state: S.main,
  allow: E.html | C.COMMENT | C.DOCTYPE,
  openFor: ~(C.SPACE | C.DOCTYPE),
  paths: { '#default':'html' },
  siblingRules: true,
}

const fragmentRule = {
  name: '#fragment',
  state: S.main,
  escalate: None,
  allow: C.bodyContent,
}

// ### The 'document' rules

const beforeDoctype = {
  name:'beforeDoctype',
  allow: E.html | C.COMMENT | C.DOCTYPE,
  openFor: ~(C.SPACE | C.DOCTYPE),
    paths: { '#default':'html' },
  siblingRules: true,
}

const beforeHtml = {
  name:'beforeHtml',
  allow: E.html | C.COMMENT,
  openFor: ~(C.SPACE | C.DOCTYPE),
    paths: { '#default':'html' },
  siblingRules: true,
}

const afterHtmlAfterBody = {
  // This should never be reached,
  //  the html tag should never be closed.
  escalate: None,
  allow: None,
}

const afterHtmlAfterFrameset = {
  allow: C.COMMENT,
}

// ### The 'html' rules

const inHtmlBeforeHead = {
  allow: E.head | C.COMMENT,
  openFor: ~(C.SPACE | C.DOCTYPE),
    paths: { '#default':'head' },
  siblingRules: true,
}

const inHtmlAfterHead = {
  closable: None,
  escalate: None,
  allow:  E.body | E.frameset | C.COMMENT | C.SPACE, 
  openFor: ~(C.metaRedirect | E.frame | E.frameset | C.SPACE | C.DOCTYPE), 
    paths: { '#default':'body' },
  reparent: C.metaRedirect,
  // reparent: C.SPACE,
  siblingRules: true,
}

const inHtmlAfterBody = {
  // This should never be reached,
  //  the body tag should never be closed.
  closable: None,
  escalate: None,
}

const inHtmlAfterFrameset = {
  escalate: None,
  allow: E.noframes | C.SPACE | C.COMMENT
}


// ### Immediate children of the html element

const inHead = {
  closable: None,
  escalate: ~(E.frame | E.head | C.DOCTYPE),
  allow: C.meta | C.SPACE | C.COMMENT,
}

const inBody = {
  closable: None,
  escalate: None,
  allow: C.bodyContent,
  reparent: E.frameset
}

const inFrameset = {
  escalate: None,
  allow:  E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
}


// ### Table Rules

const inTable = {
  state: S.inTable,
  closable: None,
  escalate: E.table,
  allow: C.tableContent, // TODO also forms, but do foster parent its contents!
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  reparent: C.fosterParented
  // ~(C.tableIsh | E.script | E.template | E.style | C.hiddenInput | C.COMMENT) // REVIEW removing hiddenInput should be automatic?
}

const inCaption = {
  closable: E.table,
  allow:  C.bodyContent,
}

const inColgroup = {
  closable: E.table,
  allow:  E.col | E.template | C.SPACE,
  escalate: Any,
  reparent: None,
}

const inTableBody = {
  closable: E.table,
  escalate: C.tableIsh &~ (E.tr | C.cell),
  openFor: C.cell,
    paths: { td:'tr', th:'tr' },
  allow: C.tbodyContent,
  reparent: C.fosterParented
}

const inTableRow = {
  closable: E.table | C.tbody,
  escalate: C.tableIsh &~ C.cell,
  allow: C.trContent,
  reparent: C.fosterParented
}

const inTableCell = {
  closable: E.table | E.tr | C.tbody,
  escalate: C.tableIsh,
  allow: C.bodyContent,
}


// ### Select Rules

const _tableIsh =
  C.tableIsh &~ (E.colgroup | E.col)
  //   E.table | E.caption | C.tbody | E.tr | C.cell

const inSelect = {
  state: S.inSelect | S.main,
  closable: None,
  escalate: E.input | E.keygen | E.textarea,
  allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
}

const inOptgroupInSelect = {
  escalate: E.input | E.keygen | E.textarea | E.optgroup | _tableIsh,
  inherit: ~E.optgroup, // E.option | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT
}

const inOptionInSelect = {
  escalate: E.input | E.keygen | E.textarea | _tableIsh | E.option | E.optgroup,
  inherit: ~(E.optgroup | E.option), //E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
}

const inSelectInTable = {
  state: S.inSelect | S.main,
  closable: C.tableIsh,
  escalate: E.input | E.keygen | E.textarea | _tableIsh,
  allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
}


// ### Content Rules

const inObject = {
  closable: C.tableIsh,
  escalate: C.tableIsh,
  allow: C.bodyContent,
}

// REVIEW  -- rules for block-level elements, 
// having address and div be special cases (is that correct?)

const inBlock = { // address, div
  closable: C.special | C._scope | C.tableIsh,
  inherit: C.bodyContent,
  allow: C.bodyContent &~ (E.button | E.form | C.dddt | E.li),
}

const inSpecialBlock = {
  closable: C.special | C._scope | C.tableIsh,
  inherit: C.bodyContent,
  allow: C.bodyContent &~ (E.button | E.form | C.dddt),
}

const defaultRule = {
  closable: ~(E.svg | E.math | E.form | E.body),
  inherit: Any,
  allow: (C.pContent | C.h1_h6) &~ E.button, // REVIEW
}


// ### Nesting  Restrictions 

const _scope = 
  E.option | E.optgroup | C.other | E.svg | E.math | E.body

const inButton = {
  closable: ~(_scope | E.form | E.p),
  allow: C.bodyContent &~ E.button,
}

const inList = {
  closable: ~(_scope | E.form | E.li),
  inherit: C.bodyContent,
  allow: C.bodyContent &~ E.button,
}

const dlRule = {
  closable: ~(_scope | E.form),
  inherit: C.bodyContent,
  allow: C.bodyContent &~ E.button,
}

const inForm = {
  escalate: ~E.form,
  inherit: C.bodyContent &~ E.form,
  allow: C.bodyContent &~ (E.button | E.form),
}

const inHeading = {
  closable: ~(_scope | E.form),
  inherit: C.bodyContent &~ C.h1_h6,
  allow: C.bodyContent &~ (E.button | E.form | C.h1_h6),
}

const inListItem = {
  closable: ~(_scope),
  inherit: C.bodyContent &~ E.li,
  allow: C.bodyContent &~ (E.button | E.form | E.li),
}

const inDListItem = {
  closable: ~(_scope),
  inherit: C.bodyContent &~ C.dddt,
  allow: C.bodyContent &~ (E.button | E.form | C.dddt),  
}

const inOption = { // Very strange content model...
  closable: ~(E.svg | E.math | E.body),
  inherit: C.bodyContent &~ (E.option | E.optgroup),
  // allow: E.p //| C.h1_h6, // FIXME not the h1_h6 in p... // REVIEW ==> ‡
  // TODO should ignore \x00 characters ?
}

// ‡) A heading element start tag
// If there is a p in button scope, generate-close it.
// If the current node is a heading element, Parse error; pop the current node off the stack.
// Insert an element for the token.

const inParagraph =  {
  state: S.main | S.inParagraph,
  closable: ~(_scope),
  inherit: C.pContent,
  allow: C.pContent &~ E.button,
}

const defaultInParagraph = {
  inherit: Any,
}

const inData = {
  allow: C.SPACE | C.RAW,
  escalate: Any,
}

// ### Foreign Content Rules

// NB I am currently doing context / namespace dependent
// kind annotations.

const inSvg = {
  state: S.inSvg,
  closable: ~(E.html | E.body),
  escalate: C.breakout | C.tableIsh, // REVIEW
  allow: C.foreignContent &~ C.tableIsh,
}

const inMath = {
  state: S.inMath,
  closable: ~(E.html | E.body),
  escalate: C.breakout | C.tableIsh,
  allow: C.foreignContent &~ C.tableIsh,
}

const inEmbeddedHtml = {
  state: S.main,
  closable: E.svg | E.math, // | C.tableIsh, // NB. note that most all other rules disallow closing svg elements!
  escalate: C.tableIsh,
  allow: C.bodyContent,
  reparent: E.frameset,
}


// RuleSets
// ========

// ### The Main RuleSet

const mainRules = {

  html:      inHtmlBeforeHead,
  head:      inHead,
  body:      inBody,
  frameset:  inFrameset,

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and in fact td is different yet (siblings set the context?)
    closable: None,
    allow:  ~(E.body | E.frameset | E.frame | C.RAW),
  },

  applet:    inObject,
  object:    inObject,
  marquee:   inObject,

  svg:       inSvg,
  math:      inMath,

  select:    inSelect,
  option:    inOption,

  dl:        dlRule,
  ol:        inList,
  ul:        inList,
  li:        inListItem,
  dt:        inDListItem,
  dd:        inDListItem,

  form:      inForm,
  button:    inButton,
  p:         inParagraph,

  div:       inBlock,
  address:   inBlock,

  style:     inData, // rawtext
  script:    inData, 
  xmp:       inData,
  iframe:    inData,
  noembed:   inData,
  noframes:  inData,
  textarea:  inData, // rcdata
  title:     inData, // rcdata
  plaintext: inData, // plain text
  '#comment':inData, // comment data

  table:     inTable,
  caption:   inCaption,
  colgroup:  inColgroup,
  thead:     inTableBody,
  tbody:     inTableBody,
  tfoot:     inTableBody,
  tr:        inTableRow,
  th:        inTableCell,
  td:        inTableCell,
}

// ### Table state

const tableRules = {
  svg: inSvg,
  select: inSelectInTable,
}

// ### Select state

const selectRules = {
  option: inOptionInSelect,
  optgroup: inOptgroupInSelect,
}

// ### SVG and MathML states

const svgRules = {
  svg:  inSvg,
  math: inSvg, // NB
  foreignObject: inEmbeddedHtml,
  title: inEmbeddedHtml,
  desc: inEmbeddedHtml,
  // #default: inSvg,
}

const mathRules = {
  svg:  inMath, // NB
  math: inMath,
  mi: inEmbeddedHtml,
  mo: inEmbeddedHtml,
  mn: inEmbeddedHtml,
  ms: inEmbeddedHtml,
  mtext: inEmbeddedHtml,
  // annotation-xml: (depends on attribute)
  // #default: inMath,
}

// const annotationXmlRule = {
//   name: 'annotationXmlRule',
//   allow:None, escalate:None
// }


function childRule (context, name, kind) { let rule
  
  if (context & S.inMath)
    return kind & C.annotationHtml ? inEmbeddedHtml
      : mathRules [name] ?? inMath

  if (context & S.inSvg)
    return svgRules [name] ?? inSvg

  if (context & S.inTable && (rule = tableRules [name]))
    return rule

  if (context & S.inSelect && (rule = selectRules [name]))
    return rule

  if (kind & C.h1_h6)
    return inHeading

  if (name in mainRules)
    return mainRules [name]

  if (kind & C._specialBlock)
    return inSpecialBlock

  return context & S.inParagraph
    ? defaultInParagraph : defaultRule
}


function siblingRule ({ kind:pkind, children }, name, kind, _allOpened) {
  if (pkind === None) // '#document'
    return children & E.html
      ? (_allOpened & E.frameset ? afterHtmlAfterFrameset : afterHtmlAfterBody)
      : children & C.DOCTYPE ? beforeHtml : beforeDoctype

  if (pkind & E.html)
    return children & E.frameset ? inHtmlAfterFrameset
      : children & E.body ? inHtmlAfterBody
      : children & E.head ? inHtmlAfterHead
      : inHtmlBeforeHead

  return null // NB signals 'no update' which at the moment is different from the empty rule!
}


// Exports
// =======

export { 
  documentRule, fragmentRule, childRule, siblingRule, ruleInfo, S as states
}