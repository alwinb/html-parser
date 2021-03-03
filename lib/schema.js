const log = console.log.bind (console)

// Element categories
// ------------------

let i = 0

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets. 

const _els =
  `option caption colgroup optgroup body tr head html script
  template col button p table li` .split (/\s+/g)

const _cats = 
  `void format meta hx spec0 spec1 cell closeS scope
  pscope list closeP tbody other dddt TEXT` .split (/\s+/g)

const elementFlags = {}
for (const x of _els) elementFlags [x] = 1 << i++

const categoryFlags = {}
for (const x of _cats) categoryFlags [x] = 1 << i++


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element name to the
// bitflags that identify its categories. 

const [E, C] = [elementFlags, categoryFlags]
log (C.TEXT.toString (2).length)

const _categories = {
  format: `a b big code em font i nobr s small strike strong tt u`,
          
  void:   `#text area base basefont bgsound br col embed frame img
           input keygen link meta param source track wbr`,
          
  meta:   `base basefont bgsound link meta noframes noscript script
           style template title`,

  scope:  `applet caption html marquee object table td template th`,
          
  spec1:  `address div p`,
  spec0:  `aside blockquote center details dir dl fieldset figcaption
           figure footer form header hgroup listing main menu nav
           plaintext pre section summary xmp
           body frameset head colgroup article noscript`,

  closeP: `aside blockquote center details dir dl fieldset figcaption
           figure footer form header hgroup listing main menu nav
           plaintext pre section summary xmp
           article dialog`,
           // Add spec1, heading, E.table and list for p-closers

  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,

  pscope:  `button select`,
  closeS:  `input keygen textarea`,

  TEXT:    `#text`,
}

const defaultInfo = C.other
const elementInfo = { }

for (let tagName in elementFlags)
  elementInfo [tagName] = (elementInfo [tagName] || defaultInfo) | elementFlags [tagName]

for (let k in _categories) for (let tagName of _categories [k] .split (/\s+/))
  elementInfo [tagName] = (elementInfo [tagName] || defaultInfo) | categoryFlags [k]

function printInfo (info) {
  const _info = info < 0 ? ~info : info
  const r = []
  for (let k in E)
    if (E [k] & _info) r.push ('E.'+k)
  for (let k in C)
    if (C [k] & _info) r.push ('C.'+k)
  return `${info < 0 ? '~' : '' }(${r.join (' | ')})`
}


// Rules
// -----

// This defines a sort of 'schema' that specifies how to handle
// mismatched tags and tags in invalid contexts. 

const any = -1>>>1

const tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

// Properties are 'content', 'scopeFor', 'closeFor', 'closedBy' and 'paths'.
// Where 'content' is inhereted unless reset and
// scopeFor and closeFor - modify the collection of start tags that
// implicitly close the current element. 

// scopeFor and closeFor affect the processing of start-tags,
// whilst closedBy only affects the processing of end-tags. 

// I'm using ~ to signify a complement set for the 'content' prop
// but this is only used as an encoding, it is not correct as
// an operation on the bitflags representation (the sets overlap), so
// test & flags is interpreted as !(test & ~flags) if flags < 0.

const defaultRule = {
  scopeFor: C.h1_h6 | E.option | E.optgroup | C.closeS,
  closedBy: any,
}

const specialDefaultRule = {
  scopeFor: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  closedBy: any,
}

const documentRule = {
  scopeFor: any,
  content: E.html,
  paths: { '#default':'html' },
}

const afterHeadRule = {
  closedBy: 0,
  content: C.meta | E.script | E.template | E.body, // | E.frameset, 
  paths: { '#default':'body' }
  // TODO contentInHead elements should be added to the head
}

const tbodyRule = {
  closeFor: E.caption | E.colgroup | E.col | C.tbody,
  closedBy: E.table,
  content: E.tr | E.script | E.template,
  paths: { td:'tr', th:'tr' },
  // TODO foster instead of ignore
}

const tcellRule = {
  scopeFor: any,
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  closedBy: E.table | E.tr | C.tbody,
  content: ~(E.body | E.html | E.head | E.frame),
  // TODO foster instead of ignore
}

const appletRule = {
  scopeFor: any & ~tableIsh,
  closedBy: tableIsh,
}

const listRule = {
  scopeFor: C.dddt | C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.dddt | C.spec1 | C.h1_h6 | C.scope,
}

const liRule = {
  scopeFor: C.dddt | C.h1_h6 | E.option | E.optgroup | C.closeS,
  closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.dddt | C.spec1 | C.h1_h6 | C.scope,
  closeFor: E.li,
}

const ddRule = {
  scopeFor: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
  closeFor: C.dddt,
}

const headingRule = {
  scopeFor: E.li,
  closeFor: C.h1_h6,
  closedBy: C.h1_h6
}

const rules = {

  html: {
    closedBy: 0,
    content: E.head,
    paths: { '#default':'head' },
  },

  head: {
    content: C.meta | E.script | E.template,
    closeFor: any &~ (C.meta | E.script | E.template)
  },

  body: {
    closedBy: 0,
    scopeFor: any,
    content: ~(E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell),
  },

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and apparently td isnt either -- no fact td is different yet (in a weird way -- siblings set the context)
    closedBy: 0,
    scopeFor: any,
    content: any,
  },

  applet: appletRule,
  object: appletRule,
  marquee: appletRule,

  ol: listRule,
  ul: listRule,
  li: liRule,
  
  button: {
    scopeFor: C.h1_h6 | E.option | E.optgroup | C.closeS | E.li,
    closeFor: E.button,
    closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.spec1 | C.dddt | C.h1_h6 | C.scope | E.li,
  },

  p: {
    closeFor: C.closeP | C.spec1 | C.h1_h6 | C.dddt | C.list | E.li | E.table,
    closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.spec1 | C.dddt | C.h1_h6 | C.scope | E.li,
  },

  // Tables

  table: {
    scopeFor: any,
    content: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    // TODO foster instead of ignore
  },

  caption: {
    scopeFor: any,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    closedBy: E.table,
    content: any,
  },

  colgroup: {
    content: E.col | E.template,
    closeFor: any &~ (E.col | E.template),
    closedBy: E.table,
    // TODO foster instead of ignore
  },

  tr: { 
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    content: C.cell | E.script | E.template,
    closedBy: E.table | C.tbody,
    // TODO foster instead of ignore
  },

  select: {
    scopeFor: any & ~tableIsh,
    closeFor: C.closeS,
    closedBy: tableIsh,
    content: E.option | E.optgroup | E.script | E.template | C.TEXT,
    // ignoreNull: true,
  },

  option: {
    closeFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
    // ignoreNull: true,
  },

}

for (let k in rules) if (!rules[k].name)
  rules[k].name = k

rules.select.rules = Object.setPrototypeOf ({
  option: {
    name: 'option<select>',
    content: E.script | E.template | C.TEXT,
    closeFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
    rules
    // ignoreNull: true,
  },
  optgroup: {
    name: 'optgroup<select>',
    content: E.option | E.script | E.template | C.TEXT,
    closeFor: E.optgroup | C.closeS,
    rules
    // ignoreNull: true,
  },
}, rules)


const mainRules = rules

function getRule (context, name, flags) {
  const rules = context.rules || mainRules

  if (flags & C.h1_h6)
    return headingRule

  else if (flags & C.dddt)
    return ddRule
  
  else if (flags & C.tbody)
    return tbodyRule

  else if (flags & C.cell)
    return tcellRule

  else if (name in rules)
    return rules [name]

  else if (flags & (C.scope | C.spec0 | E.li))
    return specialDefaultRule

  else return defaultRule
}

// 'deriv' takes a parser context and the name/flags of an open element
// and returns a new parser context. The context is computed from the
// 'schema' above and specifies how to handle misnested and misplaced tags.

function deriv (context, name, flags) {
  let { content, closeFor, closedBy } = context
  const rule = getRule (context, name, flags)

  if ('content' in rule)
    content = rule.content

  if ('closedBy' in rule)
    closedBy = rule.closedBy

  if ('scopeFor' in rule)
    closeFor = closeFor & ~rule.scopeFor

  if ('closeFor' in rule)
    closeFor = closeFor | rule.closeFor

  let { rules, paths } = rule
  return { rules, closeFor, closedBy, content, paths }
}


// Exports
// -------

module.exports = { 
  elements: elementFlags,
  categories: categoryFlags, 
  elementInfo, defaultInfo, printInfo,
  rules, defaultRule, documentRule, afterHeadRule,
  deriv
}