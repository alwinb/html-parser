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
  special:  1 << i++,   void:     1 << i++,
  ditem:    1 << i++,   tbody:    1 << i++,
  format:   1 << i++,   heading:  1 << i++,
  meta:     1 << i++,   closep:   1 << i++,
  cell:     1 << i++,   closeS:   1 << i++, // select closers
}

// Scope boundaries are a special kind of element categories. 
// They are used a.o. to limit the 'reach' of misnested end tags. 

const boundaries = {
  scope:  1 << i++,  li:     1 << i++,
  pgroup: 1 << i++,  list:   1 << i++,
  /* NB categories.special is also used as a boundary */
}

// log ((boundaries.list>>>0).toString(2).length)

// Characteristic functions
// ------------------------
// ... or rather, a pairing of the characteristic functions of the sets
// defined above, as an object-map. The final info map is created later
// by splitting on spaces to keep code managable. 

const [E, B, C] = [elements, boundaries, categories]
const defaultInfo = 0

const _info = {
  'script':            C.special | E.script | C.meta,
  'html':              C.special | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table | E.html,
  'head':              C.special | B.li | E.head,
  'body':              C.special | B.li | E.body,
  'frameset':          C.special | B.li | E.frameset,
  'table':             C.special | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table | C.closep,
  'template':          C.special | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table | C.meta | E.template,
  'caption':           C.special | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | E.caption,
  'tbody tfoot thead': C.special | B.li | B.row  | B.cell | B.tcontent | C.tbody,
  'tr':                C.special | B.li | B.row  | B.cell | E.tr,
  'td th':             C.special | B.li | B.list | B.cell | B.scope | B.pgroup | C.cell,
  'ol ul':             C.special | B.li | B.list | C.closep,
  'button':            C.special | B.li | B.pgroup | E.button,
  'colgroup':          C.special | B.li | E.colgroup,
  'dd dt':             C.special | B.li | C.ditem,
  'h1 h2 h3 h4 h5 h6': C.special | B.li | C.heading | C.closep,
  'noscript':          C.special | B.li | C.meta,
  'input keygen':      C.special | C.void | C.closeS,
  'select':            C.special,
  'option':            E.option,
  'optgroup':          E.optgroup,
  'li':                C.special | B.li,
  'p' :                E.p | C.special | C.closep,
  'dialog div':        C.closep,
  'col':               C.special | C.void | E.col,
  'iframe noembed':    C.special,

  'title noframes style':            C.special | C.meta,
  'base basefont bgsound link meta': C.special | C.void | C.meta,
  'address dir hr plaintext xmp':  C.special | C.closep,

  'applet marquee object': C.special | B.list | B.li | B.pgroup,
  'a b big code em font i nobr s small strike strong tt u': C.format,

  'article aside blockquote center details dl fieldset figcaption figure footer form header hgroup listing main menu nav pre section summary':
    C.special | B.li | C.closep,

  'area br embed frame hr img param source track wbr':
    C.special | C.void,

  'textarea': C.special | C.closeS,
  '#text':    E.TEXT | C.void, // A bit of a hack, but quite handy
  '#default': defaultInfo
}

// log (E,B,C,_info)


// Element scopes
// --------------
// An object-map, mapping element names to their boundarySet.  
// An endtag for a tagName with boundary B, will close a parent with that 
// name if this parent is beneath an element whithin the boundary set B. 

const defaultBoundarySet = C.scope
const _boundarySets = {
  'li': B.list,
  'p': B.pgroup,
  'caption colgroup table tbody td tfoot th thead tr': B.table,
  'address article aside blockquote button center details dialog dir div dl dt fieldset figcaption figure footer form header hgroup listing main menu nav ol pre section summary ul dd dt applet marquee object': B.scope,
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

// for (let k in info) {
//   const flags = info[k]
//   log ({ void:(flags & C.void)? 1 : 0, format:(flags & C.format) ? 1 : 0 }, k)
// }

// Rules
// -----

// This works quite a bit like CSS
// Properties are 'allowed', 'closeFor', 'paths', 'recover'
// 'allowed' and 'closeFor' are inhereted unless reset
// However, addCloseFor _extends_ closeFor, ie. closeFor <- parent.closeFor | addCloseFor
// closeFor is run first, so setting that implicitly removes items from the allowed set.

// pgroup: scope + `applet marquee object button`,
// list: scope + `applet marquee object ol ul`,

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
  closeFor: 0, // FIXME this should not reset the table scope.
  recover: 'ignore',
}

const heading = {
  addCloseFor: C.heading,
}

const rules = {
  '#document': {
    allowed: E.html,
    paths: { '#default':'html' }
  },

  '#default': {
    recover: 'ignore'
  },

  html: {
    allowed: E.head,
    closeFor: 0,
    paths: { '#default':'head' }
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
    closeFor: 0,
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

  // ...
  
  applet: pgroup,
  button: pgroup,
  marquee: pgroup,
  object: pgroup,
  
  p: {
    // negate:true, // blacklist
    // allowed: E.body | E.html | E.head | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell,
    addCloseFor: C.closep | C.heading,
    recover: 'ignore'
  },
  
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,

  button: {
    closeFor: E.button, // FIXME this should not reset the table scope..
    recover: 'ignore',
  },

  template: {
    // everything is allowed! -- TODO html and body and frame too?
    // (no, not body nor frame)
    // and apparently td isnt either -- no fact td is different yet (in a weird way)
    negate: true,
    allowed: 0,
    closeFor: 0,
  },

  select: { 
    allowed: E.option | E.optgroup | E.script | E.template | E.TEXT,
    closeFor: C.closeS,
    recover: 'ignore', 
    // ignoreNull: true,
  },

}

for (let k in rules) {
  if (!rules[k].name) rules[k].name = k
  rules[k].rules = rules
}
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


const defaultRule = rules['#default']
module.exports = { elements, categories, boundaries, info, defaultInfo, boundarySets, defaultBoundarySet, rules, defaultRule }