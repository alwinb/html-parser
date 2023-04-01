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
  otherFmt: `b big code em i s small strike strong tt u`,
  otherRaw: `iframe noembed`,
  areawbr: `area wbr`,
  otherMeta:`base basefont bgsound link`, // these are void tags
  otherVoid:`param source track`, 
  subsup:  `sub sup var ruby span`,
  dlquote: `blockquote center dl menu`,
  embedHtml: `foreignobject desc mi mo mn ms mtext`, // TODO split svg/math?
  section: `article aside details dialog dir fieldset figcaption
            figure footer header hgroup main nav
            plaintext section summary` }

// Assign a unique bitvector index to each set
let i = 0n
const singletons = { }, categoryFlags = { }
for (const k of _els) singletons [k] = 1n << i++
for (const k in _cats) categoryFlags [k] = 1n << i++
categoryFlags.otherHtml = 1n << i++
categoryFlags.otherForeign = 1n << i++

// Virtual element names, for exceptional cases

categoryFlags.hiddenInput = 1n << i++
singletons.embedXml = singletons ['annotation-xml']

log ('BitVector size:', i)


// Element categories
// ==================

const E = singletons
const C = Object.assign ({ }, categoryFlags)


// Constructing the info dict
// --------------------------

const _kinds = { }

for (let tagName in singletons)
  _kinds [tagName] = (_kinds [tagName] || 0n) | singletons [tagName]

for (let k in _cats) for (let tagName of _cats [k] .split (/\s+/))
  _kinds [tagName] = (_kinds [tagName] || 0n) | categoryFlags [k]

// log (_kinds)

// This constructs dictionaries that map element-names to the
// bitvector that identifies their equivalence-class. This is
// currently done in a namespace dependent mannar. 

const S = {
  main:         1 << 0,
  inTable:      1 << 1,
  inSvg:        1 << 2,
  inMath:       1 << 3,
  inSelect:     1 << 4,
  inParagraph:  1 << 5,
}

// Breakout tags - these are always
// in the html namespace, also in svg and math.

const _specialFontAttributes =
  { color:1, face:1, size:1 }

const breakoutEqClasses = {

  b:       C.otherFmt,
  big:     C.otherFmt,
  code:    C.otherFmt,
  em:      C.otherFmt,
  i:       C.otherFmt,
  s:       C.otherFmt,
  small:   C.otherFmt,
  strike:  C.otherFmt,
  strong:  C.otherFmt,
  tt:      C.otherFmt,
  u:       C.otherFmt,

  h1:      C.h1_h6,
  h2:      C.h1_h6,
  h3:      C.h1_h6,
  h4:      C.h1_h6,
  h5:      C.h1_h6,
  h6:      C.h1_h6,

  sub:     C.subsup,
  sup:     C.subsup,
  var:     C.subsup,
  ruby:    C.subsup,
  span:    C.subsup,

  dl:      C.dlquote,
  menu:    C.dlquote,
  center:  C.dlquote,
  blockquote: C.dlquote,

  listing: C.pre,
  pre:     C.pre,

  dd:      C.dddt,
  dt:      C.dddt,

  ul:      C.list,
  ol:      C.list,

  body:    E.body,
  br:      E.br,
  div:     E.div,
  embed:   E.embed,
  font:    E.font, // only if it has a specialFontAttribute,
  head:    E.head,
  hr:      E.hr,
  img:     E.img,
  li:      E.li,
  meta:    E.meta,
  nobr:    E.nobr,
  p:       E.p,
  table:   E.table
}

// Math namespace

const mathEqClasses = {
  mi:    C.embedHtml,
  mo:    C.embedHtml,
  mn:    C.embedHtml,
  ms:    C.embedHtml,
  mtext: C.embedHtml,
  'annotation-xml': E.embedXml, // depending on encoding attribute,
  svg:   E.svg // depending on embedXml context
  // #default: C.otherForeign
}

// Svg namespace

const svgEqClasses = {
  foreignobject: C.embedHtml,
  title: C.embedHtml,
  desc: C.embedHtml,
  // #default: C.otherForeign
}

// Html namespace

const htmlEqClasses = Object.assign ({

  summary:    C.section,
  article:    C.section,
  aside:      C.section,
  details:    C.section,
  dialog:     C.section,
  dir:        C.section,
  fieldset:   C.section,
  figcaption: C.section,
  figure:     C.section,
  footer:     C.section,
  header:     C.section,
  hgroup:     C.section,
  main:       C.section,
  nav:        C.section,
  plaintext:  C.section,
  section:    C.section,

  base:       C.otherMeta,
  basefont:   C.otherMeta,
  bgsound:    C.otherMeta,
  link:       C.otherMeta,

  param:      C.otherVoid,
  source:     C.otherVoid,
  track:      C.otherVoid,

  applet:     C.object,
  marquee:    C.object,
  object:     C.object,

  tbody:      C.tbody,
  tfoot:      C.tbody,
  thead:      C.tbody,

  td:         C.cell,
  th:         C.cell,

  area:       C.areawbr,
  wbr:        C.areawbr,

  iframe:     C.otherRaw,
  noembed:    C.otherRaw,

  col:        E.col,
  address:    E.address,
  form:       E.form,
  option:     E.option,
  frame:      E.frame,
  keygen:     E.keygen,
  style:      E.style,
  noframes:   E.noframes,
  html:       E.html,
  tr:         E.tr,
  button:     E.button,
  textarea:   E.textarea,
  caption:    E.caption,
  template:   E.template,
  xmp:        E.xmp,
  image:      E.image,
  math:       E.math,
  title:      E.title,
  select:     E.select,
  colgroup:   E.colgroup,
  a:          E.a,
  noscript:   E.noscript,
  svg:        E.svg,
  script:     E.script,
  optgroup:   E.optgroup,
  input:      E.input,
  frameset:   E.frameset,
  // #default: C.otherHtml,
}, breakoutEqClasses)


// The eqClass function

function Kind ({ name, attrs }, context = S.main) {

  // in math

  if (context & S.inMath) {

    const kind = (breakoutEqClasses [name]
      ?? mathEqClasses [name]
      ?? C.otherForeign) | 0n

    if (kind === E.font) {
      for (const name in attrs)
        if (name in _specialFontAttributes) return E.font;
      return C.otherForeign
    }

    else if (kind === E.svg && !(context & S.inSvg))
      return C.otherForeign

    else if (kind === E.embedXml && attrs && attrs.encoding) {
      const v = attrs.encoding.toLowerCase ()
      if (v === 'text/html' || v === 'application/xhtml+xml')
        return C.embedHtml
    }

    return kind
  }
  
  // in svg

  else if (context & S.inSvg) {

    const kind = (breakoutEqClasses [name]
      ?? svgEqClasses [name]
      ?? C.otherForeign) | 0n

    if (kind === E.font) {
      for (const name in attrs) {
        if (name in _specialFontAttributes) return E.font;
      }
      return C.otherForeign
    }

    return kind
  }
  
  // In html

  const kind = (htmlEqClasses [name]
    ?? C.otherHtml) | 0n

  if (kind === E.input && attrs && attrs.type && attrs.type.toLowerCase () === 'hidden')
    return C.hiddenInput

  return kind
}


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


// General
// -------

const None = 0n
const Any = -1n

C.void =
  C.areawbr | E.input | E.keygen | E.embed | E.img | C.otherMeta | E.meta |
  E.br | E.col | E.frame | E.hr | C.hiddenInput | C.otherVoid 

C.RcDataElement =
 E.textarea | E.title

C.RawTextElement =
  E.style | E.script | E.xmp | E.noframes | C.otherRaw

C.format =
  E.a | E.font | E.nobr | C.otherFmt

C.block = // Note: does not contain object and button (they are allowed in phrasing)
  E.div | E.li | C.list | C.h1_h6 | C.dddt | C.dlquote | C.pre | E.p | 
  E.address | C.section | E.xmp | E.form


// Formatting and Re-opening
// -------------------------

C.formatContext = 
  E.html | E.template | E.caption | E.table | C.cell | C.object
  // Used by the parser to direct format tag reopening

C.reformat =
  C.areawbr | E.input | E.keygen | C.object | C.otherHtml | C.format | E.select |
  E.optgroup | E.option | E.button | E.math | E.svg | E.br | E.xmp |  C.TEXT |
  C.SPACE,

C.framesetOK =
  E.optgroup | E.option | E.div | E.address | E.p | C.h1_h6 | C.list | C.format |
  C.otherVoid | C.dlquote | C.section | E.form | C.otherHtml | C.COMMENT | C.SPACE | C.DOCTYPE |
  E.html | E.head | E.body | E.svg | E.math | C.subsup | C.hiddenInput | C.embedHtml | C.otherForeign | E.embedXml |
  E.frame | E.frameset | E.noframes // last line, hack it


// Content sets
// ------------

// Breakout tags for svg, math, p and select elements
// NB font elements should be mapped to otherForeign if they
// have a size, color or face attribute.

C.breakout = 
  E.div | E.li | C.list | C.h1_h6 | C.dddt | C.dlquote | C.pre | E.p | 
  E.body | E.br | E.head | E.table | C.subsup | E.meta |
  C.otherFmt | E.nobr | E.embed | E.img | E.hr | E.font

// Content sets

C.Meta = // goes into the <head>
  E.title | E.script | E.style | E.template | E.noscript | E.noframes | E.meta | C.otherMeta

C.Tabular = // sectioning within <table>
  E.caption | E.colgroup | E.col | C.tbody | E.tr | C.cell

C.Flow = // goes into <body>, <caption>, <td>, <object>, <div>, <ul>, block-elements alike
  ~ ( E.html | E.body | E.head | E.frameset | E.frame | C.DOCTYPE | C.Tabular | E.embedXml | C.embedHtml | C.otherForeign )

C.Phrasing = // goes into <p> elements
  C.Flow &~ C.block

C.Foreign =
  E.math | E.svg | E.embedXml | C.embedHtml | C.otherForeign // | C.SPACE | C.TEXT | C.COMMENT

//

C.fosterParented =
  C.Flow &~ (E.table | C.Tabular | E.script | E.style | E.template | C.hiddenInput | C.COMMENT | C.SPACE | E.form)


// Kinds
// -----

// A 'kind' is the equivalence class to which a given element belongs.
// By and large this depends on the tagName only, however there are
// three cases where attributes are taken into account:

// * <input type=hidden> is distinguished from other <input> tags
// * <font> tags are distinguished by their attributes
// * <annotation-xml> tags are distinguished by their encoding attribute

// NB this assigns kinds in a svg / math / html- context dependent mannar
  



// Exports
// =======

export {
  C, E, 
  Any, None, Kind, _kinds, printKind, S as states
}