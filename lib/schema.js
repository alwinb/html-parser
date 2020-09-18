const log = console.log.bind (console)

// Element categories and Scope boundaries
// ---------------------------------------

let i = 0

// These identify sets of element-names, encoded via bitflags. 
// Set membership is defined per element-name in the info map constructed below.  

const elements = {
  frameset: 1 << i++,   caption:  1 << i++,
  option:   1 << i++,   colgroup: 1 << i++,
  optgroup: 1 << i++,   body:     1 << i++,
  tr:       1 << i++,   head:     1 << i++,
  html:     1 << i++,   script:   1 << i++,
  template: 1 << i++,   col:      1 << i++,
  DATA:     1 << i++,
}

const categories = {
  special:  1 << i++,   void:     1 << i++,
  ditem:    1 << i++,   tbody:    1 << i++,
  format:   1 << i++,   heading:  1 << i++,
  meta:     1 << i++,   closep:   1 << i++,
  cell:     1 << i++,
}

// Scope boundaries are a special kind of element categories. 
// They are used a.o. to limit the 'reach' of misnested end tags. 

const boundaries = {
  scope:  1 << i++,     li:       1 << i++,
  pgroup: 1 << i++,     select:   1 << i++,
  table:  1 << i++,     row:      1 << i++,
  cell:   1 << i++,     tcontent: 1 << i++,
  list:   1 << i++,     /* NB categories.special is also used as a boundary */
}

log (i) // Phew! it just fits in 31 bits!

// Characteristic functions
// ------------------------
// ... or rather, a pairing of the characteristic functions of the sets
// defined above, as an object-map. The final info map is created later
// by splitting on spaces to keep code managable. 

// REVIEW I've added select, option, optgroup to B.scope, but I need to confirm that this is correct

// (TODO add the following to C.special)
// `iframe noembed textarea`

const E = elements
const B = boundaries
const C = categories

const _info = {
  'script':            C.special | E.script | C.meta,
  'html':              C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table | E.html,
  'head':              C.special | B.select | B.li | E.head,
  'body':              C.special | B.select | B.li | E.body,
  'frameset':          C.special | B.select | B.li | E.frameset,
  'table':             C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table | C.closep,
  'template':          C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table | C.meta | E.template,
  'caption':           C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | E.caption,
  'tbody tfoot thead': C.special | B.select | B.li | B.row  | B.cell | B.tcontent | C.tbody,
  'tr':                C.special | B.select | B.li | B.row  | B.cell | E.tr,
  'td th':             C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | C.cell,
  'ol ul':             C.special | B.select | B.li | B.list | C.closep,
  'button':            C.special | B.select | B.li | B.pgroup,
  'colgroup':          C.special | B.select | B.li | E.colgroup,
  'dd dt':             C.special | B.select | B.li | C.ditem,
  'h1 h2 h3 h4 h5 h6': C.special | B.select | B.li | C.heading | C.closep,
  'noscript':          C.special | B.select | B.li | C.meta,
  'frameset li':       C.special | B.select | B.li,
  'option':            B.scope | B.list | B.pgroup | E.option,
  'optgroup':          B.scope | B.list | B.pgroup | E.optgroup,
  'dialog div':        B.select | C.closep,
  'col':               C.special | C.void | B.select | E.col,

  'title noframes style':            C.special | B.select | C.meta,
  'base basefont bgsound link meta': C.special | B.select | C.void | C.meta,
  'address dir hr p plaintext xmp':  C.special | B.select | C.closep,

  'applet marquee object select': C.special | B.select | B.scope | B.list | B.li | B.pgroup,
  'a b big code em font i nobr s small strike strong tt u': C.format,

  'article aside blockquote center details dl fieldset figcaption figure footer form header hgroup listing main menu nav pre section summary':
    C.special | B.select | B.li | C.closep,

  'area br embed frame hr img input keygen param source track wbr':
    C.special | C.void,
  
  '<data>': E.DATA | C.void // A bit of a hack, but quite handy
}

const defaultInfo = B.select


// Element scopes
// --------------
// An object-map, mapping element names to their scope boundary. 
// An endtag for a tagName with boundary B, will close an element by that 
// name if it occurs before -- or is -- or is in the boundary set B. 

const _scopes = {
  'li': B.list,
  'p': B.pgroup,
  'select option optgroup': B.select,
  'caption colgroup table tbody td tfoot th thead tr': B.table,
  'address article aside blockquote button center details dialog dir div dl dt fieldset figcaption figure footer form header hgroup listing main menu nav ol pre section summary ul dd dt applet marquee object': B.scope,

// 'area base basefont bgsound body br col embed frame frameset h1 h2 h3 h4 h5 h6 head hr html iframe img input keygen link meta noembed noframes noscript param plaintext script source style template textarea title track wbr xmp a b big code em font i nobr s small strike strong tt u': C.special,
}


// Constructing the actual maps 

function createMap (_map) {
  const r = Object.create (null)
  for (let k in _map) for (let name of k.split(/\s+/))
    r [name] = _map[k]
  return r
}

const info = createMap (_info)
const scopes = createMap (_scopes)


// Schema
// ------

class CoSet extends Set { has (x) { return !super.has (x) } }
const coset = str => new CoSet (str.split (/\s+/))
const $ = str => new Set (str.split (/\s+/))

const tbody = {
  allowed: E.tr | E.script | E.template,
  paths: { td:'tr', th:'tr' },
}

const schema = {
  '<#document>': {
    allowed: E.html,
    paths: { '<default>':'html' }
  },

  '<default>': {
    // TODO use the bitfields here too
    allowed: coset ('head frame caption colgroup col thead tbody tfoot tr td th'),
    default: 'ignore'
  },

  html: {
    allowed: E.head,
    paths: { '<default>':'head' }
  },

  table: {
    //allowed: $ ('caption colgroup tbody tfoot thead script template'), // add input[type=hidden];
    allowed: E.caption | E.colgroup | C.tbody | E.script | E.template, // TODO add input[type=hidden]
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' }
    // TODO all else should be relegated to the body
    // default: 'foster'
  },

  colgroup: {
    allowed: E.col | E.template, // REVIEW script?
    default: 'close',
  },

  tbody,
  thead: tbody,
  tfoot: tbody,

  tr: { 
    allowed: C.cell | E.script | E.template,
  },

  head: {
    allowed: C.meta, //$ ('base basefont bgsound link meta title noscript noframes style script template'),
    default: 'close'
  },

  'html<afterHead>': {
    // allowed: $ ('body frameset base basefont bgsound link meta title noscript noframes style script template'),
    allowed: C.meta | C.body | C.frameset,
    paths: { '<default>':'body' }
    // TODO allowedInHead elements should be added to the head
  },

  template: {
    // everything is allowed! -- TODO html and body and frame too?
  },

  select: { 
    allowed: E.option | E.optgroup | E.script | E.template | E.DATA, // in body?
    default: 'ignore'
    // ignoreNull: true,
  },

  optgroup: {
    allowed: E.option | E.script | E.template | E.DATA, // FIXME, in body it allows more
    default: 'ignore',
    // ignoreNull: true,
  },

  option: {
    allowed: E.script | E.template | E.DATA,
    default: 'ignore',
    // ignoreNull: true,
  },

}

for (let k in schema) {
  schema[k].name = k
}


// Meta elements
// for (let x of $('base basefont bgsound link meta title noscript noframes style script template'))
//   log (x, info[x] & C.meta)
//
// log ('meta elements')
// for (let x in info)
//   if (info[x] & C.meta) log (x)

module.exports = { elements, categories, boundaries, defaultInfo, info, scopes, schema, $, coset, CoSet }