const log = console.log.bind (console)

// Element categories
// ------------------

let i = 0

// These identify sets of element-names, encoded via bitflags. 
// Set membership is defined per element-name in the info map constructed below.  

const elementFlags = {
  /*frameset: 1 << i++,*/ caption:  1 << i++,
  option:   1 << i++,   colgroup: 1 << i++,
  optgroup: 1 << i++,   body:     1 << i++,
  tr:       1 << i++,   head:     1 << i++,
  html:     1 << i++,   script:   1 << i++,
  template: 1 << i++,   col:      1 << i++,
  button:   1 << i++,   p:        1 << i++,
  table:    1 << i++,   li:       1 << i++,
}

const categoryFlags = {
  void:     1 << i++,   format:   1 << i++,
  meta:     1 << i++,   heading:  1 << i++,

  spec0:    1 << i++,   spec1:    1 << i++,
  cell:     1 << i++,   closeS:   1 << i++, // <select> closers
  scope:    1 << i++,   pscope:   1 << i++,
  list:     1 << i++,   closeP:   1 << i++, // <p> closers
  tbody:    1 << i++,   other:    1 << i++,
  dddt:     1 << i++,
  TEXT:     1 << i++,             
}

// Element categories
// ------------------

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
           figure footer form header hgroup hr listing main menu nav
           plaintext pre section summary xmp
           body frameset head colgroup article noscript`,

  closeP: `aside blockquote center details dir dl fieldset figcaption
           figure footer form header hgroup hr listing main menu nav
           plaintext pre section summary xmp
           article dialog`,
           // Add spec1, heading, E.table and list for p-closers

  heading: `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,

  pscope:  `button select`,
  closeS:  `input keygen textarea`,

  TEXT:    `#text`,
}


// Constructing the info map
// -------------------------

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

const any = -1>>>1

const tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

// Properties are 'content', 'scopeFor', 'closeFor', 'closedBy',
// 'paths' and 'recover' --
// Where 'content' and 'recover' are inhereted unless reset,
// and scopeFor and closeFor - modify the context.

// I'm using ~ to signify a complement set for the 'content' prop.
// however, this is only used as an encoding, it is not correct as
// an operation on the bitflags/ representation (the sets overlap), so
// test & flags is interpreted as !(test & ~flags) if flags < 0.

// Now, this works, but I'd like to try and merge closedBy with the 
// scope / closeFor mechanisme, and properly understand that.
// 'cause currently scopeFor/ closeFor only affect the processing of
// open tags. It would be 'logical' if it'd also contol the close tags...

const defaultRule = {
  scopeFor: C.heading | E.option | E.optgroup | C.closeS,
  closedBy: any,
  recover: 'ignore'
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
  // recover - foster
}

const tcellRule = {
  scopeFor: any,
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  closedBy: E.table | E.tr | C.tbody,
  content: ~(E.body | E.html | E.head | E.frame),
  recover: 'ignore'
}

const appletRule = {
  scopeFor: any & ~tableIsh,
  closedBy: tableIsh,
}

const listRule = {
  scopeFor: C.dddt | C.heading | E.option | E.optgroup | C.closeS,
  closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.dddt | C.spec1 | C.heading | C.scope,
}

const liRule = {
  scopeFor: C.dddt | C.heading | E.option | E.optgroup | C.closeS,
  closeFor: E.li,
  closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.dddt | C.spec1 | C.heading | C.scope,
}

// Right, there are more problems with this
// li's are scoped by many more elements
// and these are currently not in the ruleset, 
// so I need to switch to a function that takes (name, flags) -> rule
// something similar holds for dddt

const ddRule = {
  scopeFor: C.heading | E.option | E.optgroup | C.closeS,
  closeFor: C.dddt,
}

//*
const heading = {
  closeFor: C.heading,
  closedBy: C.heading
}
//*/


const rules = {

  html: {
    closedBy: 0,
    content: E.head,
    paths: { '#default':'head' },
  },

  head: {
    content: C.meta | E.script | E.template,
    recover: 'close'
  },

  body: {
    closedBy: 0,
    scopeFor: any,
    content: ~(E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell),
    recover: 'ignore',
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
  li: listRule,
  
  dd: ddRule,
  dt: ddRule,

  button: {
    scopeFor: C.heading | E.option | E.optgroup | C.closeS,
    closeFor: E.button,
    closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.spec1 | C.dddt | C.heading | C.scope | E.li,
    // Anything else ?
  },

  p: {
    closeFor: C.closeP | C.spec1 | C.heading | C.dddt | C.list | E.li | E.table,
    closedBy: tableIsh | C.list | C.pscope | C.spec0 | C.spec1 | C.dddt | C.heading | C.scope | E.li,
    // Anything else? 
  },

  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,


  // Tables

  table: {
    scopeFor: any,
    content: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    recover: 'foster' // TODO all else should be relegated to the body
  },

  caption: {
    scopeFor: any,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    closedBy: E.table,
    content: any,
    recover: 'ignore'
  },

  colgroup: {
    content: E.col | E.template, // REVIEW script?
    closedBy: E.table,
    recover: 'close'
  },

  tbody: tbodyRule,
  thead: tbodyRule,
  tfoot: tbodyRule,

  tr: { 
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    content: C.cell | E.script | E.template,
    closedBy: E.table | C.tbody,
  },

  td: tcellRule,
  th: tcellRule,

  select: {
    scopeFor: any & ~tableIsh,
    closeFor: C.closeS,
    closedBy: tableIsh,
    content: E.option | E.optgroup | E.script | E.template | C.TEXT,
    recover: 'ignore', 
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


function deriv (context, name) {
  let { content, closeFor, closedBy, recover } = context
  const _rules = context.rules || mainRules
  const rule = _rules [name] || defaultRule

  log ('deriv', rule)

  if ('content' in rule)
    content = rule.content

  if ('closedBy' in rule)
    closedBy = rule.closedBy

  if ('scopeFor' in rule)
    closeFor = closeFor & ~rule.scopeFor

  if ('closeFor' in rule)
    closeFor = closeFor | rule.closeFor

  if ('recover' in rule)
    recover = rule.recover

  let { rules, paths } = rule
  return { rules, closeFor, closedBy, content, paths, recover }
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