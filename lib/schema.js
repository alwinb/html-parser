const log = console.log.bind (console)

// Element categories
// ------------------

let i = 0

// These identify sets of element-names, encoded via bitflags. 
// Set membership is defined per element-name in the info map constructed below.  

const elementFlags = {
  /*frameset: 1 << i++,*/   caption:  1 << i++,
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
  format:  `a b big code em font i nobr s small strike strong tt u`,
  meta:    `base basefont bgsound link meta noframes noscript script style template title`,
  void:    `#text area base basefont bgsound br col embed frame img input keygen link meta param source track wbr`,

  heading: `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,

  dddt:    `dd dt`,
  closeS:  `input keygen textarea`,

  scope:   `applet caption html marquee object table td template th`,
  pscope:  `button select`,

  spec0:   `button select aside blockquote body center colgroup details dir dl fieldset figcaption figure footer form frameset head header hgroup hr listing main article menu nav noscript plaintext pre section summary tbody tfoot thead tr xmp`,
  spec1:   `address div p`,

  closeP:  `address div p aside blockquote article center details dialog dir dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr listing main menu nav ol plaintext pre section summary table ul xmp`,
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
  const r = []
  for (let k in E)
    if (E [k] & info) r.push ('E.'+k)
  for (let k in C)
    if (C [k] & info) r.push ('C.'+k)
  return r.join (' | ')
}


// Rules
// -----

// Properties are 'allowed', 'closeFor', 'paths', 'recover', 'closedBy'
// Where 'allowed' 'recover', and 'closeFor' are inhereted unless reset
// However, addCloseFor _extends_ closeFor, ie. closeFor <- parent.closeFor | addCloseFor
// closeFor is run first, so setting that implicitly removes items from the allowed set.

const tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

const defaultRule = {
  closedBy: ~1,
  recover: 'ignore'
}

const documentRule = {
  closeFor: 0,
  allowed: E.html,
  paths: { '#default':'html' },
}

const afterHeadRule = {
  closedBy: 0,
  allowed: C.meta | E.script | E.template | E.body, // | E.frameset, 
  paths: { '#default':'body' }
  // TODO allowedInHead elements should be added to the head
}

const tbodyRule = {
  closeFor: E.caption | E.colgroup | E.col | C.tbody,
  closedBy: E.table,
  allowed: E.tr | E.script | E.template,
  paths: { td:'tr', th:'tr' },
}

const tcellRule = {
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  closedBy: E.table | E.tr | C.tbody,
  negate: true,
  allowed: E.body | E.html | E.head | E.frame,
  recover: 'ignore'
}

const appletRule = {
  closedBy: E.table | E.caption | C.tbody | E.tr | C.cell
}

const listRule = {
  closedBy: tableIsh | C.list | C.spec0 | C.dddt | C.spec1 | C.heading | C.scope,
}

/*
const heading = {
  addCloseFor: C.heading,
  closedBy: C.heading
}
/*/


const rules = {

  html: {
    closedBy: 0,
    allowed: E.head,
    paths: { '#default':'head' },
  },

  head: {
    allowed: C.meta | E.script | E.template,
    recover: 'close'
  },

  body: {
    closedBy: 0,
    negate: true, // 'allowed' represents a cofinite set (i.e. it is a blacklist)
    allowed: E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    recover: 'ignore',
  },

  template: {
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and apparently td isnt either -- no fact td is different yet (in a weird way -- siblings set the context)
    closeFor: 0,
    closedBy: 0,
    negate: true,
    allowed: 0,
  },

  applet: appletRule,
  object: appletRule,
  marquee: appletRule,

  ol: listRule,
  ul: listRule,
  li: listRule,

  button: {
    addCloseFor: E.button,
    closedBy: tableIsh | C.list | C.spec0 | C.dddt | C.spec1 | C.heading | C.scope | E.li,
    // Anything else ?
  },

  p: {
    addCloseFor: C.closeP | C.heading,
    closedBy: tableIsh | C.list | C.spec0 | C.dddt | C.spec1 | C.heading | C.scope | E.li,
    // Anything else? 
  },


  // Tables

  table: {
    closeFor: 0,
    allowed: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    recover: 'foster' // TODO all else should be relegated to the body
  },

  caption: {
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    closedBy: E.table,
    negate: true, // 'allowed' represents a cofinite set (i.e. it is a blacklist) // same as body
    allowed: 0,
    recover: 'ignore' // TODO or should this be 'foster' too?
  },

  colgroup: {
    allowed: E.col | E.template, // REVIEW script?
    closedBy: E.table,
    recover: 'close' // e.g. closedBy is the complement of allowed
  },

  tbody: tbodyRule,
  thead: tbodyRule,
  tfoot: tbodyRule,

  tr: { 
    allowed: C.cell | E.script | E.template,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    closedBy: E.table | C.tbody,
  },

  td: tcellRule,
  th: tcellRule,

  // TODO try and implement these in the schema too
  // instead of in the parser class
  // thus... implement scopes some way
  // h1: heading,
  // h2: heading,
  // h3: heading,
  // h4: heading,
  // h5: heading,
  // h6: heading,

  select: {
    addCloseFor: C.closeS,
    closedBy: tableIsh,
    allowed: E.option | E.optgroup | E.script | E.template | C.TEXT,
    recover: 'ignore', 
    // ignoreNull: true,
  },

}

for (let k in rules) if (!rules[k].name)
  rules[k].name = k

rules.select.rules = Object.setPrototypeOf ({
  option: {
    name: 'option<select>',
    allowed: E.script | E.template | C.TEXT,
    addCloseFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
    rules
    // ignoreNull: true,
  },
  optgroup: {
    name: 'optgroup<select>',
    allowed: E.option | E.script | E.template | C.TEXT,
    addCloseFor: E.optgroup | C.closeS,
    rules
    // ignoreNull: true,
  },
}, rules)


const mainRules = rules
function deriv (context, name) {
  let { negate, allowed, closeFor, closedBy, recover } = context
  const _rules = context.rules || mainRules
  const rule = _rules [name] || defaultRule
  log ('deriv', rule)

  if ('allowed' in rule) {
    negate  = rule.negate || false
    allowed = rule.allowed
  }

  if ('recover' in rule)
    recover = rule.recover

  if ('closeFor' in rule)
    closeFor = rule.closeFor

  if ('closedBy' in rule)
    closedBy = rule.closedBy

  else if ('addCloseFor' in rule)
    closeFor = closeFor | rule.addCloseFor

  let { rules, paths } = rule
  return { rules, closeFor, closedBy, negate, allowed, paths, recover }
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