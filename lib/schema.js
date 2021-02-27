const log = console.log.bind (console)

// Element categories and Scope boundaries
// ---------------------------------------

let i = 1

// These identify sets of element-names, encoded via bitflags. 
// Set membership is defined per element-name in the info map constructed below.  

const elements = {
  frameset: 1 << i++,   caption:  1 << i++,
  option:   1 << i++,   colgroup: 1 << i++,
  optgroup: 1 << i++,   body:     1 << i++,
  tr:       1 << i++,   head:     1 << i++,
  html:     1 << i++,   script:   1 << i++,
  template: 1 << i++,   col:      1 << i++,
  TEXT:     1 << i++,   button:   1 << i++,
  p:        1 << i++,
}

const categories = {
  special:  1 << i++,   void:       1 << i++,
  dddt:     1 << i++,   tbody:      1 << i++,
  format:   1 << i++,   heading:    1 << i++,
  meta:     1 << i++,   closeP:     1 << i++, // <p> closers
  cell:     1 << i++,   closeS:     1 << i++, // <select> closers
  scope:    1 << i++,   li_scope:   1 << i++,
  pgroup:   1 << i++,   list_scope: 1 << i++,
  /* NB categories.special is also used as a boundary */
}

log ((categories.list_scope).toString(2).length)

// Characteristic functions
// ------------------------
// ... or rather, a pairing of the characteristic functions of the sets
// defined above, as an object-map. The final info map is created later
// by splitting on spaces to keep code managable. 

const [E, C] = [elements, categories]
const defaultInfo = 0

const _info = {
  'script':            C.special | E.script | C.meta,
  'html':              C.special | C.li_scope | C.list_scope | C.scope | C.pgroup | E.html,
  'head':              C.special | C.li_scope | E.head,
  'body':              C.special | C.li_scope | E.body,
  'frameset':          C.special | C.li_scope | E.frameset,
  'table':             C.special | C.li_scope | C.list_scope | C.scope | C.pgroup | C.closeP,
  'template':          C.special | C.li_scope | C.list_scope | C.scope | C.pgroup | C.meta | E.template,
  'caption':           C.special | C.li_scope | C.list_scope | C.scope | C.pgroup | E.caption,
  'tbody tfoot thead': C.special | C.li_scope | C.tbody,
  'tr':                C.special | C.li_scope | E.tr,
  'td th':             C.special | C.li_scope | C.list_scope | C.cell | C.scope | C.pgroup,
  'ol ul':             C.special | C.li_scope | C.list_scope | C.closeP,
  'button':            C.special | C.li_scope | C.pgroup | E.button,
  'colgroup':          C.special | C.li_scope | E.colgroup,
  'dd dt':             C.special | C.li_scope | C.dddt, 
  'h1 h2 h3 h4 h5 h6': C.special | C.li_scope | C.heading | C.closeP,
  'noscript':          C.special | C.li_scope | C.meta,
  'input keygen':      C.special | C.void | C.closeS,
  'select':            C.special | C.li_scope | C.pgroup, // REVIEW anything else?
  'option':            E.option,
  'optgroup':          E.optgroup,
  'li':                C.special | C.li_scope,
  'p' :                E.p | C.special | C.closeP,
  'dialog':            C.closeP,
  'div':               C.special | C.closeP,
  'col':               C.special | C.void | E.col,
  'iframe noembed':    C.special,

  'title noframes style':            C.special | C.meta,
  'base basefont bgsound link meta': C.special | C.void | C.meta,
  'dir hr plaintext xmp':  C.special | C.li_scope | C.closeP,
  'address':  C.special | C.closeP,

  'applet marquee object': C.special | C.list_scope | C.li_scope | C.pgroup | C.scope,
  'a b big code em font i nobr s small strike strong tt u': C.format,

  'article aside blockquote center details dl fieldset figcaption figure footer form header hgroup listing main menu nav pre section summary':
    C.special | C.li_scope | C.closeP,

  'area br embed frame hr img param source track wbr':
    C.special | C.void,

  'textarea': C.special | C.closeS,
  '#text':    E.TEXT | C.void, // A bit of a hack, but quite handy
  '#default': defaultInfo
}

// log (E,B,C,_info)

function printInfo (info) {
  const r = []
  for (let k in E)
    if (E [k] & info) r.push ('E.'+k)
  for (let k in C)
    if (C [k] & info) r.push ('C.'+k)
  return r.join (' | ')
}


// Element scopes
// --------------
// An object-map, mapping element names to their boundarySet.  
// An endtag for a tagName with boundary set B, will close a parent with that 
// name if this parent is beneath an element whithin the boundary set B. 

const defaultBoundarySet = C.scope
const _boundarySets = {
  'li': C.list_scope,
  'p': C.pgroup,
  'caption colgroup table tbody td tfoot th thead tr': C.table,
  'address article aside blockquote button center details dialog dir div dl dt fieldset figcaption figure footer form header hgroup listing main menu nav ol pre section summary ul dd dt applet marquee object': C.scope,

  // 'area base basefont bgsound body br col embed frame frameset h1 h2 h3 h4 h5 h6 head hr html iframe img input keygen link meta noembed noframes noscript param plaintext script source style template textarea title track wbr xmp a b big code em font i nobr s small strike strong tt u': C.special,
// '#default': C.special
}

// Constructing the actual maps 

function createMap (_map) {
  const r = Object.create (null)
  for (let k in _map) for (let name of k.split(/\s+/))
    r [name] = _map[k]
  return r
}

const info = createMap (_info)
const boundarySets = createMap (_boundarySets)


// Rules
// -----

// Properties are 'allowed', 'closeFor', 'paths', 'recover'
// 'allowed' and 'closeFor' are inhereted unless reset
// However, addCloseFor _extends_ closeFor, ie. closeFor <- parent.closeFor | addCloseFor
// closeFor is run first, so setting that implicitly removes items from the allowed set.

const tbody = {
  allowed: E.tr | E.script | E.template,
  closeFor: E.caption | E.colgroup | E.col | C.tbody,
  paths: { td:'tr', th:'tr' },
}

const tcell = {
  negate: true, // 'allowed' represents a cofinite set (i.e. it is a blacklist) // same as body
  allowed: E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
  closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
}

const pgroup = {
  addCloseFor: C.closeP,
  recover: 'ignore'
}

const heading = {
  addCloseFor: C.heading,
}

const rules = {
  '#document': {
    allowed: E.html,
    paths: { '#default':'html' },
  },

  '#default': {
    recover: 'ignore'
  },

  html: {
    allowed: E.head,
    paths: { '#default':'head' },
  },

  head: {
    allowed: C.meta | E.script | E.template,
    recover: 'close'
  },

  '<afterHead>': {
    allowed: C.meta | E.script | E.template | E.body | E.frameset, 
    paths: { '#default':'body' }
    // TODO allowedInHead elements should be added to the head
  },

  body: {
    negate: true, // 'allowed' represents a cofinite set (i.e. it is a blacklist)
    allowed: E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    recover: 'ignore',
  },

  // Tables

  table: {
    allowed: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
    // recover: 'foster' // TODO all else should be relegated to the body
  },

  caption: {
    // negate: true, // 'allowed' represents a cofinite set (i.e. it is a blacklist)
    // allowed: E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    recover: 'ignore' // TODO or should this be 'foster' too?
  },

  colgroup: {
    allowed: E.col | E.template, // REVIEW script?
    recover: 'close'
  },

  tbody,
  thead: tbody,
  tfoot: tbody,

  tr: { 
    allowed: C.cell | E.script | E.template,
    closeFor: E.caption | E.colgroup | E.col | C.tbody | E.tr,
    // recover: 'foster' // TODO all else should be relegated to the body
  },

  td: tcell,
  th: tcell,

  p: { // FIXME <p><applet><p>
    addCloseFor: C.closeP | C.heading,
    recover: 'ignore'
  },
  
  // TODO try and implement these in the schema too
  // instead of in the parser class
  // thus... implement scopes some way
  // applet: pgroup,
  // marquee: pgroup,
  // object: pgroup,
  // h1: heading,
  // h2: heading,
  // h3: heading,
  // h4: heading,
  // h5: heading,
  // h6: heading,
  // button: {
  //   addCloseFor: E.button, 
  //   // FIXME this should not reset the table scope..
  //   // but applet should shadow these closeFors
  //   recover: 'ignore',
  // },

  template: {
    // everything is allowed! -- TODO html and body and frame too?
    // (no, not body nor frame)
    // and apparently td isnt either -- no fact td is different yet (in a weird way -- siblings set the context)
    negate: true, // 'allowed' represents a cofinite set (i.e. it is a blacklist)
    allowed: E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    recover: 'ignore',
  },

  select: { 
    allowed: E.option | E.optgroup | E.script | E.template | E.TEXT,
    closeFor: C.closeS,
    recover: 'ignore', 
    // ignoreNull: true,
  },

}

for (let k in rules) if (!rules[k].name)
  rules[k].name = k

rules.select.rules = Object.setPrototypeOf ({
  option: {
    name: 'option<select>',
    allowed: E.script | E.template | E.TEXT,
    closeFor: E.option | E.optgroup | C.closeS, // option, optgroup, input, keygen, textarea
    recover: 'ignore',
    rules
    // ignoreNull: true,
  },
  optgroup: {
    name: 'optgroup<select>',
    allowed: E.option | E.script | E.template | E.TEXT,
    closeFor: E.optgroup | C.closeS,
    recover: 'ignore',
    rules
    // ignoreNull: true,
  },
}, rules)


const mainRules = rules
const defaultRule = rules['#default']

function deriv (context, name) {
  let { negate, allowed, closeFor } = context
  const _rules = context.rules || mainRules
  const rule = _rules [name] || defaultRule

  if ('allowed' in rule) {
    negate  = rule.negate || false
    allowed = rule.allowed
  }

  if ('closeFor' in rule)
    closeFor = rule.closeFor

  else if ('addCloseFor' in rule)
    closeFor = closeFor | rule.addCloseFor

  let { rules, paths, recover } = rule
  return { rules, closeFor, negate, allowed, paths, recover }
}


// Exports
// -------

module.exports = { 
  elements, categories, 
  elementInfo:info, defaultInfo, printInfo,
  boundarySets, defaultBoundarySet, 
  rules, defaultRule,
  deriv
}