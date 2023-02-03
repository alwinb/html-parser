import { E, C, Any, None, printKind, states as S } from './categories.js'
const All = Any
const log = console.log.bind (console)

// Schema
// ======

// A schema specifies a set of DOM trees with specific invariants. 
// The schema here also specifies how to handle mismatched and misplaced tags. 
// The schema can be thought of as a directed graph of Rules connected by 
// two kinds of transitions: childNode transitions and siblingNode transitions.
// It can also be thought of as a 'cannonical tree' -- A quotient of the set of
// all trees that conform to this schema 

// The rules of the schema may declare:
// * modifiers:
//   scope, escalate, inherit, allow
// * properties:
//   state, openFor, paths
//   where state is inherited if absent,
//   and openFor and paths are reset if absent.

// Actions
// const [Ignore, Escalate, Inherit, Allow, Reparent, OpenFor] = range (0)

function Rule (r) {
  return new _Rule (r)
}

class _Rule {

  constructor (r={}) {
    if (r.name) this.name = r.name
    this.state     = r.state    ?? 0 // 0 indicates 'inherit'
    this.hide      = r.hide     ?? None
    this.escalate  = r.escalate ?? None
    this.inherit   = r.inherit  ?? None
    this.allow     = (r.allow    ?? None) | (r.reparent ?? None)
    this.reparent  = r.reparent ?? None
    this.openFor   = r.openFor  ?? None
    this.paths     = r.paths    ?? null
    this.siblingRules =
      r.siblingRules ?? false
      
      this.viz()
  }

  get info () {
    const info = Object.assign ({}, this)
    for (let k in info) if (typeof info [k] === 'bigint')
      info [k] = printKind (info [k])
    return info
  }
  
  viz () {
    // precompile...
    let txt = '<table style="border-collapse:collapse;">'
    const actions = [], names = []
    for (let i=0; i<64; i++) {
      const x = 1n<<BigInt (i)
      const n = printKind (x)
      const a = 
        this.reparent & x ? `<td title=${n}>⤤</td>` : 
        this.allow    & x ? `<td title=${n}>✅</td>` : 
        this.openFor  & x ? `<td title=${n}>▶️</td>` : 
        this.inherit  & x && this.escalate & x ? `<td title=${n}>⇧</td>` :
        this.inherit  & x ? `<td title=${n}>◽️</td>` :
        this.escalate & x ? `<td title=${n}>⬆️</td>` : 
        `<td title=${n}>❌</td>`
      if (i%8===0) txt += '<tr>'
      txt += a
    }
    txt += '</table>'
    log (this, txt)
    if (typeof process !== 'undefined') process.exitCode = 205
    return this
  }

}


// Rule ({
//   escalate: C.Flow,
//   allow: C.block | C.Meta | C.object | C.format | C.TEXT | C.COMMENT | C.SPACE | E.select | E.option | E.optgroup | E.svg | E.math,
// }).viz ()


// Rules
// =====

const documentRule = Rule ({
  state: S.main,
  escalate: None,
  allow: E.html | C.COMMENT | C.DOCTYPE,
  openFor: ~(C.SPACE | C.DOCTYPE | C.RAW | C.Tabular),
  paths: { '#default':'html' },
  siblingRules: true,
})//.viz ()

const fragmentRule = Rule ({
  state: S.main,
  escalate: None,
  allow: C.Flow,
})

// ### The 'document' rules

const beforeDoctype = 
  documentRule

const beforeHtml = Rule ({
  escalate: None,
  allow: E.html | C.COMMENT,
  openFor: ~(C.SPACE | C.DOCTYPE | C.RAW | C.Tabular),
    paths: { '#default':'html' },
  siblingRules: true,
})

const afterHtmlAfterBody = Rule ({
  // This should never be reached,
  //  the html tag should never be closed.
  escalate: None,
  allow: None,
})

const afterHtmlAfterFrameset = Rule ({
  escalate: None,
  allow: C.COMMENT,
})

// ### The 'html' rules

const inHtmlBeforeHead = Rule ({
  escalate: None,
  allow: E.head | C.COMMENT,
  openFor: ~(C.SPACE | C.DOCTYPE | C.RAW | C.Tabular | E.html),
    paths: { '#default':'head' },
  siblingRules: true,
})

const inHtmlAfterHead = Rule ({
  hide: All,
  escalate: None,
  allow:  E.body | E.frameset | C.COMMENT | C.SPACE, 
  openFor: ~(C.Meta &~ E.noscript | E.frame | E.frameset | C.SPACE | C.DOCTYPE | C.RAW | C.Tabular | E.html | E.head), 
    paths: { '#default':'body' },
  reparent: C.Meta &~ E.noscript,
  // reparent: C.SPACE,
  siblingRules: true,
})

const inHtmlAfterBody = Rule ({
  // This should never be reached,
  //  the body tag should never be closed.
  hide: All,
  escalate: None,
})

const inHtmlAfterFrameset = Rule ({
  hide: All,
  escalate: None,
  allow: E.noframes | C.SPACE | C.COMMENT
})


// ### Immediate children of the html element

const inHead = Rule ({
  name:'inHead',
  hide: All,
  escalate: C.Flow | E.body | E.frameset,
  allow: C.Meta | C.SPACE | C.COMMENT,
})

const inBody = Rule ({
  name:'inBody',
  hide: All,
  escalate: None,
  allow: C.Flow,
  reparent: E.frameset
})

const inFrameset = Rule ({
  name:'inFrameset',
  hide: All,
  escalate: None,
  allow: E.frameset | E.frame | E.noframes | C.SPACE | C.COMMENT,
})


// ### Table Rules

const inTable = Rule ({
  state: S.inTable,
  hide: All,
  escalate: E.table,
  allow: E.caption | E.colgroup | C.tbody | E.script | E.template | E.style | C.hiddenInput | C.SPACE | C.COMMENT,
  inherit: E.form,
  openFor: E.col | E.tr | C.cell,
    paths: { col:'colgroup', tr:'tbody', td:'tbody', th:'tbody' },
  reparent: C.fosterParented,
})

const inCaption = Rule ({
  hide: ~E.table,
  escalate: C.Tabular,
  allow:  C.Flow &~ E.form,
  inherit: E.form,
})

const inColgroup = Rule ({
  hide: ~E.table,
  escalate: E.table | C.Tabular | C.Flow,
  allow:  E.col | E.template | C.SPACE | C.COMMENT,
  reparent: None,
})

const inTableBody = Rule ({
  hide: ~E.table,
  escalate: E.table | C.Tabular &~ (E.tr | C.cell),
  allow: E.tr | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
  inherit: E.form,
  openFor: C.cell,
    paths: { td:'tr', th:'tr' },
  reparent: C.fosterParented
})

const inTableRow = Rule ({
  hide: ~(E.table | C.tbody),
  escalate: E.table | C.Tabular &~ C.cell,
  allow: C.cell | E.script | E.style | E.template | C.hiddenInput | C.SPACE | C.COMMENT,
  inherit: E.form,
  reparent: C.fosterParented
})

const inTableCell = Rule ({
  hide: ~(E.table | E.tr | C.tbody),
  escalate: E.table | C.Tabular,
  allow: C.Flow &~ E.form,
  inherit: E.form,
})


// ### Select Rules

const _tableIsh =
  E.table | E.caption | C.tbody | E.tr | C.cell

const inSelect = Rule ({
  name: 'inSelect',
  state: S.inSelect | S.main,
  hide: All,
  escalate: E.input | E.keygen | E.textarea,// | _tableIsh,
  allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
})

const inSelectInTable = Rule ({
  name: 'inSelectInTable',
  state: S.inSelect | S.main,
  hide: ~(E.table | C.Tabular),
  escalate: E.input | E.keygen | E.textarea | _tableIsh,
  allow: E.option | E.optgroup | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
})

const inOptgroupInSelect = Rule ({
  escalate: E.input | E.keygen | E.textarea | _tableIsh | E.optgroup,
  allow: E.option | E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
})

const inOptionInSelect = Rule ({
  escalate: E.input | E.keygen | E.textarea | _tableIsh | E.optgroup | E.option,
  allow: E.script | E.template | C.TEXT | C.SPACE | C.COMMENT,
})


// ### Block level

const _scope =
  ~(E.table | C.Tabular | C.object | C.block)

const inObject = Rule ({ // applet, object, marquee
  hide: ~(E.table | C.Tabular),
  escalate: E.table | C.Tabular,
  allow: C.Flow &~ E.form,
  inherit: E.form,
})

const inButton = Rule ({
  name: 'inButton',
  hide: _scope | E.form | E.p,
  escalate: E.table | C.Tabular | E.button,
  allow: C.Flow &~ (E.button | E.form),
})

const inForm = Rule ({
  hide: _scope,
  escalate: E.table | C.Tabular | E.button,
  allow: C.Flow &~ (E.button | E.form),
  inherit: E.button,
})

const inDList = Rule ({
  hide: _scope | E.form,
  escalate: E.table | C.Tabular | E.button,
  allow: C.Flow &~ (E.button | E.form),
  inherit: E.button | E.form,
})

const inList = Rule ({
  hide: _scope | E.form | E.li,
  escalate: E.table | C.Tabular | E.button,
  allow: C.Flow &~ (E.button | E.form),
  inherit: E.button | E.form,
})

const inListItem = Rule ({
  hide: _scope,
  escalate: E.table | C.Tabular | E.button | E.li,
  allow: C.Flow &~ (E.button | E.form | E.li),
  inherit: E.button | E.form,
})

const inDListItem = Rule ({
  hide: _scope | E.form,
  escalate: E.table | C.Tabular | E.button | C.dddt,
  allow: C.Flow &~ (E.button | E.form | C.dddt),  
  inherit: E.button | E.form,
})

const inHeading = Rule ({
  hide: _scope | E.form,
  escalate: E.table | C.Tabular | E.button | C.h1_h6,
  allow: C.Flow &~ (C.h1_h6 | E.button | E.form),
  inherit: E.button | E.form,
})

const inDiv = Rule ({ // address, div
  name: 'inDiv',
  hide: _scope | E.form,
  escalate: E.table | C.Tabular | E.button | E.form | C.dddt | E.li | E.frameset,
  allow: C.Flow &~ (E.button | E.form | C.dddt | E.li),
  inherit: E.button | E.form | C.dddt | E.li,
})

const inOtherBlock = Rule ({ // Special block except address, div
  name: 'inOtherBlock',
  hide: _scope | E.form,
  escalate: E.table | C.Tabular | E.button | E.form | C.dddt | E.frameset,
  allow: C.Flow &~ (E.button | E.form | C.dddt),
  inherit: E.button | E.form | C.dddt, // !!! NB NB inherit overlaps with escalate! 
  // So that means what? if allowed in the parent then it is allowed here,
  // if it is not allowed in the parent then it should either escalate (to a higher parent) or be ignored
  // So figure out that formalism then!
})

const inOption = Rule ({
  name: 'inOption',
  hide: E.svg | E.math | E.html | E.body,
  escalate: E.table | C.Tabular | E.button | E.form | C.dddt | E.li | E.option | E.optgroup,
  allow: C.Flow &~ (E.button | E.form | C.dddt | E.li | E.option | E.optgroup),
  inherit: E.button | E.form | C.dddt | E.li,
})

const inOtherInBlock = Rule ({
  name: 'inOtherInBlock',
  hide: E.svg | E.math | E.html | E.body,
  escalate: ~(C.DOCTYPE | C.RAW | E.html | E.body | E.head | E.frame | C.COMMENT | C.SPACE | C.TEXT | C.otherXml),
  allow: C.Flow &~ (E.button | E.form | C.dddt | E.li),
  inherit: E.button | E.form | C.dddt | E.li,
})

// ### Phrasing

const inParagraph = Rule ({
  name: 'inParagraph',
  state: S.main | S.inParagraph,
  hide: _scope,
  escalate: E.table | C.Tabular | C.block,
  allow: C.Phrasing,
  inherit: E.button,
})

const inOptionInParagraph = Rule ({
  name: 'inOptionInParagraph',
  state: S.main | S.inParagraph,
  hide: E.svg | E.math | E.html | E.body,
  escalate: E.table | C.Tabular | C.block | E.option | E.optgroup,
  allow: C.Phrasing &~ (E.option | E.optgroup),
  inherit: E.button,
})

const inOtherInParagraph = Rule ({
  name: 'inOtherInParagraph',
  state: S.main | S.inParagraph,
  hide: E.svg | E.math | E.html | E.body | E.form, // REVIEW
  escalate: E.table | C.Tabular | C.block,
  allow: C.Phrasing,
  inherit: E.button,
})

// ### Rawtext and RCData content

const inData = Rule ({
  allow: C.SPACE | C.RAW,
  escalate: All,
})

// ### Foreign Content Rules

// NB I am currently doing context / namespace dependent
// kind annotations.

const inSvg = Rule ({
  name: 'inSvg',
  state: S.inSvg,
  hide: E.html | E.body,
  escalate: C.breakout | C.Tabular, // REVIEW
  allow: C.Foreign,
})

const inMath = Rule ({
  state: S.inMath,
  hide: E.html | E.body,
  escalate: C.breakout | C.Tabular,
  allow: C.Foreign,
})

const inEmbeddedHtml = Rule ({
  name: 'inEmbeddedHtml',
  state: S.main,
  hide: ~(E.svg | E.math | E.table | C.Tabular), // NB. note that most all other rules disallow closing svg elements!
  escalate: E.table | C.Tabular,
  allow: C.Flow,
  reparent: E.frameset,
})

const inAnnotationXml = Rule ({
  name: 'inAnnotationXml',
  state: S.main|S.inMath|S.inSvg, // REVIEW
  hide: ~(E.svg | E.math | E.table),
  reparent: None, //E.frameset,
  escalate: C.breakout | E.table, // REVIEW
  allow: (C.Flow & C.Foreign) | (E.svg | C.otherXml), // REVIEW
})


// RuleSets
// ========

// ### The Main RuleSet

const mainRules = {

  html:      inHtmlBeforeHead,
  head:      inHead,
  body:      inBody,
  frameset:  inFrameset,

  template: Rule ({
    // everything is allowed! -- TODO html and body and frame too? -- no, 
    // and in fact td is different yet (siblings set the context?)
    hide: All,
    allow:  ~(E.body | E.frameset | E.frame | C.RAW),
  }),

  applet:    inObject,
  object:    inObject,
  marquee:   inObject,

  svg:       inSvg,
  math:      inMath,

  select:    inSelect,
  option:    inOption,

  dl:        inDList,
  ol:        inList,
  ul:        inList,
  li:        inListItem,
  dt:        inDListItem,
  dd:        inDListItem,

  form:      inForm,
  button:    inButton,
  p:         inParagraph,

  div:       inDiv,
  address:   inDiv,

  style:     inData, // rawtext
  script:    inData, 
  xmp:       inData,
  iframe:    inData,
  noembed:   inData,
  noframes:  inData,
  textarea:  inData, // rcdata
  title:     inData, // rcdata
  plaintext: inData, // plain text
  '#comment':inData, // comment data

  table:     inTable,
  caption:   inCaption,
  colgroup:  inColgroup,
  thead:     inTableBody,
  tbody:     inTableBody,
  tfoot:     inTableBody,
  tr:        inTableRow,
  th:        inTableCell,
  td:        inTableCell,
}

// ### Table state

const tableRules = {
  select: inSelectInTable,
}

// ### Select state

const selectRules = {
  option: inOptionInSelect,
  optgroup: inOptgroupInSelect,
}

// ### Paragraph state 

const pRules = {
  option: inOptionInParagraph,
  // optgroup: inOptgroupInParagraph,
}

// ### SVG and MathML states

const svgRules = {
  svg:  inSvg,
  math: inSvg, // NB
  foreignobject: inEmbeddedHtml,
  title: inEmbeddedHtml,
  desc: inEmbeddedHtml,
  // #default: inSvg,
}

const mathRules = {
  svg:  inMath, // NB
  math: inMath,
  mi: inEmbeddedHtml,
  mo: inEmbeddedHtml,
  mn: inEmbeddedHtml,
  ms: inEmbeddedHtml,
  mtext: inEmbeddedHtml,
  // annotation-xml: (depends on attribute)
  // #default: inMath,
}



function childRule (context, name, kind) { let rule
  
  if (context & S.inMath)
    return kind & C.annotationHtml ? inEmbeddedHtml
      : kind & C.annotationXml ? inAnnotationXml 
      : context & S.inSvg && kind & E.svg ? inSvg // NB Hacking it - case for inAnnotationXML
      : mathRules [name] ?? inMath

  if (context & S.inSvg)
    return svgRules [name] ?? inSvg

  if (context & S.inTable && (rule = tableRules [name]))
    return rule

  if (context & S.inSelect && (rule = selectRules [name]))
    return rule

  if (context & S.inParagraph && (rule = pRules [name]))
    return rule

  if (kind & C.h1_h6)
    return inHeading

  if (name in mainRules)
    return mainRules [name]
  // Keep ordered
  if (kind & C.block)
    return inOtherBlock

  return context & S.inParagraph
    ? inOtherInParagraph : inOtherInBlock
}


function siblingRule ({ kind:pkind, children }, name, kind, _allOpened) {
  if (pkind === None) // '#document'
    return children & E.html
      ? (_allOpened & E.frameset ? afterHtmlAfterFrameset : afterHtmlAfterBody)
      : children & C.DOCTYPE ? beforeHtml : beforeDoctype

  if (pkind & E.html)
    return children & E.frameset ? inHtmlAfterFrameset
      : children & E.body ? inHtmlAfterBody
      : children & E.head ? inHtmlAfterHead
      : inHtmlBeforeHead

  return null // NB signals 'no update' which at the moment is different from the empty rule!
}

// Exports
// =======

export { 
  documentRule, fragmentRule, childRule, siblingRule
}