import { E, C, Any, None, printKind } from './categories.js'
const log = console.log.bind (console)

// Schema
// ======

// This defines a schema that specifies how to handle
// mismatched tags and tags in invalid contexts. 

// Rules may declare:
// * modifiers:
//   allowEnd, escalate, allow, forbid
// * properties:
//   namespace, content, openFor, paths, redirect
//   where namespace and content are inherited if absent,
//   and paths and redirect, are reset to None if absent.


// Rules
// =====

const emptyRule = {}

const documentRule = {
  name: '#document',
  content: E.html | C.COMMENT,
  openFor: ~C.SPACE,
  paths: { '#default':'html' },
  siblingRules: true,
}

const fragmentRule = {
  name: '#fragment',
  escalate: None,
  content: C.bodyContent,
}

// 

const beforeHtml = {
  content: E.html | C.COMMENT,
  openFor: ~C.SPACE,
  paths: { '#default':'html' },
  siblingRules: true,
}

const beforeHead = {
  content: E.head | C.COMMENT,
  openFor: ~C.SPACE,
    paths: { '#default':'head' },
  siblingRules: true,
}

const inHead = {
  allowEnd: None,
  escalate: ~(E.frame | E.head),
  content: C.meta | C.SPACE | C.COMMENT,
}

const afterHead = {
  escalate: None,
  content:  E.body | E.frameset | C.COMMENT, 
  openFor: ~(C.metaRedirect | E.frame | E.frameset | C.SPACE | C.DATA), 
    paths: { '#default':'body' },
  redirect: C.metaRedirect | C.DATA,
  reparent: C.SPACE,
  siblingRules: true,
}

const inBody = {
  escalate: None,
  content: C.bodyContent,
  reparent: E.frameset
}

const inData = {
  content: C.SPACE | C.DATA,
  escalate: Any,
}

const afterBody = {
  content: C.COMMENT,
  _reopen: ~C.COMMENT,
}

const afterAfterBody = {
  escalate: None,
  content: C.COMMENT,
  _reopen: ~C.COMMENT,
}

const inFrameset = {
  escalate: None,
  content:  E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
}

const afterFrameset = {
  content: E.noframes | C.SPACE | C.COMMENT
}

const afterAfterFrameset = {
  content: C.COMMENT,
  redirect: E.noframes | C.SPACE | C.DATA,
}


// ### Table Rules

const inTable = {
  allowEnd: None,
  escalate: E.table,
  content: C.tableContent, // TODO also forms, but do foster parent its contents!
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  reparent: C.fosterParented
  // ~(C.tableIsh | E.script | E.template | E.style | C.hiddenInput | C.COMMENT) // REVIEW removing hiddenInput should be automatic?
}

const inCaption = {
  allowEnd: E.table,
  content:  C.bodyContent,
}

const inColgroup = {
  allowEnd: E.table,
  content:  E.col | C.hiddenInput | E.template | C.SPACE,
  escalate: Any,
  reparent: None,
}

const inTableBody = {
  allowEnd: E.table,
  escalate: C.tableIsh &~ (E.tr | C.cell),
  openFor: C.cell,
    paths: { td:'tr', th:'tr' },
  content: C.tbodyContent,
  reparent: C.fosterParented
}

const inTableRow = {
  allowEnd: E.table | C.tbody,
  escalate: C.tableIsh &~ C.cell,
  content: C.trContent,
  reparent: C.fosterParented
}

const inTableCell = {
  allowEnd: E.table | E.tr | C.tbody,
  escalate: C.tableIsh,
  content: C.bodyContent,
}


// ### Select Rules

const inSelect = {
  allowEnd: None,
  escalate: C.closeSelect,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters (?)
}

const inOptgroupInSelect = {
  content: E.option | E.script | E.template | C.TEXT | C.SPACE,
  forbid: E.optgroup,
  // TODO should ignore \x00 characters
}

const inOptionInSelect = {
  content: E.script | E.template | C.TEXT | C.SPACE,
  escalate: C.closeSelect | C.tableIsh | E.option | E.optgroup,
  // TODO should ignore \x00 characters
}

const _tableIsh =
  C.tableIsh &~ (E.colgroup | E.col)

const inSelectInTable = {
  allowEnd: C.tableIsh,
  escalate: C.closeSelect | _tableIsh,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters
}


// ### Content Rules

const appletRule = {
  allowEnd: C.tableIsh,
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

const listRule = {
  allowEnd: ~(_scope | E.form | E.li),
  allow: C.bodyContent &~ E.button,
}

const dlRule = {
  allowEnd: ~(_scope | E.form),
  allow: C.bodyContent &~ E.button,
}

const buttonRule = {
  allowEnd: ~(_scope | E.form | E.p),
  allow: C.bodyContent &~ E.button,
  forbid: E.button,
}

const formRule = {
  escalate: ~E.form,
  allow: C.bodyContent &~ (E.button | E.form),
  forbid: E.form
}

const headingRule = {
  allowEnd: ~(_scope | E.form),
  allow: C.bodyContent &~ (E.button | E.form | C.h1_h6),
  forbid: C.h1_h6,
}

const liRule = {
  allowEnd: ~(_scope),
  allow: C.bodyContent &~ (E.button | E.form | E.li),
  forbid: E.li,
}

const ddRule = {
  allowEnd: ~(_scope),
  allow: C.bodyContent &~ (E.button | E.form | C.dddt),
  forbid: C.dddt,
}

// 

const pRule =  {
  allowEnd: ~(_scope),
  allow: C.pContent &~ E.button,
  forbid: ~C.pContent
}

const optionRule = {
  allowEnd: ~(E.svg | E.math | E.body),
  allow: (C.pContent | C.h1_h6) &~ E.button, // Well, not the h1_h6 in p...
  forbid: E.option | E.optgroup,
  // TODO should ignore \x00 characters ?
}

const defaultRule = {
  allowEnd: ~(E.svg | E.math | E.form | E.body),
  allow: (C.pContent | C.h1_h6) &~ E.button,
}


// ### Foreign Content Rules

const inSvg = {
  namespace: E.svg,
  allowEnd: ~(E.html | E.body),
  escalate: C.breakout, // REVIEW
  content: C.foreignContent,
}

const svgInTable = {
  namespace: E.svg,
  allowEnd: ~(E.html | E.body),
  escalate: C.breakout,
  content: C.foreignContent,
}

const inMath = {
  namespace: E.math,
  allowEnd: ~(E.html | E.body),
  escalate: C.breakout | _tableIsh,
  content: C.foreignContent,
}

const embeddedHtmlRule = {
  namespace: None,
  allowEnd: E.svg | E.math, // NB. note that most all other rules disallow closing svg elements!
  escalate: None,
  content: C.bodyContent,
}

const embeddedHtmlInTable = {
  namespace: None, // NB. note that most all other rules disallow closing svg elements!
  allowEnd: E.svg | E.math | C.tableIsh,  
  escalate: C.tableIsh,
  content: C.bodyContent,
}


// RuleSets
// ========

// ### The Main RuleSet

const mainRules = {

  html:      beforeHead,
  head:      inHead,
  body:      inBody,
  frameset:  inFrameset,

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and in fact td is different yet (siblings set the context?)
    allowEnd: None,
    content:  ~(E.body | E.frameset | E.frame | C.DATA),
  },

  applet:    appletRule,
  object:    appletRule,
  marquee:   appletRule,

  svg:       inSvg,
  math:      inMath,

  select:    inSelect,

  dl:        dlRule,
  ol:        listRule,
  ul:        listRule,
  li:        liRule,
  dd:        ddRule,
  dt:        ddRule,

  form:      formRule,
  button:    buttonRule,
  p:         pRule,

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

// ### Table ruleset - differences with main

const tableRules = {
  
  
}


// ### SVG and MathML rulesets

const svgRules = {
  svg:  inSvg,
  math: inMath,
  foreignObject: embeddedHtmlRule,
  title: embeddedHtmlRule,
}

const mathRules = {
  svg:  inSvg,
  math: inMath,
  mi: embeddedHtmlRule,
  mo: embeddedHtmlRule,
  mn: embeddedHtmlRule,
  ms: embeddedHtmlRule,
  mtext: embeddedHtmlRule,
}


// ### ruleInfo

function ruleInfo (rule) {
  const info = Object.assign ({}, rule)
  for (let k in info) if (typeof info [k] === 'bigint')
    info [k] = printKind (info [k])
  return info
}


// Schema
// ======

// This implements the schema state-machine / tree automaton

// const annotationXmlRule = { name: 'annotationXmlRule', content:None, escalate:None }

function childRule ({ namespace, closable }, name, kind) {

  // namespace based
  if (namespace & E.math)
    return kind & C.annotationHtml
      ? (closable & E.table ? embeddedHtmlInTable : embeddedHtmlRule)
      : mathRules [name] || inMath

  if (namespace & E.svg)
    return name === 'desc'
      ? (closable & E.table ? embeddedHtmlInTable : embeddedHtmlRule)
      : svgRules [name] || inSvg

  // Rules that have 'in button' alternatives\
  // TODO undo that and use restrictions again instead?

  // if (kind & E.p)
  //   return closable & E.button ? pInButton : pRule

  // Rules that have 'inTable' alternatives

  if (kind & E.svg)
    return closable & E.table ? svgInTable : inSvg

  if (kind & E.select)
    return closable & E.table ? inSelectInTable : inSelect

  // Rules that have 'inSelect' alternatives

  if (kind & E.option)
    return closable & E.select ? inOptionInSelect : optionRule

  if (kind & E.optgroup)
    return closable & E.select ? inOptgroupInSelect : defaultRule

  // Others

  // general rules
  if (kind & C.h1_h6)
    return headingRule

  if (name in mainRules)
    return mainRules [name]

  if (kind & C._specialBlock)
    return _specialBlockRule

  return closable & E.p ? emptyRule : defaultRule
}


function siblingRule ({ kind:pkind, children }, name, kind, _allOpened) {
  if (pkind === None) // '#document'
    return children & E.html
      ? (_allOpened & E.frameset ? afterAfterFrameset : afterAfterBody)
      : beforeHtml

  if (pkind & E.html)
    return children & E.frameset ? afterFrameset
      : children & E.body ? afterBody
      : children & E.head ? afterHead
      : beforeHead

  return null // NB signals 'no update' which at the moment is different from the empty rule!
}


// Exports
// =======

export { 
  documentRule, fragmentRule, childRule, siblingRule, ruleInfo
}