const log = console.log.bind (console)

// Element category IDs
// ====================

// These identify sets of element-names, encoded via bitflags. 
// elementFlags are used to identify singleton sets, categoryFlags are
// used to denote mutually disjoint sets.

const _els =
  `body caption colgroup optgroup option select tr head html script div
  template col button p table li frameset frame noframes math svg br xmp
  a nobr font textarea meta hr style input keygen` .split (/\s+/g)

const _cats = {
  TEXT:    `#text`,
  SPACE:   `#space`,
  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,
  _fmt0:   `b big code em i s small strike strong tt u`,
  _void0:  `area wbr`,
  _void1:  `param source track`, 
  _void3:  `embed img`,
  _meta0:  `base basefont bgsound link`, // these are void tags
  _meta1:  `noscript title`, // (these aren't)
  _break:  `sub sup var ruby span`,
  _scope:  `applet marquee object`,
  _block1: `blockquote center dl listing menu pre`,
  _block2: `article aside details dir fieldset figcaption
            figure footer form header hgroup main nav
            plaintext section summary address` }


// Create the element- and category-IDs
// ------------------------------------

let i = 0n
const elementFlags = { }, categoryFlags = { }
for (const k of _els) elementFlags [k] = 1n << i++
for (const k in _cats) categoryFlags [k] = 1n << i++
categoryFlags.other = 1n << i++
elementFlags.hiddenInput = 1n << i++
elementFlags.htmlFont = 1n << i++
// log ('BitSet size:', i)


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element name to the
// bitflags that identify its categories. 

const elementInfo = { }

for (let tagName in elementFlags)
  elementInfo [tagName] = (elementInfo [tagName] || 0n) | elementFlags [tagName]

for (let k in _cats) for (let tagName of _cats [k] .split (/\s+/))
  elementInfo [tagName] = (elementInfo [tagName] || 0n) | categoryFlags [k]

// Print info

function printInfo (info) {
  if (info === 0n) return 'C.none'
  if (info === ~0n) return 'C.any'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in E)
    if (E [k] & _info) r.push ('E.'+k)
  for (let k in categoryFlags)
    if (categoryFlags [k] & _info) r.push ('C0.'+k)
  return `${info < 0n ? '~' : '' }(${r.join (' | ')})`
}


// Element categories
// ==================

const E = elementFlags
const C = Object.assign ({ }, categoryFlags)
const defaultInfo = C.other


// General
// -------

C.any = -1n
C.none = 0n

C.void =
  C._void0 | C._void1 | E.input | E.keygen | C._void3 | C._meta0 | E.meta |
  E.br | E.col | E.frame | E.hr | E.hiddenInput

C.meta =
  C._meta0 | C._meta1 | E.style | E.script | E.template | E.meta | E.noframes

C.format = 
  C._fmt0 | E.a | E.font | E.nobr | E.htmlFont

C._specialBlock = 
  C._block1 | C._block2

C.special = 
  C._specialBlock | E.p | E.div | E.li | C.list | C.h1_h6 | C.dddt | E.button
  // REVIEW careful with the old 'button/ infinite loop' bug

C.foreign
  = E.math | E.svg

C.tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell


// Formatting and Re-opening
// -------------------------

C.formatContext = 
  E.html | E.template | E.caption | E.table | C.cell | C._scope
  // Used by the parser to direct format tag reopening

C.reformat =
  C._void0 | E.input | E.keygen | C._scope | C.other | C.format | E.select |
  E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp |  C.TEXT |
  C.SPACE,
  // REVIEW math and svg only in html namespace?
  // TODO the last few exceptions hr / br?


// Content sets
// ------------

C.bodyContent = 
  ~(E.body | E.html | E.head | E.frameset | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell)

C.pContent = 
  C.bodyContent &~ (E.p | E.div | C._specialBlock | C.dddt | C.h1_h6 | C.list | E.li | E.xmp)

C.tableContent = 
  E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.SPACE | E.hiddenInput

C.trContent = 
  E.script | E.style | E.template | C.cell

C.tbodyContent = 
  E.script | E.style | E.template | C.SPACE | E.tr

// Breakout tags for svg, math, p and select elements

C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | E.div | C._block1 | C._break | E.meta |
  C._fmt0 | E.nobr | C.dddt | C.h1_h6 | C.list | C._void3 | E.hr | E.htmlFont
  // TODO should include <font> if it has a color, face, or size attribute

C.closeSelect =
  E.input | E.keygen | E.textarea


// Exports
// =======

module.exports = {
  elementInfo, defaultInfo, printInfo,
  C, E,
}