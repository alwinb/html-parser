const log = console.log.bind (console)

// Element categories
// ==================

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets, categoryFlags are
// used to denote mutually disjoint sets.

const _els =
  `body caption colgroup optgroup option select tr head html script div
  template col button p table li frameset frame noframes math svg br xmp
  a font textarea meta` .split (/\s+/g)

const _cats = {
  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,
  TEXT:    `#text`,
  _fmt0:   `b big code em i nobr s small strike strong tt u`, // NB <a> and <font> are excluded
  _void0:  `area wbr`,
  _void1:  `param source track`, 
  _void2:  `input keygen`,
  _void3:  `embed img`,
  _meta0:  `base basefont bgsound link`, // these are void tags
  _meta1:  `noscript style title`, // (these aren't)
  _break:  `sub sup var hr ruby span`,
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
  C._void0 | C._void1 | C._void2 | C._void3 | C._meta0 | E.meta | E.br | E.col | E.frame

C.meta =
  C._meta0 | C._meta1 | E.script | E.template | E.meta | E.noframes

C.format = 
  C._fmt0 | E.a | E.font

C.specialBlock = 
  C._block1 | C._block2

C.foreign
  = E.math | E.svg

// ### Content sets

C.bodyContent = 
  ~(E.body | E.html | E.head | E.frameset | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell)

C.pContent = 
  C.bodyContent &~ (E.p | E.div | C.specialBlock | C.dddt | C.h1_h6 | C.list | E.li | E.xmp)

C.tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

// ### Formatting and Re-opening

C.reopen =
  C._void0 | C._void2 | C._scope | C.other | C.format | E.select | E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp
  // REVIEW math and svg only in html namespace?
  // TODO the last few exceptions. a / nobr / br?

C.formatContext = 
  E.html | E.template | E.caption | E.table | C.cell | C._scope
  // It may be possible to get rid of this one
  // currently it is still used by the parser to direct format tag reopening


// ### Breakout tags for svg, math, p and select elements

C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | E.div | C._block1 | C._break | E.meta | C._fmt0 | C.dddt | C.h1_h6 | C.list | C._void3
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
  hideOpenable: C.any,
  content:  E.html,
  openFor: C.any, paths: { '#default':'html' },
}

const bodyRule = {
  allowEnd: C.none,
  hideOpenable: C.any,
  content: C.bodyContent,
}

const afterHeadRule = {
  allowEnd: C.none,
  content:  C.meta | E.body | E.frameset, 
  openFor: C.any, paths: { '#default':'body' }
  // TODO contentInHead elements should be added to the head
}

const foreignContentRule = {
  content: ~C.breakout,
}

const appletRule = {
  allowEnd: C.tableIsh,
  hideOpenable: ~C.tableIsh,
  content: C.bodyContent,
}

const pRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.pContent,
}

const pInButtonRule =  {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.pContent &~ E.button
}

const buttonRule = {
  allowEnd: ~(E.option | E.optgroup | C.other | E.p),
  content: C.bodyContent &~ E.button,
}

const listRule = {
  allowEnd: ~(E.option | E.optgroup | E.li | C.other),
  content: C.bodyContent,
}

const dlRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  content: C.bodyContent,
}

const selectRule = {
  allowEnd: C.tableIsh,
  hideOpenable: ~(C.closeSelect | C.tableIsh),
  content: E.option | E.optgroup | E.script | E.template | C.TEXT,
  // TODO should ignore \x00 characters
}

const selectOptgroupRule = {
  content: E.option | E.script | E.template | C.TEXT,
  // TODO should ignore \x00 characters
}

const selectOptionRule = {
  content: E.script | E.template | C.TEXT,
  // TODO should ignore \x00 characters
}

const tableRule = {
  allowEnd: C.none,
  hideOpenable: C.any,
  content: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  // Other content must be foster parented
}

const tbodyRule = {
  allowEnd: E.table,
  content:  E.tr | E.script | E.template,
  openFor: C.cell, paths: { td:'tr', th:'tr' },
  // Other content must be foster parented
}

const trRule = {
  allowEnd: E.table,
  content: C.cell | E.script | E.template,
  // Other content must be foster parented
}

const tcellRule = {
  allowEnd: E.table | E.tr | C.tbody,
  content: C.bodyContent,
  // Other content must be foster parented
}


// ### Restrictions / using forbid / allow
// Alright, so this works, but still not too elegant
// currently the only restrictions are
// E.li, C.h1_h6, C.dddt

const liRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  forbid: E.li,
  allow: C.h1_h6 | C.dddt,
}

const ddRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  forbid: C.dddt,
  allow: C.h1_h6 | E.li,
}

const headingRule = {
  allowEnd: ~(E.option | E.optgroup | C.other),
  forbid: C.h1_h6,
  allow: E.li | C.dddt,
}

const specialBlockRule = {
  allow: C.h1_h6 | E.li | C.dddt,
}

const emptyRule = { }

const defaultRule = {
  allow: C.h1_h6, // REVIEW the allow system idea
}



// The Main Ruleset
// ----------------

const mainRules = {

  html: {
    allowEnd: C.none,
    content: E.head,
    openFor: C.any, paths: { '#default':'head' },
  },

  head: {
    content: C.meta,
  },

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
  li:      liRule,
  dd:      ddRule,
  dt:      ddRule,
  button:  buttonRule,

  // Tables

  table: tableRule,

  caption: {
    allowEnd: E.table,
    content:  C.bodyContent,
  },

  colgroup: {
    allowEnd: E.table,
    content:  E.col | E.template,
    // Other content must be foster parented
  },

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
  desc: bodyRule,
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

function getRule ({ closable, node }, name, flags) {

  if (closable & E.svg)
    return svgRules [name] || foreignContentRule

  if (closable & E.math)
    return mathRules [name] || foreignContentRule

  if (flags & C.h1_h6)
    return headingRule

  if (flags & E.p)
    return closable & E.button ? pInButtonRule : pRule

  if (flags & E.option)
    return closable & E.select ? selectOptionRule : defaultRule

  if (flags & E.optgroup)
    return closable & E.select ? selectOptgroupRule : defaultRule

  if (name in mainRules)
    return mainRules [name]

  if (flags & C.specialBlock)
    return specialBlockRule

  return closable & E.p ? emptyRule : defaultRule
}


// Exports
// -------

module.exports = { 
  elements: elementFlags, tagNameSets:C,
  elementInfo, defaultInfo, printInfo,
  defaultRule, documentRule, afterHeadRule, getRule
}