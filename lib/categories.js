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


// Element categories
// ==================

// Create unique Ids for each eq class

let i = 0
const elemIds = {}
const classIds = {}

for (const k of _els) elemIds [k] = i++
for (const k in _cats) classIds [k] = i++

classIds.otherHtml = i++
classIds.otherForeign = i++
classIds.hiddenInput = i++
log ('Max id:', classIds.hiddenInput)

// Make them available as bitvectors

const E = {} // singletons
const Cats = {}
const C = {} // Object.assign ({ }, sets)

for (const k in elemIds)
  E[k] = 1n << BigInt (elemIds[k])

for (const k in classIds)
  C[k] = Cats[k] = 1n << BigInt (classIds[k])

elemIds.embedXml = elemIds['annotation-xml']
E.embedXml = E['annotation-xml']

// Constructing the info dict
// --------------------------

const _kinds = { }

for (let tagName in elemIds)
  _kinds [tagName] = (_kinds [tagName] || 0n) | 1n << BigInt (elemIds [tagName])

for (let k in _cats) for (let tagName of _cats [k] .split (/\s+/))
  _kinds [tagName] = (_kinds [tagName] || 0n) | 1n << BigInt (classIds [k])

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

// Math namespace

const c = classIds
const e = elemIds
  
const mathEqClasses = {
  mi:    c.embedHtml,
  mo:    c.embedHtml,
  mn:    c.embedHtml,
  ms:    c.embedHtml,
  mtext: c.embedHtml,
  'annotation-xml': e.embedXml, // depending on encoding attribute,
  svg:   e.svg // depending on embedXml context
  // #default: c.otherForeign
}

// Svg namespace

const svgEqClasses = {
  foreignobject: c.embedHtml,
  title: c.embedHtml,
  desc: c.embedHtml,
  // #default: c.otherForeign
}

const breakoutEqClasses = {

  b:       c.otherFmt,
  big:     c.otherFmt,
  code:    c.otherFmt,
  em:      c.otherFmt,
  i:       c.otherFmt,
  s:       c.otherFmt,
  small:   c.otherFmt,
  strike:  c.otherFmt,
  strong:  c.otherFmt,
  tt:      c.otherFmt,
  u:       c.otherFmt,

  h1:      c.h1_h6,
  h2:      c.h1_h6,
  h3:      c.h1_h6,
  h4:      c.h1_h6,
  h5:      c.h1_h6,
  h6:      c.h1_h6,

  sub:     c.subsup,
  sup:     c.subsup,
  var:     c.subsup,
  ruby:    c.subsup,
  span:    c.subsup,

  dl:      c.dlquote,
  menu:    c.dlquote,
  center:  c.dlquote,
  blockquote: c.dlquote,

  listing: c.pre,
  pre:     c.pre,

  dd:      c.dddt,
  dt:      c.dddt,

  ul:      c.list,
  ol:      c.list,

  body:    e.body,
  br:      e.br,
  div:     e.div,
  embed:   e.embed,
  font:    e.font, // only if it has a specialFontAttribute,
  head:    e.head,
  hr:      e.hr,
  img:     e.img,
  li:      e.li,
  meta:    e.meta,
  nobr:    e.nobr,
  p:       e.p,
  table:   e.table
}

// Html namespace

const htmlEqClasses = Object.assign ({

  summary:    c.section,
  article:    c.section,
  aside:      c.section,
  details:    c.section,
  dialog:     c.section,
  dir:        c.section,
  fieldset:   c.section,
  figcaption: c.section,
  figure:     c.section,
  footer:     c.section,
  header:     c.section,
  hgroup:     c.section,
  main:       c.section,
  nav:        c.section,
  plaintext:  c.section,
  section:    c.section,

  base:       c.otherMeta,
  basefont:   c.otherMeta,
  bgsound:    c.otherMeta,
  link:       c.otherMeta,

  param:      c.otherVoid,
  source:     c.otherVoid,
  track:      c.otherVoid,

  applet:     c.object,
  marquee:    c.object,
  object:     c.object,

  tbody:      c.tbody,
  tfoot:      c.tbody,
  thead:      c.tbody,

  td:         c.cell,
  th:         c.cell,

  area:       c.areawbr,
  wbr:        c.areawbr,

  iframe:     c.otherRaw,
  noembed:    c.otherRaw,

  col:        e.col,
  address:    e.address,
  form:       e.form,
  option:     e.option,
  frame:      e.frame,
  keygen:     e.keygen,
  style:      e.style,
  noframes:   e.noframes,
  html:       e.html,
  tr:         e.tr,
  button:     e.button,
  textarea:   e.textarea,
  caption:    e.caption,
  template:   e.template,
  xmp:        e.xmp,
  image:      e.image,
  math:       e.math,
  title:      e.title,
  select:     e.select,
  colgroup:   e.colgroup,
  a:          e.a,
  noscript:   e.noscript,
  svg:        e.svg,
  script:     e.script,
  optgroup:   e.optgroup,
  input:      e.input,
  frameset:   e.frameset,
  // #default: c.otherHtml,
}, breakoutEqClasses)


// The eqClass function

function Kind (arg1, context) {
  return 1n << BigInt (EqClass (arg1, context))
}

function EqClass ({ name, attrs }, context = S.main) {

  // in math

  if (context & S.inMath) {

    const id = breakoutEqClasses [name]
      ?? mathEqClasses [name]
      ?? classIds.otherForeign

    if (id === elemIds.font) {
      for (const name in attrs)
        if (name in _specialFontAttributes) return e.font;
      return c.otherForeign
    }

    else if (id === elemIds.svg && !(context & S.inSvg))
      return c.otherForeign

    else if (id === elemIds.embedXml && attrs && attrs.encoding) {
      const v = attrs.encoding.toLowerCase ()
      if (v === 'text/html' || v === 'application/xhtml+xml')
        return c.embedHtml
    }

    return id
  }
  
  // in svg

  else if (context & S.inSvg) {

    const id = breakoutEqClasses [name]
      ?? svgEqClasses [name]
      ?? classIds.otherForeign

    if (id === elemIds.font) {
      for (const name in attrs) {
        if (name in _specialFontAttributes) return e.font;
      }
      return c.otherForeign
    }

    return id
  }
  
  // In html

  const id = htmlEqClasses [name]
    ?? classIds.otherHtml

  if (id === elemIds.input && attrs && attrs.type && attrs.type.toLowerCase () === 'hidden')
    return c.hiddenInput

  return id
}


// Printing
// --------

function printKind (info) {
  if (info === ~0n) return 'Any'
  if (info === 0n) return 'None'
  const _info = info < 0n ? ~info : info
  const r = []
  for (let k in E) if (_info & E[k]) r.push ('E.'+k)
  for (let k in Cats) if (Cats [k] & _info) r.push ('C.'+k)
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
  C, E, classIds, elemIds,
  Any, None, EqClass, Kind, _kinds, printKind, S as states
}