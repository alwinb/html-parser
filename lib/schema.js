
// Finite and CoFinite sets
// ------------------------

class CoSet extends Set { has (x) { return !super.has (x) } }
const coset = str => new CoSet (str.split (/\s+/))
const $ = str => new Set (str.split (/\s+/))


// Schema
// ------

const table = {
  allowed: $ ('caption colgroup tbody tfoot thead script template'), // add input[type=hidden]; TODO all else should be relegated to the body
  paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' }
  // default: 'foster'
}

const tbody = {
  allowed: $ ('tr script template'),
  paths: { td:'tr', th:'tr' },
}

const schema = {
  table, 
  colgroup: { allowed: $ ('col template <data>') },
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
    allowed: $ ('option script template <data>'),
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
module.exports = { schema, $, coset, CoSet }