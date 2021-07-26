const log = console.log.bind (console)
const { E, C } = require ('./categories')

// Schema
// ======

// This defines a schema that specifies how to handle
// mismatched tags and tags in invalid contexts. 

// Rules may declare:
// * modifiers:
//   allowEnd, escalate, allow, forbid
// * properties:
//   foreign, content, openFor, paths, foster
//   where foreign and content are inherited if absent,
//   and paths and foster, are reset to C.none if absent.

// The 'foreign' flag is experimental; it is added because the
// 'mode' and the closable elements do not always agree. 
// For example, <svg><desc> has <svg> as closable, but it is not in svg 'insertion-mode'.

// Rules
// -----

const emptyRule = {}

const documentRule = {
  allowEnd: C.none,
  escalate: C.none,
  content:  E.html,
  openFor: C.any,
    paths: { '#default':'html' },
}

const htmlRule = {
  allowEnd: C.none,
  escalate: C.none,
  content: E.head,
  openFor: ~(C.SPACE),
    paths: { '#default':'head' },
}

const headRule = {
  allowEnd: C.none,
  escalate: ~E.frame,
  content: C.meta | C.SPACE, // TODO head after head does not allow space, or..
}

const afterHeadRule = {
  allowEnd: C.none,
  content:  E.body | E.frameset | C.SPACE, 
  openFor: ~(C.meta | E.frame | C.SPACE), 
    paths: { '#default':'body' },
  foster: C.meta // well, space should be fostered to html, C.meta to head ...
}

const bodyRule = {
  allowEnd: C.none,
  escalate: C.none,
  content: C.bodyContent,
}

const framesetRule = {
  allowEnd: C.none,
  escalate: C.none,
  content:  E.frameset | E.frame | E.noframes | C.SPACE,
}

const afterFramesetRule = {
  allowEnd: C.none,
  escalate: C.none,
  content: E.noframes | C.SPACE
}

const foreignRule = {
  foreign: true,
  content: ~C.breakout,
}

//

// TODO new problem... <td> in <table><td><svg><desc> should escalate to the table, but <svg><td> is ok
// Also, <svg> in table should be foster parented, but </svg> should not
// so.. figure out what end-tags should be foster parented and which ones should not.

const SVGForeignRule = {
  foreign: false, // NB. note that most all other rules disallow closing svg elements!
  allowEnd: E.svg,  
  // escalate: C.none,
  content: C.bodyContent,
}

const mathForeignRule = {
  foreign: false, // NB. note that most all other rules disallow closing math elements!
  allowEnd: E.math,  
  // escalate: C.none,
  content: C.bodyContent,
}

//

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
  allowEnd: C.none,
  escalate: E.table,
  content: C.tableContent,
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  foster: ~tableIsh2
}

const tbodyRule = {
  allowEnd: E.table,
  escalate: tableIsh2 &~ (E.tr | C.cell),
  openFor: C.cell,
    paths: { td:'tr', th:'tr' },
  content: C.tbodyContent,
  foster: ~tableIsh2
}

const trRule = {
  allowEnd: E.table | C.tbody,
  escalate: tableIsh2 &~ C.cell,
  content: C.trContent,
  foster: ~tableIsh2
}

const tcellRule = {
  allowEnd: E.table | E.tr | C.tbody,
  escalate: tableIsh2,
  content: C.bodyContent,
}

const colgroupRule = {
  allowEnd: E.table,
  content:  E.col | E.template,
  foster: ~tableIsh2
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
    allowEnd: C.none,
    content:  C.any,
  },

  applet:  appletRule,
  object:  appletRule,
  marquee: appletRule,
  svg:     foreignRule,
  math:    foreignRule,
  select:  selectRule,
  div:     defaultRule,
  address: defaultRule,
  dl:      dlRule,
  ol:      listRule,
  ul:      listRule,
  dd:      ddRule,
  dt:      ddRule,
  button:  buttonRule,

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
  foreignObject: SVGForeignRule,
  desc: SVGForeignRule, // FIXME in table, add table-like things to escalate
  title: bodyRule,
  // TODO null chars should be converted to u+FFFD
}

const mathRules = {
  mi: mathForeignRule,
  mo: mathForeignRule,
  mn: mathForeignRule,
  ms: mathForeignRule,
  mtext: mathForeignRule,
  'annotation-xml': mathForeignRule,
  // TODO annotation-xml should check the encoding attribute
  // TODO null chars should be converted to u+FFFD
}


// getRule
// -------
// This implements the schema state-machine / tree automaton

function getRule ({ foreign, closable }, name, flags) {

  if (foreign) {
    const rules = closable & E.svg ? svgRules : mathRules
    return rules [name] || foreignRule
  }

  if (flags & C.h1_h6)
    return headingRule

  // Rules that have 'in button' alternatives\
  if (flags & E.p)
    return closable & E.button ? pInButtonRule : pRule

  if (flags & E.li)
    return closable & E.button ? liInButtonRule : liRule

  if (flags & C.dddt)
    return closable & E.button ? ddInButtonRule : ddRule


  if (flags & E.select)
    return closable & E.table ? selectInTableRule : selectRule

  if (flags & E.option)
    return closable & E.select ? optionInSelectRule
      : closable & E.p ? optionInPRule
      : optionRule

  if (flags & E.optgroup)
    return closable & E.select ? selectOptgroupRule : defaultRule

  if (name in mainRules)
    return mainRules [name]

  if (flags & C._specialBlock)
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
  defaultRule, documentRule, afterHeadRule, afterFramesetRule, getRule
}