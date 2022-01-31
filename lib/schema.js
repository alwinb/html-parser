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
//   allowEnd, escalate, allow, forbid
// * properties:
//   namespace, content, openFor, paths, redirect
//   where namespace and content are inherited if absent,
//   and paths and redirect, are reset to None if absent.

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
  namespace:E.html,
  content: E.html | C.COMMENT,
  openFor: ~C.SPACE,
  paths: { '#default':'html' },
  siblingRules: true,
}

const fragmentRule = {
  name: '#fragment',
  namespace:E.html,
  escalate: None,
  content: C.bodyContent,
}

// The 'document rules'

const beforeHtml = {
  content: E.html | C.COMMENT,
  openFor: ~C.SPACE,
    paths: { '#default':'html' },
  siblingRules: true,
}

const afterAfterBody = {
  // This should never be reached,
  //  the html tag should never be closed.
  escalate: None,
  content: None,
}

const afterAfterFrameset = {
  content: C.COMMENT,
  // redirect: E.noframes | C.SPACE | C.RAW,
}

// The 'html' rules

const beforeHead = {
  content: E.head | C.COMMENT,
  openFor: ~C.SPACE,
    paths: { '#default':'head' },
  siblingRules: true,
}

const afterHead = {
  allowEnd: None,
  escalate: None,
  content:  E.body | E.frameset | C.COMMENT | C.SPACE, 
  openFor: ~(C.metaRedirect | E.frame | E.frameset | C.SPACE), 
    paths: { '#default':'body' },
  reparent: C.metaRedirect,
  // reparent: C.SPACE,
  siblingRules: true,
}

const afterBody = {
  // This should never be reached,
  //  the body tag should never be closed.
  allowEnd: None,
  escalate: None,
}

const afterFrameset = {
  escalate: None,
  content: E.noframes | C.SPACE | C.COMMENT
}


// Immediate children of the html element

const inHead = {
  allowEnd: None,
  escalate: ~(E.frame | E.head),
  content: C.meta | C.SPACE | C.COMMENT,
}

const inBody = {
  allowEnd: None,
  escalate: None,
  content: C.bodyContent,
  reparent: E.frameset
}

const inFrameset = {
  escalate: None,
  content:  E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
}

//





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
  allowEnd: C.tableIsh,
  escalate: C.closeSelect | _tableIsh,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters
}


// ### Content Rules

const inObject = {
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

const inList = {
  allowEnd: ~(_scope | E.form | E.li),
  allow: C.bodyContent &~ E.button,
}

const dlRule = {
  allowEnd: ~(_scope | E.form),
  allow: C.bodyContent &~ E.button,
}

const inButton = {
  allowEnd: ~(_scope | E.form | E.p),
  allow: C.bodyContent &~ E.button,
  forbid: E.button,
}

const inForm = {
  escalate: ~E.form,
  allow: C.bodyContent &~ (E.button | E.form),
  forbid: E.form
}

const headingRule = {
  allowEnd: ~(_scope | E.form),
  allow: C.bodyContent &~ (E.button | E.form | C.h1_h6),
  forbid: C.h1_h6,
}

const inListItem = {
  allowEnd: ~(_scope),
  allow: C.bodyContent &~ (E.button | E.form | E.li),
  forbid: E.li,
}

const inDtOrDd = {
  allowEnd: ~(_scope),
  allow: C.bodyContent &~ (E.button | E.form | C.dddt),
  forbid: C.dddt,
}

// 

const inParagraph =  {
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

const inData = {
  content: C.SPACE | C.RAW,
  escalate: Any,
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

const inEmbeddedHtml = {
  namespace: E.html,
  allowEnd: E.svg | E.math, // NB. note that most all other rules disallow closing svg elements!
  escalate: None,
  content: C.bodyContent,
}

const embeddedHtmlInTable = {
  namespace: E.html,
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
    content:  ~(E.body | E.frameset | E.frame | C.RAW),
  },

  applet:    inObject,
  object:    inObject,
  marquee:   inObject,

  svg:       inSvg,
  math:      inMath,

  select:    inSelect,

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

// ### Table ruleset - differences with main

const tableRules = {
  
  
}


// ### SVG and MathML rulesets

const svgRules = {
  svg:  inSvg,
  math: inMath,
  foreignObject: inEmbeddedHtml,
  title: inEmbeddedHtml,
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


function childRule (frame, name, kind) {
  const { namespace, closable, kind:pkind } = frame
  // namespace based
  if (namespace & E.math)
    return kind & C.annotationHtml
      ? (closable & E.table ? embeddedHtmlInTable : inEmbeddedHtml)
      : mathRules [name] || inMath

  if (namespace & E.svg)
    return name === 'desc'
      ? (closable & E.table ? embeddedHtmlInTable : inEmbeddedHtml)
      : svgRules [name] || inSvg

  // Rules that have 'in button' alternatives\
  // TODO undo that and use restrictions again instead?
  // if (kind & E.p)
  //   return closable & E.button ? pInButton : inParagraph

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