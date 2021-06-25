const log = console.log.bind (console)

// Element categories
// ==================

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets. 

const _els =
  `body caption colgroup optgroup option select tr head html script
  template col button p table li frame math svg br xmp a` .split (/\s+/g)

// Void tags are detected on the lexer level

const _categories = {
  meta:    `base basefont bgsound link meta noframes noscript script
            style template title`,

  _format: `b big code em font i nobr s small strike strong tt u`, // NB <a> is excluded

  _scope:  `applet marquee object`,
  _block:  `blockquote center div dl listing menu pre`,

  _spec:   `article aside details dir fieldset figcaption
            figure footer form header hgroup main nav
            plaintext section summary address`,
            // REVIEW: address and div (and p) used to be spec1 (was needed for <li> tags?)

  _reopen: `area wbr
            keygen input
            embed img`,

  _break:  `sub sup var hr ruby span
            meta
            embed img`,

  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,

  closeS:  `input keygen textarea`,
  TEXT:    `#text`,
}


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element name to the
// bitflags that identify its categories. 

const elementInfo = { }

let i = 0n
const elementFlags = { }
for (const k of _els) elementFlags [k] = 1n << i++

const categoryFlags = { other: 1n << i++ }
for (const k in _categories) categoryFlags [k] = 1n << i++


// log (i)
// if (C.TEXT.toString(2).length > 31)
//   throw new Error ('category IDs; out of space')

const any = -1n
const none = 0n

for (let tagName in elementFlags)
  elementInfo [tagName] = (elementInfo [tagName] || none) | elementFlags [tagName]

for (let k in _categories) for (let tagName of _categories [k] .split (/\s+/))
  elementInfo [tagName] = (elementInfo [tagName] || none) | categoryFlags [k]

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

C.any = any
C.none = none
C.foreign = E.math | E.svg

C.format = 
  C._format | E.a

C.tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

C.scope = 
  E.html | E.template | E.caption | E.table | C.cell | C._scope

// StartTags that trigger a reopening of formatting tags
C.reopen =
  C._reopen | C._scope | C.other | C.format | E.select | E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp
  // REVIEW math and svg only in html namespace?
  // TODO the last few exceptions. a / nobr / br?

// StartTags that trigger a closing of <p> elements
C.closeP = 
  C._spec | C._block | E.p | C.h1_h6 | C.list | E.li | C.dddt | E.xmp | E.button

// The 'Special Category'
C.specialNoLi = 
  E.body | E.button | E.colgroup | E.head | E.p | E.select | C._spec | E.xmp | C._block | C.dddt | C.h1_h6 | C.list | C.meta | C.scope | C.tableIsh
  // NB Standard adds void tags, li, frameset (format?)
  // I think meta can be removed

C.special
  = C.specialNoLi | E.li

// StartTags that trigger a closing of <svg> and <mathml> elements
// TODO should not include <a>, nor <font> if it has a color, face, or size attribute
C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | C._block | C._break | C._format | C.dddt | C.h1_h6 | C.list

log (C)

// Schema
// ======

// This defines a schema that specifies how to handle
// mismatched tags and tags in invalid contexts. 

// Rules
// -----
// Properties are { hideOpen, allowEnd, closeFor, openFor, content }

const documentRule = {
  hideOpen: C.any,
  allowEnd: C.none,
  closeFor: C.none,
  content:  E.html,
  openFor: { '#default':'html' },
}

const bodyRule = {
  hideOpen: C.any,
  allowEnd: C.none,
  closeFor: C.none,
  content: ~(E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell),
}

const defaultRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS,
  allowEnd: any,
}

const specialDefaultRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  allowEnd: any,
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
  content: C.meta | E.body, // | E.frameset, 
  openFor: { '#default':'body' }
  // TODO contentInHead elements should be added to the head
}

const tbodyRule = {
  allowEnd: E.table,
  closeFor: E.caption | E.colgroup | E.col | C.tbody,
  content: E.tr | E.script | E.template,
  openFor: { td:'tr', th:'tr' },
  // Other content must be foster parented
}

const tcellRule = {
  hideOpen: C.any,
  allowEnd: E.table | E.tr | C.tbody,
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  content: ~(E.body | E.html | E.head | E.frame),
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
  content: E.script | E.template | C.TEXT,
  // TODO should ignore \x00 characters
}

const selectOptgroupRule = {
  allowEnd: E.select,
  closeFor: E.optgroup | C.closeS,
  content: E.option | E.script | E.template | C.TEXT,
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

  ol: listRule,
  ul: listRule,
  li: liRule,
  
  button: {
    hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li | E.p,
    allowEnd: C.special,
    closeFor: E.button,
  },

  p: {
    closeFor: C.closeP,
    allowEnd: C.special,
  },

  // Special elements that nonetheless use the default rule
  // REVIEW - I think this is needed for the <li> handling?
  div: defaultRule,
  address: defaultRule,

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
    content:  C.any,
  },

  colgroup: {
    allowEnd: E.table,
    closeFor: E.table | E.caption | C.tbody | E.tr | C.cell,
    content:  E.col | E.template,
    // Other content must be foster parented
  },

  tr: { 
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    allowEnd: E.table | C.tbody,
    content:  C.cell | E.script | E.template,
    // Other content must be foster parented
  },

  // Select in Table

  select: {
    hideOpen: ~C.tableIsh,
    allowEnd: C.tableIsh,
    closeFor: C.closeS,
    content:  E.option | E.optgroup | E.script | E.template | C.TEXT,
    // TODO should ignore \x00 characters
  },

  option: {
    closeFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
    // TODO should ignore \x00 characters
  },
  
  // Foreign content
  
  svg: foreignContentRule,
  math: foreignContentRule,

}


// The SVG ruleset
// ---------------

const embeddedHTMLRule = {
  hideOpen: C.any,
  allowEnd: C.none,
  closeFor: C.breakout,
  content: ~(E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell),
}

const svgRules = {
  foreignObject: bodyRule,
  desc: bodyRule,
  title: bodyRule,
  // TODO some mathml items
  // TODO null chars should be converted to u+FFFD
}

const mathRules = {
  mi: bodyRule,
  mo: bodyRule,
  mn: bodyRule,
  ms: bodyRule,
  mtext: bodyRule,
  // TODO null chars should be converted to u+FFFD
}


// getRule
// -------
// This implements the schema state-machine / tree automaton

function getRule ({ node, visiblyOpen }, name, flags) {

  if (visiblyOpen & C.foreign) {
    const rules = visiblyOpen & E.svg ? svgRules
      : visiblyOpen & E.svg ? mathRules
      : mainRules
    return rules [name] || foreignContentRule
  }

  else if (flags & C.h1_h6) return headingRule
  else if (flags & C.dddt) return ddRule
  else if (flags & C.tbody) return tbodyRule
  else if (flags & C.cell) return tcellRule
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