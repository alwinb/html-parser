const log = console.log.bind (console)

// Element Categories
// ==================

// This defines categories of elements as finite and/ or cofinite
// sets of element-names.

// The sets are encoded as bitvectors, where the sign bit signifies
// a cofinite set. The other bits correspond to _mutually disjoint_
// finite sets, aka. element–equivalence-classes.

// This encoding makes it possible to use the bitwise operations for
// computing complements, unions and intersections of categories.

// Some of the bits correspond to singleton sets, and thus identify
// a particular single element name; Others correspond to sets of
// multiple element-names.


// Mutually disjoint finite sets
// -----------------------------

// Singleton sets

const _els =
  `html head body frameset frame math svg table
  caption colgroup col tr select optgroup option hr
  script style template div address button p li br
  title meta noframes xmp a font textarea nobr
  input keygen annotation-xml embed
  img image noscript form` .split (/\s+/g)

// Finite sets

const _cats = {
  DOCTYPE: `#doctype`,
  COMMENT: `#comment`,
  TEXT:    `#text`,
  SPACE:   `#space`,
  h1_h6:   `h1 h2 h3 h4 h5 h6`,
  tbody:   `tbody tfoot thead`,
  cell:    `td th`,
  list:    `ol ul`,
  dddt:    `dd dt`,
  object:  `applet marquee object`,
  pre:     `listing pre`,
  _fmt0:   `b big code em i s small strike strong tt u`,
  areawbr: `area wbr`,
  _void1:  `param source track`, 
  _meta0:  `base basefont bgsound link`, // these are void tags
  subsup:  `sub sup var ruby span`,
  _block1: `blockquote center dl menu`,
  section: `article aside details dialog dir fieldset figcaption
            figure footer header hgroup main nav
            plaintext section summary` }

// Assign a unique bitvector index to each set
let i = 0n
const singletons = { }, categoryFlags = { }
for (const k of _els) singletons [k] = 1n << i++
for (const k in _cats) categoryFlags [k] = 1n << i++
categoryFlags.other = 1n << i++
categoryFlags.otherXml = 1n << i++

// Virtual element names, for exceptional cases

categoryFlags.hiddenInput = 1n << i++
categoryFlags.annotationHtml = 1n << i++
categoryFlags.annotationXml = singletons ['annotation-xml']

// log ('BitVector size:', i)


// Constructing the info dict
// --------------------------

// This constructs a dict that takes an element-name to the
// bitvector that identifies the categories to which it belongs.

const kinds = { }

for (let tagName in singletons)
  kinds [tagName] = (kinds [tagName] || 0n) | singletons [tagName]

for (let k in _cats) for (let tagName of _cats [k] .split (/\s+/))
  kinds [tagName] = (kinds [tagName] || 0n) | categoryFlags [k]


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
  C.areawbr | C._void1 | E.input | E.keygen | E.embed | E.img | C._meta0 | E.meta |
  E.br | E.col | E.frame | E.hr | C.hiddenInput

C.RcDataElement =
 E.textarea | E.title

C.RawTextElement =
  E.style | E.script | E.xmp | E.noframes // iframe, noembed, (noscript)

C.format =
  C._fmt0 | E.a | E.font | E.nobr

C.block =
  E.div | E.address | E.li | C.list | C.h1_h6 | C.dddt | E.button |
  C.pre | C._block1 | C.section |  E.xmp | E.p | E.form


// Formatting and Re-opening
// -------------------------

C.formatContext = 
  E.html | E.template | E.caption | E.table | C.cell | C.object
  // Used by the parser to direct format tag reopening

C.reformat =
  C.areawbr | E.input | E.keygen | C.object | C.other | C.format | E.select |
  E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp |  C.TEXT |
  C.SPACE,
  // REVIEW math and svg only in html namespace?
  // TODO the last few exceptions hr / br?


// Content sets
// ------------

// Breakout tags for svg, math, p and select elements

C.breakout = 
  E.body | E.br | E.head | E.li | E.p | E.table | E.div | C._block1 | C.pre | C.subsup | E.meta |
  C._fmt0 | E.nobr | C.dddt | C.h1_h6 | C.list | E.embed | E.img | E.hr | E.font // NB font should be excluded if it has a size, color or face attribute

// Content sets

C.Meta = // goes into the <head>
  C._meta0 | E.noscript | E.title | E.style | E.script | E.template | E.meta | E.noframes

C.Tabular = // sectioning within <table>
  E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell

C.Flow = // goes into <body>, <caption>, <td>, <object>, <div>, <ul>, block-elements alike
  ~ ( E.html | E.body | E.head | E.frameset | E.frame | C.DOCTYPE | C.Tabular | C.otherXml )

C.Phrasing = // goes into <p> elements
  C.Flow &~ C.block

C.Foreign =
  E.math | E.svg | C.annotationXml | C.annotationHtml | C.otherXml | C.SPACE | C.TEXT | C.COMMENT

//

C.fosterParented =
  C.Flow &~ (E.table | C.Tabular | E.script | E.style | E.template | C.hiddenInput | C.COMMENT | C.SPACE | E.form)


// So I think it makes sense to have embeddedHtml, embeddedXml classes for
// <svg:desc>, <svg:title>, <svg:foreignObject>, <math:annotation-xml type=text/html>, <math:mi> and others,
// and for <math:annotation-xml>, resp

// Kinds
// -----

// A 'kind' is the equivalence class to which a given element belongs.
// By and large this depends on the tagName only, however there are
// three cases where attributes are taken into account:

// * <input type=hidden> is distinguished from other <input> tags
// * <font> tags are distinguished by their attributes
// * <annotation-xml> tags are distinguished by their encoding attribute

// WIP this assigns kinds in a svg / math / html- context dependent mannar
// TODO do this properly; esp. annotation-xml 
  

// Try, using states

let s=0
const S = {
  main:         1 << s++,
  inTable:      1 << s++,
  inSvg:        1 << s++,
  inMath:       1 << s++,
  inSelect:     1 << s++,
  inParagraph:  1 << s++,
}

const _specialFontAttributes =
  { color:1, face:1, size:1 }

function Kind ({ name, attrs }, state = S.main) {
  const kind = kinds [name] || otherKind

  // in math

  if (state & S.inMath) {
    if (kind === C.annotationXml && attrs && attrs.encoding) {
      const v = attrs.encoding.toLowerCase ()
      if (v === 'text/html' || v === 'application/xhtml+xml')
      return C.annotationHtml
    }
    else return kind & (E.math | E.svg | C.annotationXml | C.breakout | C.COMMENT | C.TEXT | C.SPACE) ? kind : C.otherXml
  }
  
  // in svg

  else if (state & S.inSvg) {
    if (kind === E.font) {
      for (const name in attrs) if (name in _specialFontAttributes) return E.font;
      return C.otherXml
    }
    else {
      return kind & (E.svg | E.math | C.breakout | C.COMMENT | C.TEXT | C.SPACE) ? kind : C.otherXml
    }
  }
  
  // In html

  else if (kind === E.input && attrs && attrs.type && attrs.type.toLowerCase () === 'hidden')
    return C.hiddenInput

  return kind
}


// Exports
// =======

export {
  C, E, kinds, otherKind,
  Any, None, Kind, printKind, S as states
}