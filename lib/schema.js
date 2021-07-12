const log = console.log.bind (console)

// Element categories
// ==================

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets, categoryFlags are
// used to denote mutually disjoint sets.

const _els =
  `body caption colgroup optgroup option select tr head html script div
  template col button p table li frameset frame noframes math svg br xmp
  a font textarea meta hr style` .split (/\s+/g)

const _cats = {
  TEXT:    `#text`,
  SPACE:   `#space`,
  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,
  _fmt0:   `b big code em i nobr s small strike strong tt u`,
  _void0:  `area wbr`,
  _void1:  `param source track`, 
  _void2:  `input keygen`,
  _void3:  `embed img`,
  _meta0:  `base basefont bgsound link`, // these are void tags
  _meta1:  `noscript title`, // (these aren't)
  _break:  `sub sup var ruby span`,
  _scope:  `applet marquee object`,
  _block1: `blockquote center dl listing menu pre`,
  _block2: `article aside details dir fieldset figcaption
            figure footer form header hgroup main nav
            plaintext section summary address` }

// Create the element- and category-IDs.

let i = 0n
const elementFlags = { }, categoryFlags = { }
for (const k of _els) elementFlags [k] = 1n << i++
for (const k in _cats) categoryFlags [k] = 1n << i++
categoryFlags.other = 1n << i++

// log ('BitSet size:', i)


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element name to the
// bitflags that identify its categories. 

const elementInfo = { }

for (let tagName in elementFlags)
  elementInfo [tagName] = (elementInfo [tagName] || 0n) | elementFlags [tagName]

for (let k in _cats) for (let tagName of _cats [k] .split (/\s+/))
  elementInfo [tagName] = (elementInfo [tagName] || 0n) | categoryFlags [k]


// Print info

function printInfo (info) {
  if (info === 0n) return 'C.none'
  if (info === ~0n) return 'C.any'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in E)
    if (E [k] & _info) r.push ('E.'+k)
  for (let k in categoryFlags)
    if (categoryFlags [k] & _info) r.push ('C0.'+k)
  return `${info < 0n ? '~' : '' }(${r.join (' | ')})`
}


// Unions
// ------

const E = elementFlags
const C = Object.assign ({ }, categoryFlags)
const defaultInfo = C.other

// ### General Element Categories

C.any = -1n
C.none = 0n

C.void =
  C._void0 | C._void1 | C._void2 | C._void3 | C._meta0 | E.meta | E.br | E.col | E.frame | E.hr

C.meta =
  C._meta0 | C._meta1 | E.style | E.script | E.template | E.meta | E.noframes

C.format = 
  C._fmt0 | E.a | E.font

C._specialBlock = 
  C._block1 | C._block2

C.special = 
  C._specialBlock | E.p | E.div | E.li | C.list | C.h1_h6 | C.dddt | E.button
  // REVIEW careful with the old 'button/ infinite loop' bug

C.foreign
  = E.math | E.svg

// ### Formatting and Re-opening

C.formatContext = 
  E.html | E.template | E.caption | E.table | C.cell | C._scope
  // Used by the parser to direct format tag reopening

C.reformat =
  C._void0 | C._void2 | C._scope | C.other | C.format |
  E.select | E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp
  // REVIEW math and svg only in html namespace?
  // TODO the last few exceptions. a / nobr / br?


// ### Content sets

C.bodyContent = 
  ~(E.body | E.html | E.head | E.frameset | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell)

C.pContent = 
  C.bodyContent &~ (E.p | E.div | C._specialBlock | C.dddt | C.h1_h6 | C.list | E.li | E.xmp)

// #### Table content

C.tableContent = 
  E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.SPACE, // TODO add input[type=hidden]

C.trContent = 
  E.script | E.style | E.template | C.cell

C.tbodyContent = 
  E.script | E.style | E.template | C.SPACE | E.tr

C.tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

// ### Breakout tags for svg, math, p and select elements

C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | E.div | C._block1 | C._break | E.meta | C._fmt0 | C.dddt | C.h1_h6 | C.list | C._void3 | E.hr
  // TODO should include <font> if it has a color, face, or size attribute

C.closeSelect =
  C._void2 | E.textarea


// Schema
// ======

// This defines a schema that specifies how to handle
// mismatched tags and tags in invalid contexts. 

// Rules
// -----

const documentRule = {
  allowEnd: C.none,
  escalate: C.none,
  content:  E.html,
  openFor: C.any,
    paths: { '#default':'html' },
}

const bodyRule = {
  allowEnd: C.none,
  escalate: C.none,
  content: C.bodyContent,
}

const headRule = {
  allowEnd: C.none,
  escalate: ~(E.frame | C.SPACE),
  content: C.meta,
}

const afterHeadRule = {
  allowEnd: C.none,
  content:  C.meta | E.body | E.frameset | C.SPACE, 
  openFor: ~E.frame, paths: { '#default':'body' }
  // TODO contentInHead elements should be added to the head
}

const afterFramesetRule = {
  allowEnd: C.none,
  escalate: C.none,
  content: E.noframes | C.SPACE
}

const foreignContentRule = {
  content: ~C.breakout,
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
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.bodyContent,
}

const listRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.li),
  content: C.bodyContent,
}

const buttonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.p),
  content: C.bodyContent &~ E.button,
}

const headingRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.bodyContent &~ C.h1_h6,
}

const liRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.bodyContent &~ E.li,
}

const ddRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.bodyContent &~ C.dddt,
}

const pRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.pContent,
}

// ... p, li, dddt in button

const pInButtonRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: pRule.content &~ E.button
}

const liInButtonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: liRule.content &~ E.button,
}

const ddInButtonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: ddRule.content &~ E.button,
}


// ### Select

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

// #### Tables

const tableRule = {
  allowEnd: C.none,
  escalate: E.table,
  content: C.tableContent,
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  foster: ~(C.tableContent | E.col | E.tr | C.cell | E.table)
}

const tbodyRule = {
  allowEnd: E.table,
  escalate: E.table | E.caption | E.colgroup | E.col | C.tbody,
  openFor: C.cell, paths: { td:'tr', th:'tr' },
  content: C.tbodyContent,
  foster: ~(C.tbodyContent | C.tbody | C.cell | E.table | E.colgroup | E.col  | E.caption)
}

const trRule = {
  allowEnd: E.table | C.tbody,
  escalate: E.table | E.caption | E.colgroup | E.col | C.tbody | E.tr,
  content: C.trContent,
  foster: ~(C.trContent | C.tbody | E.tr | E.table | E.colgroup | E.col | E.caption)
}

const tcellRule = {
  allowEnd: E.table | E.tr | C.tbody,
  escalate: E.table | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  content: C.bodyContent,
}

const colgroupRule = {
  allowEnd: E.table,
  content:  E.col | E.template,
  foster: ~(E.template | C.cell | E.tr | C.tbody | E.table | E.colgroup | E.col)
}

// ### Restrictions / using forbid / allow
// Alright, so this works, but still not too elegant
// currently the only restrictions are
// E.li, C.h1_h6, C.dddt, E.a, E.option, E.optgroup

// Ehm, I think this should be done via the AAA?
const anchorRule = {
  forbid: E.a,
  allow: E.option | E.optgroup,
}

const optionRule = {
  forbid: E.option | E.optgroup,
  escalate: ~C.h1_h6,
  allow: C.h1_h6,
  // TODO should ignore \x00 characters ?
}

const optionInPRule = {
  content: pRule.content &~ (E.option | E.optgroup),
  escalate: C.closeSelect | C.tableIsh | E.option | E.optgroup | C.h1_h6,
}

const optionInSelectRule = {
  content: E.script | E.template | C.TEXT | C.SPACE,
  escalate: C.closeSelect | C.tableIsh | E.option | E.optgroup,
  // TODO should ignore \x00 characters
}

const defaultRule = {
  allow: C.h1_h6 | E.option | E.optgroup, // REVIEW the allow system idea
}

const emptyRule = { }


// The Main Ruleset
// ----------------

const mainRules = {

  html: {
    allowEnd: C.none,
    content: E.head,
    openFor: C.any, paths: { '#default':'head' },
  },

  head: headRule,
  body: bodyRule,

  frameset: {
    allowEnd: C.none,
    content:  E.frameset | E.frame | E.noframes,
    // TODO do not allow the outermost frameset to be closed
  },

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and in fact td is different yet (siblings set the context?)
    allowEnd: C.none,
    content:  C.any,
  },

  applet:  appletRule,
  object:  appletRule,
  marquee: appletRule,
  svg:     foreignContentRule,
  math:    foreignContentRule,
  select:  selectRule,
  div:     defaultRule,
  address: defaultRule,
  dl:      dlRule,
  ol:      listRule,
  ul:      listRule,
  dd:      ddRule,
  dt:      ddRule,
  button:  buttonRule,
  a:       anchorRule,

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


// The SVG and MathML rulesets
// ---------------------------

const svgRules = {
  foreignObject: bodyRule,
  desc: bodyRule, // FIXME in table, add table-like things to escalate
  title: bodyRule,
  // TODO null chars should be converted to u+FFFD
}

const mathRules = {
  mi: bodyRule,
  mo: bodyRule,
  mn: bodyRule,
  ms: bodyRule,
  mtext: bodyRule,
  'annotation-xml': bodyRule,
  // TODO annotation-xml should check the encoding attribute
  // TODO null chars should be converted to u+FFFD
}


// getRule
// -------
// This implements the schema state-machine / tree automaton

function getRule ({ closable }, name, flags) {

  if (closable & E.svg)
    return svgRules [name] || foreignContentRule

  if (closable & E.math)
    return mathRules [name] || foreignContentRule

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
  elements: elementFlags, tagNameSets:C,
  SVGTagNameAdjustments,
  elementInfo, defaultInfo, printInfo,
  defaultRule, documentRule, afterHeadRule, afterFramesetRule, getRule
}