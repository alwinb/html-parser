const log = console.log.bind (console)
const { E, C, Any, None, printKind } = require ('./categories')

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
  content: C.tableContent,
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

const formRule = {
  escalate: None, // TODO, research the spec
  content: C.bodyContent &~ E.form
}

const _specialBlockRule = {
  content: C.bodyContent
}

const dlRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body | E.form),
  content: C.bodyContent,
}

const listRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body | E.form | E.li),
  content: C.bodyContent,
}

const buttonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body | E.form | E.p),
  content: C.bodyContent &~ E.button,
}

const headingRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body | E.form),
  content: C.bodyContent &~ C.h1_h6,
}

const liRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body),
  content: C.bodyContent &~ E.li,
}

const ddRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body),
  content: C.bodyContent &~ C.dddt,
}

const pRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math | E.body),
  content: C.pContent,
}

// ... p, li, dddt in button

const pInButton =  {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: pRule.content &~ E.button
}

const liInButton = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: liRule.content &~ E.button,
}

const ddInButton = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: ddRule.content &~ E.button,
}


// ### Restrictions / using forbid / allow
// Alright, so this works, but still not too elegant
// currently the only restrictions are
// E.li, C.h1_h6, C.dddt, E.a, E.option, E.optgroup

const optionRule = {
  allowEnd: ~(E.svg | E.math | E.body),
  forbid: E.option | E.optgroup,
  escalate: ~C.h1_h6,
  allow: C.h1_h6,
  // TODO should ignore \x00 characters ?
}

const optionInPRule = {
  content: pRule.content &~ (E.option | E.optgroup),
  // escalate: C.tableIsh | E.option | E.optgroup | C.h1_h6,
}

const optionInSelect = {
  content: E.script | E.template | C.TEXT | C.SPACE,
  escalate: C.closeSelect | C.tableIsh | E.option | E.optgroup,
  // TODO should ignore \x00 characters
}

const defaultRule = {
  allowEnd: ~(E.svg | E.math | E.form | E.body),
  allow: C.h1_h6 | E.option | E.optgroup, // REVIEW the allow system idea
  forbid: ~C.bodyContent
}


// ### Foreign Content Rules

const inSvg = {
  namespace: E.svg,
  allowEnd: ~(E.html | E.body),
  escalate: C.breakout, // REVIEW
  content: ~C.breakout,
}

const svgInTable = {
  namespace: E.svg,
  allowEnd: ~(E.html | E.body),
  escalate: C.breakout,
  content: ~C.breakout,
}

const inMath = {
  namespace: E.math,
  allowEnd: ~(E.html | E.body),
  escalate: C.breakout | _tableIsh,
  content: ~C.breakout,
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
    content:  ~(E.body | E.frameset | E.frame),
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
  dd:        ddRule,
  dt:        ddRule,
  button:    buttonRule,
  form:      formRule,

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
  // TODO null chars should be converted to u+FFFD
}

const mathRules = {
  svg:  inSvg,
  math: inMath,
  mi: embeddedHtmlRule,
  mo: embeddedHtmlRule,
  mn: embeddedHtmlRule,
  ms: embeddedHtmlRule,
  mtext: embeddedHtmlRule,
  // TODO null chars should be converted to u+FFFD
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

  if (kind & E.p)
    return closable & E.button ? pInButton : pRule

  if (kind & E.li)
    return closable & E.button ? liInButton : liRule

  if (kind & C.dddt)
    return closable & E.button ? ddInButton : ddRule

  // Rules that have 'inTable' alternatives

  if (kind & E.svg)
    return closable & E.table ? svgInTable : inSvg

  if (kind & E.select)
    return closable & E.table ? inSelectInTable : inSelect

  // Rules that have 'inSelect' alternatives

  if (kind & E.option)
    return closable & E.select ? optionInSelect
      : closable & E.p ? optionInPRule
      : optionRule

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



// Extras: TagName Adjustments
// ===========================

const SVGTagNameAdjustments = {
  altglyph:            'altGlyph',
  altglyphdef:         'altGlyphDef',
  altglyphitem:        'altGlyphItem',
  animatecolor:        'animateColor',
  animatemotion:       'animateMotion',
  animatetransform:    'animateTransform',
  clippath:            'clipPath',
  feblend:             'feBlend',
  fecolormatrix:       'feColorMatrix',
  fecomponenttransfer: 'feComponentTransfer',
  fecomposite:         'feComposite',
  feconvolvematrix:    'feConvolveMatrix',
  fediffuselighting:   'feDiffuseLighting',
  fedisplacementmap:   'feDisplacementMap',
  fedistantlight:      'feDistantLight',
  fedropshadow:        'feDropShadow',
  feflood:             'feFlood',
  fefunca:             'feFuncA',
  fefuncb:             'feFuncB',
  fefuncg:             'feFuncG',
  fefuncr:             'feFuncR',
  fegaussianblur:      'feGaussianBlur',
  feimage:             'feImage',
  femerge:             'feMerge',
  femergenode:         'feMergeNode',
  femorphology:        'feMorphology',
  feoffset:            'feOffset',
  fepointlight:        'fePointLight',
  fespecularlighting:  'feSpecularLighting',
  fespotlight:         'feSpotLight',
  fetile:              'feTile',
  feturbulence:        'feTurbulence',
  foreignobject:       'foreignObject',
  glyphref:            'glyphRef',
  lineargradient:      'linearGradient',
  radialgradient:      'radialGradient',
  textpath:            'textPath',
}


// Exports
// =======

module.exports = { 
  SVGTagNameAdjustments,
  documentRule, fragmentRule, childRule, siblingRule, ruleInfo
}