import { E, C, Any, None, printKind } from './categories.js'
const log = console.log.bind (console)

// Schema
// ======

// A schema specifies a set of DOM trees with specific invariants. 
// The schema here also specifies how to handle mismatched and misplaed tags. 
// The schema can be thought of as a directed graph of Rules connected by 
// two kinds of transitions: childNode transitions and siblingNode transitions.
// It can also be thought of as a 'cannonical tree' -- A quotient of the set of
// all trees that conform to this schema 

// The rules of the schema may declare:
// * modifiers:
//   closable, escalate, allow, forbid
// * properties:
//   state, content, openFor, paths
//   where state and content are inherited if absent,
//   and openFor and pats are reset if absent.

function ruleInfo (rule) {
  const info = Object.assign ({}, rule)
  for (let k in info) if (typeof info [k] === 'bigint')
    info [k] = printKind (info [k])
  return info
}

// Rules
// =====

const emptyRule = {}

const documentRule = {
  name: '#document',
  state: E.html,
  content: E.html | C.COMMENT | C.DOCTYPE,
  openFor: ~(C.SPACE | C.DOCTYPE),
  paths: { '#default':'html' },
  siblingRules: true,
}

const fragmentRule = {
  name: '#fragment',
  state: E.html,
  escalate: None,
  content: C.bodyContent,
}

// The 'document rules'

const beforeHtml = {
  content: E.html | C.COMMENT | C.DOCTYPE,
  openFor: ~C.SPACE,
    paths: { '#default':'html' },
  siblingRules: true,
}

const afterHtmlAfterBody = {
  // This should never be reached,
  //  the html tag should never be closed.
  escalate: None,
  content: None,
}

const afterHtmlAfterFrameset = {
  content: C.COMMENT,
}

// The 'html' rules

const inHtmlBeforeHead = {
  content: E.head | C.COMMENT,
  openFor: ~(C.SPACE | C.DOCTYPE),
    paths: { '#default':'head' },
  siblingRules: true,
}

const inHtmlAfterHead = {
  closable: None,
  escalate: None,
  content:  E.body | E.frameset | C.COMMENT | C.SPACE, 
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
  content: E.noframes | C.SPACE | C.COMMENT
}


// Immediate children of the html element

const inHead = {
  closable: None,
  escalate: ~(E.frame | E.head | C.DOCTYPE),
  content: C.meta | C.SPACE | C.COMMENT,
}

const inBody = {
  closable: None,
  escalate: None,
  content: C.bodyContent,
  reparent: E.frameset
}

const inFrameset = {
  escalate: None,
  content:  E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
}


// ### Table Rules

const inTable = {
  state: E.html | E.table,
  closable: None,
  escalate: E.table,
  content: C.tableContent, // TODO also forms, but do foster parent its contents!
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  reparent: C.fosterParented
  // ~(C.tableIsh | E.script | E.template | E.style | C.hiddenInput | C.COMMENT) // REVIEW removing hiddenInput should be automatic?
}

const inCaption = {
  closable: E.table,
  content:  C.bodyContent,
}

const inColgroup = {
  closable: E.table,
  content:  E.col | C.hiddenInput | E.template | C.SPACE,
  escalate: Any,
  reparent: None,
}

const inTableBody = {
  closable: E.table,
  escalate: C.tableIsh &~ (E.tr | C.cell),
  openFor: C.cell,
    paths: { td:'tr', th:'tr' },
  content: C.tbodyContent,
  reparent: C.fosterParented
}

const inTableRow = {
  closable: E.table | C.tbody,
  escalate: C.tableIsh &~ C.cell,
  content: C.trContent,
  reparent: C.fosterParented
}

const inTableCell = {
  closable: E.table | E.tr | C.tbody,
  escalate: C.tableIsh,
  content: C.bodyContent,
}


// ### Select Rules

const inSelect = {
  state: E.html | E.select,
  closable: None,
  escalate: C.closeSelect,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  // TODO should ignore \x00 characters (?)
}

const inOptgroupInSelect = {
  content: E.option | E.script | E.template | C.TEXT | C.SPACE,
  forbid: E.optgroup,
  // TODO should ignore \x00 characters
}

const inOptionInSelect = {
  content: E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
  escalate: C.closeSelect | C.tableIsh | E.option | E.optgroup,
  // TODO should ignore \x00 characters
}

const _tableIsh =
  C.tableIsh &~ (E.colgroup | E.col)

const inSelectInTable = {
  state: E.html | E.select,
  closable: C.tableIsh,
  escalate: C.closeSelect | _tableIsh,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters
}


// ### Content Rules

const inObject = {
  closable: C.tableIsh,
  escalate: C.tableIsh,
  content: C.bodyContent,
}

const _specialBlockRule = {
  content: C.bodyContent
}

const _scope = 
  E.option | E.optgroup | C.other | E.svg | E.math | E.body


// ### Nesting  Restrictions 
// using forbid / allow

const inList = {
  closable: ~(_scope | E.form | E.li),
  allow: C.bodyContent &~ E.button,
}

const dlRule = {
  closable: ~(_scope | E.form),
  allow: C.bodyContent &~ E.button,
}

const inButton = {
  closable: ~(_scope | E.form | E.p),
  allow: C.bodyContent &~ E.button,
  forbid: E.button,
}

const inForm = {
  escalate: ~E.form,
  allow: C.bodyContent &~ (E.button | E.form),
  forbid: E.form
}

const headingRule = {
  closable: ~(_scope | E.form),
  allow: C.bodyContent &~ (E.button | E.form | C.h1_h6),
  forbid: C.h1_h6,
}

const inListItem = {
  closable: ~(_scope),
  allow: C.bodyContent &~ (E.button | E.form | E.li),
  forbid: E.li,
}

const inDtOrDd = {
  closable: ~(_scope),
  allow: C.bodyContent &~ (E.button | E.form | C.dddt),
  forbid: C.dddt,
}

// 

const inParagraph =  {
  state: E.html | E.p,
  closable: ~(_scope),
  allow: C.pContent &~ E.button,
  forbid: ~C.pContent
}

const inOption = {
  closable: ~(E.svg | E.math | E.body),
  allow: (C.pContent | C.h1_h6) &~ E.button, // Well, not the h1_h6 in p...
  forbid: E.option | E.optgroup,
  // TODO should ignore \x00 characters ?
}

const defaultRule = {
  closable: ~(E.svg | E.math | E.form | E.body),
  allow: (C.pContent | C.h1_h6) &~ E.button,
}

const inData = {
  content: C.SPACE | C.RAW,
  escalate: Any,
}

// ### Foreign Content Rules

const inSvg = {
  state: E.svg,
  closable: ~(E.html | E.body),
  escalate: C.breakout, // REVIEW
  content: C.foreignContent,
}

const inSvgInTable = {
  state: E.svg | E.table,
  closable: ~(E.html | E.body),
  escalate: C.breakout | (E.tr | C.tbody | C.cell),
  content: C.foreignContent &~ (E.tr | C.tbody | C.cell),
}

const inMath = {
  state: E.math,
  closable: ~(E.html | E.body),
  escalate: C.breakout | _tableIsh,
  content: C.foreignContent,
}

const inEmbeddedHtml = {
  state: E.html,
  closable: E.svg | E.math, // NB. note that most all other rules disallow closing svg elements!
  escalate: None,
  content: C.bodyContent,
}

const embeddedHtmlInTable = {
  state: E.html | E.table,
  closable: E.svg | E.math | C.tableIsh,  
  escalate: C.tableIsh,
  content: C.bodyContent,
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
    content:  ~(E.body | E.frameset | E.frame | C.RAW),
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
  dt:        inDtOrDd,
  dd:        inDtOrDd,

  form:      inForm,
  button:    inButton,
  p:         inParagraph,

  div:       defaultRule,
  address:   defaultRule,

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
  svg: inSvgInTable,
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
  math: inMath,
  foreignObject: inEmbeddedHtml,
  title: inEmbeddedHtml,
  desc:inEmbeddedHtml,
}

const svgInTableRules = {
  svg:  inSvgInTable,
  math: inMath,//InTable,
  foreignObject: embeddedHtmlInTable,
  title: embeddedHtmlInTable,
  desc:embeddedHtmlInTable,
}

const mathRules = {
  svg:  inSvg,
  math: inMath,
  mi: inEmbeddedHtml,
  mo: inEmbeddedHtml,
  mn: inEmbeddedHtml,
  ms: inEmbeddedHtml,
  mtext: inEmbeddedHtml,
}

// const annotationXmlRule = {
//   name: 'annotationXmlRule',
//   content:None, escalate:None
// }


function childRule (context, name, kind) {
  
  if (context & E.math)
    return kind & C.annotationHtml
      ? (context & E.table ? embeddedHtmlInTable : inEmbeddedHtml)
      : mathRules [name] || inMath

  if (context & E.svg)
    return (context & E.table ? svgInTableRules [name] || inSvgInTable
      : svgRules [name] || inSvg)

  let rule

  if (context & E.table && (rule = tableRules [name]))
    return rule

  if (context & E.select && (rule = selectRules [name]))
    return rule

  // Others

  if (kind & C.h1_h6)
    return headingRule

  if (name in mainRules)
    return mainRules [name]

  if (kind & C._specialBlock)
    return _specialBlockRule

  // The default rule - having an inParagraph alternative

  return context & E.p ? emptyRule : defaultRule
}


function siblingRule ({ kind:pkind, children }, name, kind, _allOpened) {
  if (pkind === None) // '#document'
    return children & E.html
      ? (_allOpened & E.frameset ? afterHtmlAfterFrameset : afterHtmlAfterBody)
      : beforeHtml

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
  documentRule, fragmentRule, childRule, siblingRule, ruleInfo
}