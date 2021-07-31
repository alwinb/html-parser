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
// -----

const emptyRule = {}

const htmlRule = {
  allowEnd: None,
  escalate: None,
  content: E.head | C.COMMENT,
  openFor: ~(C.SPACE),
    paths: { '#default':'head' },
}

const headRule = {
  allowEnd: None,
  escalate: ~(E.frame | E.head),
  content: C.meta | C.SPACE | C.COMMENT,
}

const afterHeadRule = {
  allowEnd: None,
  content:  E.body | E.frameset | C.SPACE | C.COMMENT, 
  openFor: ~(C.meta | E.frame | C.SPACE | E.frameset), 
    paths: { '#default':'body' },
  redirect: C.meta
}

const bodyRule = {
  allowEnd: None,
  escalate: None,
  content: C.bodyContent,
}

const framesetRule = {
  allowEnd: None,
  escalate: None,
  content:  E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
}

const afterFramesetRule = {
  allowEnd: None,
  escalate: None,
  content: E.noframes | C.SPACE | C.COMMENT
}

const svgRule = {
  namespace: E.svg,
  allowEnd: C.tableIsh,
  escalate: C.breakout | C.tableIsh, // REVIEW this means it will escalate on <table>
  content: ~C.breakout,
}

const mathRule = {
  namespace: E.math,
  allowEnd: None,
  escalate: C.breakout | C.tableIsh,
  content: ~C.breakout,
}

const dataRule = {
  content: C.SPACE | C.TEXT,
  escalate: Any,
}


// TODO new problem... <td> in <table><td><svg><desc> should escalate to the table, but <svg><td> is ok
// Also, <svg> in table should be redirect parented, but </svg> should not
// so.. figure out what end-tags should be redirect parented and which ones should not.

const embeddedHtmlRule = {
  namespace: None, // NB. note that most all other rules disallow closing svg elements!
  allowEnd: E.svg | E.math | C.tableIsh,  
  escalate: None, 
  content: C.bodyContent,
}

const appletRule = {
  allowEnd: C.tableIsh,
  escalate: C.tableIsh,
  content: C.bodyContent,
}

const _specialBlockRule = {
  content: C.bodyContent
}

const dlRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: C.bodyContent,
}

const listRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.li | E.svg | E.math),
  content: C.bodyContent,
}

const buttonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.p | E.svg | E.math),
  content: C.bodyContent &~ E.button,
}

const headingRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: C.bodyContent &~ C.h1_h6,
}

const liRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: C.bodyContent &~ E.li,
}

const ddRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: C.bodyContent &~ C.dddt,
}

const pRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: C.pContent,
}

// ... p, li, dddt in button

const pInButtonRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: pRule.content &~ E.button
}

const liInButtonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: liRule.content &~ E.button,
}

const ddInButtonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.svg | E.math),
  content: ddRule.content &~ E.button,
}


// ### Select Rules

const selectRule = {
  allowEnd: C.tableIsh,
  escalate: C.closeSelect,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters (?)
}

const selectInTableRule = {
  allowEnd: C.tableIsh,
  escalate: C.closeSelect | C.tableIsh,
  content: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters
}

const selectOptgroupRule = {
  content: E.option | E.script | E.template | C.TEXT | C.SPACE,
  // TODO should ignore \x00 characters
}


// #### Table Rules

const tableIsh2 = 
  E.table | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell

const tableRule = {
  allowEnd: None,
  escalate: E.table,
  content: C.tableContent,
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  redirect: ~(tableIsh2 | C.hiddenInput | C.COMMENT) // REVIEW removing hiddenInput should be automatic?
}

const tbodyRule = {
  allowEnd: E.table,
  escalate: tableIsh2 &~ (E.tr | C.cell),
  openFor: C.cell,
    paths: { td:'tr', th:'tr' },
  content: C.tbodyContent,
  redirect: ~(tableIsh2 | C.hiddenInput | C.COMMENT) // NB likewise
}

const trRule = {
  allowEnd: E.table | C.tbody,
  escalate: tableIsh2 &~ C.cell,
  content: C.trContent,
  redirect: ~(tableIsh2 | C.hiddenInput | C.COMMENT) // NB likewise
}

const tcellRule = {
  allowEnd: E.table | E.tr | C.tbody,
  escalate: tableIsh2,
  content: C.bodyContent,
}

const colgroupRule = {
  allowEnd: E.table,
  // escalate: tableIsh2 | C.TEXT | C.SPACE,
  content:  E.col | C.hiddenInput | E.template,
  redirect: ~(tableIsh2 | C.hiddenInput | C.COMMENT) // NB likewise
}


// ### Restrictions / using forbid / allow
// Alright, so this works, but still not too elegant
// currently the only restrictions are
// E.li, C.h1_h6, C.dddt, E.a, E.option, E.optgroup

const optionRule = {
  allowEnd: ~(E.svg | E.math),
  forbid: E.option | E.optgroup,
  escalate: ~C.h1_h6,
  allow: C.h1_h6,
  // TODO should ignore \x00 characters ?
}

const optionInPRule = {
  content: pRule.content &~ (E.option | E.optgroup),
  // escalate: C.tableIsh | E.option | E.optgroup | C.h1_h6,
}

const optionInSelectRule = {
  content: E.script | E.template | C.TEXT | C.SPACE,
  escalate: C.closeSelect | C.tableIsh | E.option | E.optgroup,
  // TODO should ignore \x00 characters
}

const defaultRule = {
  allowEnd: ~(E.svg | E.math),
  allow: C.h1_h6 | E.option | E.optgroup, // REVIEW the allow system idea
}


// RuleSets
// --------

// ### The Main Ruleset

const mainRules = {

  html: htmlRule,
  head: headRule,
  body: bodyRule,
  frameset: framesetRule,

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and in fact td is different yet (siblings set the context?)
    allowEnd: None,
    content:  ~(E.body | E.frameset | E.frame),
  },

  applet:  appletRule,
  object:  appletRule,
  marquee: appletRule,
  svg:     svgRule,
  math:    mathRule,
  select:  selectRule,
  div:     defaultRule,
  address: defaultRule,
  dl:      dlRule,
  ol:      listRule,
  ul:      listRule,
  dd:      ddRule,
  dt:      ddRule,
  button:  buttonRule,

  style:     dataRule, // rawtext
  script:    dataRule, 
  xmp:       dataRule,
  iframe:    dataRule,
  noembed:   dataRule,
  noframes:  dataRule,
  textarea:  dataRule, // rcdata
  title:     dataRule, // rcdata
  plaintext: dataRule, // plain text
  '#comment': dataRule, // comment data

  // Tables

  table: tableRule,

  caption: {
    allowEnd: E.table,
    content:  C.bodyContent,
  },

  colgroup: colgroupRule,
  thead: tbodyRule,
  tbody: tbodyRule,
  tfoot: tbodyRule,
  tr:    trRule,
  th:    tcellRule,
  td:    tcellRule,
}


// SVG and MathML rulesets
// -----------------------

const svgRules = {
  foreignObject: embeddedHtmlRule,
  desc: embeddedHtmlRule, // FIXME in table, add table-like things to escalate
  title: bodyRule,
  svg: svgRule,
  math: mathRule,
  // TODO null chars should be converted to u+FFFD
}

const mathRules = {
  mi: embeddedHtmlRule,
  mo: embeddedHtmlRule,
  mn: embeddedHtmlRule,
  ms: embeddedHtmlRule,
  mtext: embeddedHtmlRule,
  svg: svgRule,
  math: mathRule,
  'annotation-xml': mathRule //foreignForeignRule,
  // NB annotation-xml is special-cased in getRule
  // TODO null chars should be converted to u+FFFD
}


// getRule
// -------
// This implements the schema state-machine / tree automaton

// const annotationXmlRule = { name: 'annotationXmlRule', content:None, escalate:None }

function getRule ({ namespace, closable }, name, kind, allSeen) {

  // log (`getRule for ${name} in ${printKind (namespace)}, seen: ${printKind (allSeen)}`)

  if (namespace & E.math)
    return kind & C.annotationHtml ? embeddedHtmlRule
      : mathRules [name] || mathRule

  if (namespace & E.svg)
    return svgRules [name] || svgRule

  if (kind & E.html && allSeen & E.frameset)
    return afterFramesetRule

  else if (kind & E.html && allSeen & E.head)
    return afterHeadRule

  if (kind & C.h1_h6)
    return headingRule

  // Rules that have 'in button' alternatives\
  // TODO undo that and use restrictions again instead?
  if (kind & E.p)
    return closable & E.button ? pInButtonRule : pRule

  if (kind & E.li)
    return closable & E.button ? liInButtonRule : liRule

  if (kind & C.dddt)
    return closable & E.button ? ddInButtonRule : ddRule

  if (kind & E.select)
    return closable & E.table ? selectInTableRule : selectRule

  if (kind & E.option)
    return closable & E.select ? optionInSelectRule
      : closable & E.p ? optionInPRule
      : optionRule

  if (kind & E.optgroup)
    return closable & E.select ? selectOptgroupRule : defaultRule

  if (name in mainRules)
    return mainRules [name]

  if (kind & C._specialBlock)
    return _specialBlockRule

  return closable & E.p ? emptyRule : defaultRule
}


// Extras: TagName Adjustments
// ---------------------------

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
// -------

module.exports = { 
  SVGTagNameAdjustments,
  defaultRule, getRule
}