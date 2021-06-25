const log = console.log.bind (console)

// Element categories
// ==================

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets, categoryFlags are
// used to denote mutually disjoint sets.

const _els =
  `body caption colgroup optgroup option select tr head html script
  template col button p table li frameset frame noframes math svg br xmp a font textarea meta` .split (/\s+/g)

const _cats = {
  _format0: `b big code em i nobr s small strike strong tt u`, // NB <a> and <font> are excluded
  _void0:   `area wbr`,
  _void1:   `param source track`, 
  _void2:   `input keygen`,
  _void3:   `embed img`,
  _meta0:   `base basefont bgsound link`, // these are void tags
  _meta1:   `noscript style title`, // (these aren't)
  _break:   `sub sup var hr ruby span`,
  _scope:   `applet marquee object`,
  _block1:  `blockquote center div dl listing menu pre`,
  _block2:  `article aside details dir fieldset figcaption
             figure footer form header hgroup main nav
             plaintext section summary address`,
            // REVIEW: address and div (and p) used to be spec1 (was needed for <li> tags?)

  h1_h6:    `h1 h2 h3 h4 h5 h6`,
  tbody:    `tbody tfoot thead`,
  cell:     `td th`,
  list:     `ol ul`,
  dddt:     `dd dt`,
  TEXT:     `#text`,
}

// Create the element- and category-IDs.

let i = 0n
const elementFlags = { }
for (const k of _els) elementFlags [k] = 1n << i++
const categoryFlags = { other: 1n << i++ }
for (const k in _cats) categoryFlags [k] = 1n << i++
log ('BitSet size:', i)


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

C.format = 
  C._format0 | E.a | E.font

C.foreign
  = E.math | E.svg

C.meta =
  C._meta0 | C._meta1 | E.script | E.template | E.meta | E.noframes

//

C.bodyContent = 
  ~(E.body | E.html | E.head | E.frameset | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell)

C.tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

C.specialNoLi = 
  E.body | E.button | E.caption | E.colgroup | E.head | E.html | E.p | E.select | E.table | E.template | E.xmp |
  C._block1 | C._block2 | C._scope | C.cell | C.dddt | C.h1_h6 | C.list | C.meta | C.tableIsh
  // NB Standard adds void tags, frameset (format?)
  // I think the category can be renamed, and a number of elements can be removed; void elems a.o. 

C.special
  = C.specialNoLi | E.li


// ### Formatting and Re-opening

C.reopen =
  C._void0 | C._scope | C.other | C.format | E.select | E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp
  // REVIEW math and svg only in html namespace?
  // TODO the last few exceptions. a / nobr / br?

C.scope = 
  E.html | E.template | E.caption | E.table | C.cell | C._scope
  // It may be possible to get rid of this one
  // currently it is still used by the parser to direct format tag reopening


// ### Breakout tags for svg, math, p and select elements

C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | C._block1 | C._break | E.meta | C._format0 | C.dddt | C.h1_h6 | C.list | C._void3
  // TODO should include <font> if it has a color, face, or size attribute

C.closeP = 
  E.button | E.li | E.p | E.xmp | C._block1 | C._block2 | C.dddt | C.h1_h6 | C.list

C.closeS =
  C._void2 | E.textarea


// Schema
// ======

// This defines a schema that specifies how to handle
// mismatched tags and tags in invalid contexts. 

// Rules
// -----
// Properties are { hideOpen, allowEnd, closeFor, openFor, content }
// hideOpen defaults to C.none

const documentRule = {
  hideOpen: C.any,
  allowEnd: C.none,
  closeFor: C.none,
  content:  E.html,
  openFor:  { '#default':'html' },
}

const bodyRule = {
  hideOpen: C.any,
  allowEnd: C.none,
  closeFor: C.none,
  content:  C.bodyContent,
}

const defaultRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS,
  allowEnd: C.any,
}

const specialDefaultRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  allowEnd: C.any,
}

const foreignContentRule = {
  hideOpen: C.none, // REVIEW
  allowEnd: C.any,
  closeFor: C.breakout,
  content:  C.any,
}

const formattingRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS, // REVIEW
  allowEnd: C.any,
}

const afterHeadRule = {
  allowEnd: C.none,
  content:  C.meta | E.body | E.frameset, 
  openFor:  { '#default':'body' }
  // TODO contentInHead elements should be added to the head
}

const tbodyRule = {
  allowEnd: E.table,
  closeFor: E.caption | E.colgroup | E.col | C.tbody,
  content:  E.tr | E.script | E.template,
  openFor:  { td:'tr', th:'tr' },
  // Other content must be foster parented
}

const tcellRule = {
  hideOpen: C.any,
  allowEnd: E.table | E.tr | C.tbody,
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  content:  C.bodyContent,
  // Other content must be foster parented
}

const appletRule = {
  hideOpen: ~C.tableIsh,
  allowEnd: C.tableIsh,
}

const listRule = {
  hideOpen: C.dddt | C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  allowEnd: C.specialNoLi
}

const liRule = {
  hideOpen: C.dddt | C.h1_h6 | E.option | E.optgroup | C.closeS,
  allowEnd: C.specialNoLi,
  closeFor: E.li,
}

const ddRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  closeFor: C.dddt,
}

const headingRule = {
  hideOpen: E.li,
  allowEnd: C.h1_h6,
  closeFor: C.h1_h6,
}

const selectOptionRule = {
  allowEnd: E.select,
  closeFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
  content:  E.script | E.template | C.TEXT,
  // TODO should ignore \x00 characters
}

const selectOptgroupRule = {
  allowEnd: E.select,
  closeFor: E.optgroup | C.closeS,
  content:  E.option | E.script | E.template | C.TEXT,
  // TODO should ignore \x00 characters
}


// The Main Ruleset
// ----------------

const mainRules = {

  html: {
    allowEnd: C.none,
    content: E.head,
    openFor: { '#default':'head' },
  },

  head: {
    content: C.meta,
    closeFor: ~C.meta
  },

  body: bodyRule,

  frameset: {
    // TODO do not allow the outermost frameset to be closed
    hideOpen: C.any,
    allowEnd: C.none,
    content:  E.frameset | E.frame | E.noframes,
  },

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and apparently td isnt either -- no fact td is different yet (in a weird way -- siblings set the context)
    hideOpen: C.any,
    allowEnd: C.none,
    content:  C.any,
  },

  applet: appletRule,
  object: appletRule,
  marquee: appletRule,

  // Special elements that nonetheless use the default rule
  // REVIEW - This is needed for <li> handling?
  div: defaultRule,
  address: defaultRule,

  ol: listRule,
  ul: listRule,
  li: liRule,
  dd: ddRule,
  dt: ddRule,

  button: {
    hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li | E.p,
    allowEnd: C.special,
    closeFor: E.button,
  },

  p: {
    closeFor: C.closeP, // | C.tableIsh,
    allowEnd: C.special,
  },

  // Tables

  table: {
    hideOpen: C.any,
    openFor: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    content: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    // Other content must be foster parented
  },

  caption: {
    hideOpen: C.any,
    allowEnd: E.table,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    content:  C.bodyContent,
  },

  colgroup: {
    allowEnd: E.table,
    closeFor: E.table | E.caption | C.tbody | E.tr | C.cell,
    content:  E.col | E.template,
    // Other content must be foster parented
  },

  thead: tbodyRule,
  tbody: tbodyRule,
  tfoot: tbodyRule,

  tr: { 
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    allowEnd: E.table | C.tbody,
    content:  C.cell | E.script | E.template,
    // Other content must be foster parented
  },
  
  th: tcellRule,
  td: tcellRule,

  // Select in Table

  select: {
    hideOpen: ~C.tableIsh,
    allowEnd: C.tableIsh,
    closeFor: C.closeS,
    content:  E.option | E.optgroup | E.script | E.template | C.TEXT,
    // TODO should ignore \x00 characters
  },

  option: {
    closeFor: E.option | E.optgroup | C.closeS,
    // TODO should ignore \x00 characters
  },
  
  // Foreign content
  
  svg: foreignContentRule,
  math: foreignContentRule,

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

function getRule ({ node, visiblyOpen }, name, flags) {

  if (visiblyOpen & C.foreign) {
    const rules = visiblyOpen & E.svg ? svgRules
      : visiblyOpen & E.svg ? mathRules : mainRules
    return rules [name] || foreignContentRule
  }

  else if (flags & C.h1_h6) return headingRule
  else if (flags & C.format) return formattingRule

  else if (flags & E.option)
    return visiblyOpen & E.select ? selectOptionRule : mainRules.option

  else if (flags & E.optgroup)
    return visiblyOpen & E.select ? selectOptgroupRule : defaultRule

  else if (name in mainRules)
    return mainRules [name]

  else if (flags & C.special)
    return specialDefaultRule

  return defaultRule
}


// Exports
// -------

module.exports = { 
  elementFlags, categoryFlags, 
  elements: elementFlags, categories:C,
  elementInfo, defaultInfo, printInfo,
  defaultRule, documentRule, afterHeadRule, getRule
}