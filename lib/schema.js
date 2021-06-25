const log = console.log.bind (console)

// Element categories
// ==================

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets. 

const _els =
  `body caption colgroup optgroup option select tr head html script
  template col button p table li` .split (/\s+/g)

const _cats = 
  `other meta format _scope _reopen _spec _break h1_h6
  tbody cell list dddt foreign closeS TEXT` .split (/\s+/g)

// Void tags (and format tags) are detected on the lexer level

const _categories = {
  meta:    `base basefont bgsound link meta noframes noscript script
            style template title`,

  format:  `a b big code em font i nobr s small strike strong tt u`,
  _scope:  `applet marquee object`,

  _reopen: `area wbr
            keygen input
            xmp
            math svg
            br embed img`,

  _spec:   `article aside details dir fieldset figcaption
            figure footer form header hgroup main nav
            plaintext section summary address
            xmp
            blockquote center dl div listing menu pre`,
            // REVIEW: address and div (and p) used to be spec1 (was needed for <li> tags?)

  _break:  `sub sup var hr ruby span
            meta
            blockquote center dl div listing menu pre
            br embed img`,

  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,
  foreign: `svg math`,

  closeS:  `input keygen textarea`,
  TEXT:    `#text`,
}


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element name to the
// bitflags that identify its categories. 

let i = 0

const elementFlags = { }
for (const x of _els) elementFlags [x] = 1 << i++

const categoryFlags = { }
for (const x of _cats) categoryFlags [x] = 1 << i++

const [E, C] = [elementFlags, categoryFlags]
log (i)


const elementInfo = { }
if (C.TEXT.toString(2).length > 31)
  throw new Error ('category IDs; out of space')

for (let tagName in elementFlags)
  elementInfo [tagName] = (elementInfo [tagName] || 0) | elementFlags [tagName]

for (let k in _categories) for (let tagName of _categories [k] .split (/\s+/))
  elementInfo [tagName] = (elementInfo [tagName] || 0) | categoryFlags [k]

// Print info

function printInfo (info) {
  const _info = info < 0 ? ~info : info
  const r = []
  for (let k in E)
    if (E [k] & _info) r.push ('E.'+k)
  for (let k in C)
    if (k[0] !== '_' && C [k] & _info) r.push ('C.'+k)
  return `${info < 0 ? '~' : '' }(${r.join (' | ')})`
}


// Unions
// ------

const defaultInfo = C.other

const any = -1>>>1

const tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

C.tableIsh = tableIsh
C.any = any

C.scope = 
  E.html | E.template | E.caption | E.table | C.cell | C._scope

// StartTags that trigger a reopening of formatting tags
C.reopen =
  C._reopen | C._scope | C.other | C.format | E.select | E.optgroup | E.option | E.button
  // TODO the last few exceptions. a / nobr / br?

// StartTags that trigger a closing of <p> elements
C.closeP = 
  C._spec | E.p | C.h1_h6 | C.list | E.li | C.dddt

// The 'Special Category'
C.specialNoLi = 
  E.body | E.button | E.colgroup | E.head | E.p | E.select | C._spec | C.dddt | C.h1_h6 | C.list | C.meta | C.scope | C.spec1 | C.tableIsh
  // NB Standard adds void tags, li, frameset (format?)
  // I think meta can be removed

C.special
  = C.specialNoLi | E.li

// StartTags that trigger a closing of <svg> and <mathml> elements
// TODO should not include <a>, nor <font> if it has a color, face, or size attribute
C.breakout = 
  C._break | E.body | E.head | E.table | C.list | E.li | E.p | C.h1_h6 | C.dddt | C.format


// Schema
// ======

// This defines a schema that specifies how to handle
// mismatched tags and tags in invalid contexts. 

// Rules
// -----

// Properties are { hideOpen, allowEnd, closeFor, openFor, content }

// I'm using ~ to signify a complement set for the 'content' prop (ao).
// This is only used as an encoding, it is not correct as an operation
// on the bitflags representation (the sets overlap), so 
// test & flags is interpreted as !(test &~ flags) if flags < 0.

const bodyRule = {
  hideOpen: any,
  allowEnd: 0,
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
  hideOpen: 0, // REVIEW
  allowEnd: any,
  closeFor: C.breakout,
  content: any,
}

const formattingRule = {
  hideOpen: C.h1_h6 | E.option | E.optgroup | C.closeS, // REVIEW
  allowEnd: any,
}


const documentRule = {
  hideOpen: any,
  content: E.html,
  openFor: { '#default':'html' },
}

const afterHeadRule = {
  allowEnd: 0,
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
  hideOpen: any,
  allowEnd: E.table | E.tr | C.tbody,
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  content: ~(E.body | E.html | E.head | E.frame),
  // Other content must be foster parented
}

const appletRule = {
  hideOpen: any &~ tableIsh,
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
    allowEnd: 0,
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
    hideOpen: any,
    allowEnd: 0,
    content: any,
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
    hideOpen: any,
    openFor: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    content: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    // Other content must be foster parented
  },

  caption: {
    hideOpen: any,
    allowEnd: E.table,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    content: any,
  },

  colgroup: {
    content: E.col | E.template,
    allowEnd: E.table,
    closeFor: E.table | E.caption | C.tbody | E.tr | C.cell,
    // Other content must be foster parented
  },

  tr: { 
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    allowEnd: E.table | C.tbody,
    content: C.cell | E.script | E.template,
    // Other content must be foster parented
  },

  // Select in Table

  select: {
    hideOpen: any &~ tableIsh,
    allowEnd: C.tableIsh,
    closeFor: C.closeS,
    content: E.option | E.optgroup | E.script | E.template | C.TEXT,
    // TODO should ignore \x00 characters
  },

  option: {
    closeFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
    // TODO should ignore \x00 characters
  },
  
  // Foreign content
  
  svg: foreignContentRule,
  mathml: foreignContentRule,

}


// The svg ruleset
// ---------------

// const htmlIntegrationRule = {
//   hideOpen: any,
//   allowEnd: 0,
//   closeFor: 0,
// }

const svgRules = {
  foreignObject: bodyRule,
  desc: bodyRule,
  title: bodyRule,
  // TODO some mathml items
  // TODO null chars should be converted to u+FFFD
}


// getRule
// -------
// This implements the schema state-machine / tree automaton

function getRule ({ node, visiblyOpen }, name, flags) {

  if (visiblyOpen & C.foreign) {
    // log ('getting from svg rules', name, svgRules [name])
    // TODO mathML
    if (name in svgRules) return svgRules [name]
    else return foreignContentRule
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
  elements: elementFlags,
  categories: categoryFlags, 
  elementInfo, defaultInfo, printInfo,
  defaultRule, documentRule, afterHeadRule, getRule
}