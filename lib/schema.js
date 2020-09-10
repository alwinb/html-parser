const log = console.log.bind (console)

// Element categories and Scope boundaries
// ---------------------------------------

let i = 0

// These identify sets of element-names, encoded via bitflags. 
// Set membership is defined per element-name in the info map constructed below.  

const categories = {
  special:  1 << i++,   void:     1 << i++,
  ditem:    1 << i++,   tbody:    1 << i++,
  tcontent: 1 << i++,   colgroup: 1 << i++,
  row:      1 << i++,   cell:     1 << i++,
  format:   1 << i++,   heading:  1 << i++,
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


// Characteristic functions
// ------------------------
// ... or rather, a pairing of the characteristic functions of the sets
// defined above, as an object-map. The final info map is created later
// by splitting on spaces to keep code managable. 

// REVIEW I've added select, option, optgroup to B.scope, but I need to confir mthat this works as desired. 

const B = boundaries
const C = categories

const _info = {
  'caption':              C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | C.tcontent | C.caption,
  'html table template':  C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | B.tcontent | B.row | B.table,
  'td th':                C.special | B.select | B.li | B.list | B.cell | B.scope | B.pgroup | C.cell,
  'ol ul':                C.special | B.select | B.li | B.list,
  'tbody tfoot thead':    C.special | B.select | B.li | B.row | B.cell | B.tcontent | C.tbody | C.tcontent,
  'tr':                   C.special | B.select | B.li | B.row | B.cell | C.row,
  'button':               C.special | B.select | B.li | B.pgroup,
  'colgroup':             C.special | B.select | B.li | C.tcontent,
  'dd dt':                C.special | B.select | B.li | C.ditem,
  'h1 h2 h3 h4 h5 h6':    C.special | B.select | B.li | C.heading,
  'option optgroup':      B.scope | B.list | B.pgroup,

  'applet marquee object select': C.special | B.select | B.scope | B.list | B.li | B.pgroup,
  'a b big code em font i nobr s small strike strong tt u': C.format,

  'article aside blockquote body center details dl fieldset figcaption figure footer form frameset head header hgroup li listing main menu nav noscript pre section summary':
    C.special | B.select | B.li,

  'area base basefont bgsound br col embed frame hr img input keygen link meta param source track wbr':
    C.special | C.void,
}


// Element scopes
// --------------

// An object-map, mapping element names to their scope boundary. 

const _scopes = {
  'li': B.list,
  'p': B.pgroup,
  'select option optgroup': B.select,
  'caption colgroup table tbody td tfoot th thead tr': B.table,
  'address applet article aside blockquote button center dd details dir div dl dt fieldset figcaption figure footer form header hgroup listing main marquee menu nav object ol pre section summary ul': B.scope,
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

// TODO use the bitfields here too

class CoSet extends Set { has (x) { return !super.has (x) } }
const coset = str => new CoSet (str.split (/\s+/))
const $ = str => new Set (str.split (/\s+/))


const table = {
  allowed: $ ('caption colgroup tbody tfoot thead script template'), // add input[type=hidden]; TODO all else should be relegated to the body
  paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' }
  // default: 'foster'
}

const colgroup = {
  allowed: $ ('col template'),
  default: 'close',
}

const tbody = {
  allowed: $ ('tr script template'),
  paths: { td:'tr', th:'tr' },
}

const schema = {
  table, colgroup,
  thead: tbody, tbody, tfoot: tbody,

  tr: { allowed: $ ('th td script template') },

  '<#document>': {
    allowed: $ ('html'),
    paths: { '<default>':'html' }
  },

  html: {
    allowed: $ ('head'),
    paths: { '<default>':'head' }
  },

  head: {
    allowed: $ ('base basefont bgsound link meta title noscript noframes style script template'),
    default: 'close'
  },

  'html<afterHead>': {
    allowed: $ ('body frameset base basefont bgsound link meta title noscript noframes style script template'),
    paths: { '<default>':'body' }
    // TODO allowedInHead elements should be added to the head
  },

  '<default>': {
    allowed: coset ('head frame caption colgroup col thead tbody tfoot tr td th'),
    paths: {
      colgroup:'table', thead:'table', tbody:'table', tfoot:'table',
      col:'table', tr:'table', td:'table', th:'table',
    },
  },

  template: { }, // May need special handling of framesets though

  select: { 
    allowed: $ ('option optgroup script template <data>'),
    default: 'ignore'
    // ignoreNull: true,
  },

  optgroup: {
    allowed: $ ('option script template <data>'), // FIXME, in body it allows more
    default: 'ignore',
    // ignoreNull: true,
  },

  option: {
    allowed: $ ('script template <data>'),
    default: 'ignore',
    // ignoreNull: true,
  },

}

for (let k in schema) {
  schema[k].name = k
}

module.exports = { categories, boundaries, info, scopes, schema, $, coset, CoSet }