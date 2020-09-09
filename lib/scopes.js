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

// ### Set membership

// Basically, a pairing of the characteristic function for each of the sets defined above. 
// The final info map is created later by splitting on spaces. This just to keep the code a bit managable. 
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

// Now that we have the categories and boundary sets encoded it is time to construct a second map,
// that maps each element to their scope boundary. 

const _scopes = {
  'li': B.list,
  'p': B.pgroup,
  'select option optgroup': B.select,
  'caption colgroup table tbody td tfoot th thead tr': B.table,
  'address applet article aside blockquote button center dd details dir div dl dt fieldset figcaption figure footer form header hgroup listing main marquee menu nav object ol pre section summary ul': B.scope,
// 'area base basefont bgsound body br col embed frame frameset h1 h2 h3 h4 h5 h6 head hr html iframe img input keygen link meta noembed noframes noscript param plaintext script source style template textarea title track wbr xmp a b big code em font i nobr s small strike strong tt u': C.special,
}

// Constructing the actual map. 

function createMap (_map) {
  const r = Object.create (null)
  for (let k in _map) for (let name of k.split(/\s+/))
    r [name] = _map[k]
  return r
}

const info = createMap (_info)
const scopes = createMap (_scopes)

module.exports = { categories, boundaries, info, scopes }