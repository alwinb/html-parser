const log = console.log.bind (console)

// Element category IDs
// ====================

// These identify sets of element-names, encoded via bitflags. 
// The bits correspond to mutually disjoint sets. These are
// finite and/ or cofinite sets of elements. Some of the bits
// correspond to singleton sets, and thus identify a particular
// single element name. 

// Singletons

const _els =
  `html body head caption colgroup optgroup option select tr script div
  template col button p table li frameset frame noframes math svg br xmp
  a nobr font textarea meta hr style input keygen annotation-xml embed img image` .split (/\s+/g)

// Finite sets

const _cats = {
  DATA:    `#data`,
  COMMENT: `#comment`,
  SPACE:   `#space`,
  TEXT:    `#text`,
  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,
  _fmt0:   `b big code em i s small strike strong tt u`,
  _void0:  `area wbr`,
  _void1:  `param source track`, 
  _meta0:  `base basefont bgsound link`, // these are void tags
  _meta1:  `noscript title`, // (these aren't)
  _break:  `sub sup var ruby span`,
  _scope:  `applet marquee object`,
  _block1: `blockquote center dl menu listing pre`, // TODO listing and pre should set frameset to not ok
  _block2: `article aside details dir fieldset figcaption
            figure footer form header hgroup main nav
            plaintext section summary address` }


// Create the element- and category-IDs
// ------------------------------------

let i = 0n
const singletons = { }, categoryFlags = { }
for (const k of _els) singletons [k] = 1n << i++
for (const k in _cats) categoryFlags [k] = 1n << i++
categoryFlags.other = 1n << i++

// Virtual element names, for exceptional cases

categoryFlags.htmlFont = 1n << i++
categoryFlags.hiddenInput = 1n << i++
categoryFlags.annotationHtml = 1n << i++
categoryFlags.annotationXml = singletons ['annotation-xml']

// log ('BitSet size:', i)


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element name to the
// bitflag that identifies its kind. 

const kinds = { }

for (let tagName in singletons)
  kinds [tagName] = (kinds [tagName] || 0n) | singletons [tagName]

for (let k in _cats) for (let tagName of _cats [k] .split (/\s+/))
  kinds [tagName] = (kinds [tagName] || 0n) | categoryFlags [k]


// Element categories
// ==================

const E = singletons
const C = Object.assign ({ }, categoryFlags)
const otherKind = C.other


// General
// -------

const None = 0n
const Any = -1n

C.void =
  C._void0 | C._void1 | E.input | E.keygen | E.embed | E.img | C._meta0 | E.meta |
  E.br | E.col | E.frame | E.hr | C.hiddenInput

C.meta =
  C._meta0 | C._meta1 | E.style | E.script | E.template | E.meta | E.noframes

C.format = 
  C._fmt0 | E.a | E.font | E.nobr | C.htmlFont

C._specialBlock = 
  C._block1 | C._block2

C.special = 
  C._specialBlock | E.p | E.div | E.li | C.list | C.h1_h6 | C.dddt | E.button
  // REVIEW careful with the old 'button/ infinite loop' bug

C.foreign =
  E.math | E.svg


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


// Exceptional behaviour
// ---------------------

C.startTagExceptions =
  E.select | E.image | E.input | E.font | C.annotationXml | E.a

C.endTagExceptions =
  E.br | E.p | E.body | E.head | C.h1_h6

C.framesetOK = 
  E.optgroup | E.option | E.div | E.p | C.h1_h6 | C.list | C.format |
  C._void1 | C._specialBlock | C.other | C.COMMENT | C.SPACE |
  E.html | E.head | C._break | C.hiddenInput


// Content sets
// ------------

C.bodyContent = 
  ~(E.body | E.html | E.head | E.frameset | E.frame | E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell)

C.pContent = 
  C.bodyContent &~ (E.p | E.div | C._specialBlock | C.dddt | C.h1_h6 | C.list | E.li | E.xmp)

C.tableContent = 
  E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT

C.trContent = 
  E.script | E.style | E.template | C.cell | C.hiddenInput | C.SPACE | C.COMMENT

C.tbodyContent = 
  E.script | E.style | E.template | E.tr | C.hiddenInput | C.SPACE | C.COMMENT

// Breakout tags for svg, math, p and select elements

C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | E.div | C._block1 | C._break | E.meta |
  C._fmt0 | E.nobr | C.dddt | C.h1_h6 | C.list | E.embed | E.img | E.hr | C.htmlFont
  // TODO should include <font> if it has a color, face, or size attribute

C.closeSelect =
  E.input | E.keygen | E.textarea

C.tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell


// Printing
// --------

function printKind (info) {
  if (info === ~0n) return 'Any'
  if (info === 0n) return 'None'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in E) if (_info & E[k]) r.push ('E.'+k)
  for (let k in categoryFlags) if (categoryFlags [k] & _info) r.push ('C.'+k)
  return `${info < 0n ? '~' : '' }` + (r.length === 1 ? r[0] : `(${r.join (' | ')})`)
}


// Exports
// =======

module.exports = {
  Any, None, C, E,
  kinds, otherKind, printKind,
}