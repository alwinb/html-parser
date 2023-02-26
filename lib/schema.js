import { E, C, Any, None, printKind, states as S, Kind } from './categories.js'
import { Rules as _Rules } from './rules.js'
const log = console.log.bind (console)

// Schema
// ======

// The rules may declare:
// * modifiers:
//   hide, escalate, allow, inherit,
// * properties:
//   state, openFor, paths, trap.
//   where state is inherited if absent,
//   and openFor and paths are reset if absent.


// Rule
// ====

const _unclosable =
  C.DOCTYPE | C.COMMENT | C.TEXT | C.SPACE | 
  C.void | C.RcDataElement | C.RawTextElement | E.html | E.body

class Rule {

  constructor (r={}, name) {
    this.name      = name
    this.state     = r.state    ?? 0 // 0 indicates 'inherit'
    this.hide      = (r.hide    ?? None) | _unclosable
      // adding void / rc / raw is an optimisation
    this.escalate  = r.escalate ?? None
    this.inherit   = r.inherit  ?? None
    this.allow     = (r.allow   ?? None) | (r.trap ?? None)
    this.trap      = r.trap     ?? None
    this.openFor   = r.openFor  ?? None
    this.paths     = r.paths    ?? null
    this.siblingRules =
      r.siblingRules ?? false
      
      // this.viz()
  }

  get info () {
    const info = Object.assign ({}, this)
    for (let k in info) if (typeof info [k] === 'bigint')
      info [k] = printKind (info [k])
    return info
  }
  
  viz () {
    // precompile...
    let opens = '<table style="border-collapse:collapse; float:left; clear:left;">'
    let closes = '<table style="border-collapse:collapse;">'
    const actions = [], names = []
    for (let i=0; i<64; i++) {
      const x = 1n<<BigInt (i)
      const n = printKind (x)
      const h = `<td title=${n}>${this.hide & x ? '⬛️' : '⬜️'}</td>`;
      const a = 
        this.trap & x ? `<td title=${n}>⤤</td>` : 
        this.allow    & x ? `<td title=${n}>✅</td>` : 
        this.openFor  & x ? `<td title=${n}>▶️</td>` : 
        this.inherit  & x && this.escalate & x ? `<td title=${n}>⇧</td>` : //
        this.inherit  & x ? `<td title=${n}>◽️</td>` :
        this.escalate & x ? `<td title=${n}>⬆️</td>` : 
        `<td title=${n}>❌</td>`
      if (i%8===0) { opens += '<tr>'; closes += '<tr>' }
      opens += a
      closes += h
    }
    opens += '</table>'
    closes += '</table>'
    log (this.name ? `<h4 style=margin-bottom:0>${this.name}</h4>` : this, '<br>', opens, closes)
    if (typeof process !== 'undefined') process.exitCode = 205
    return this
  }

}

// escalate: C.Flow, --- is C.flow the same as the following?
// allow: C.block | C.Meta | C.object | C.format | C.TEXT | C.COMMENT | C.SPACE | E.select | E.option | E.optgroup | E.svg | E.math,


// Compile the rules
// =================

const Rules = {}
const R = Rules
for (const k in _Rules) {
  Rules[k] = new Rule (_Rules[k], k)
}

///

function FlowContainer () { // WIP making rules as a base to modify
  return new Rule ({
    hide: ~(E.table | C.Tabular | C.block | C.object) | E.form | E.p,
    escalate: E.frameset | C.Tabular,
    allow: C.Flow &~ (E.table | E.button | E.form),
    inherit: E.table | E.button | E.form,
  }, 'FlowContainer')
}

function TransparentContentModel () {
  return new Rule ({
    // TODO
  }, 'TransparentContentModel')
}



const FlowContainers = [
  new FlowContainer (),
  R.inBody,
  R.inCaption,
  R.inTableCell,
  R.inObject,
  R.inButton,
  R.inForm,
  R.inDList,
  R.inList,
  R.inListItem,
  R.inDListItem,
  R.inHeading,
  R.inDivAddress,
  R.inOtherBlock,  
  R.inEmbeddedHtml,
]
// FlowContainers.map (_ => _.viz ())

const Transparant = [
  new TransparentContentModel (),
  R.otherInFlow,
  R.otherInPhrasing,
  R.optgroupInSelect,
  R.optionInSelect,
  R.optgroupInFlow,
  R.optionInFlow,
  R.optionInPhrasing,
]
// Transparant.map (_ => _.viz ())


// Transition functions
// ====================

function childRule (state, name, kind) {
  let rule
  if (state & S.inMath)
    return kind & C.annotationHtml ? R.inEmbeddedHtml
      : kind & C.annotationXml ? R.inAnnotationXml 
      : state & S.inSvg && kind & E.svg ? R.inSvg // NB Hacking it - case for inAnnotationXML
      : mathRules [name] ?? R.inMath

  if (state & S.inSvg)
    return svgRules [name] ?? R.inSvg

  if (state & S.inTable && (rule = tableRules [name]))
    return rule

  if (state & S.inSelect && (rule = selectRules [name]))
    return rule

  if (state & S.inParagraph && (rule = pRules [name]))
    return rule

  if (kind & C.h1_h6)
    return R.inHeading

  if (name in defaultRules)
    return defaultRules [name]
  // Keep ordered
  if (kind & C.block) // also in paragraph
    return R.inOtherBlock

  return state & S.inParagraph
    ? R.otherInPhrasing : R.otherInFlow
}


function siblingRule ({ kind:pkind, children }, name, kind, _allOpened) {
  if (pkind === None) // '#document'
    return children & E.html
      ? (_allOpened & E.frameset ? R.afterHtmlAfterFrameset : R.afterHtmlAfterBody)
      : children & C.DOCTYPE ? R.beforeHtml : R.beforeDoctype

  if (pkind & E.html)
    return children & E.frameset ? R.afterFrameset
      : children & E.body ? R.afterBody
      : children & E.head ? R.afterHead : R.beforeHead

  return null // NB signals 'no update' which at the moment is different from the empty rule!
}



// ### The default RuleSet

const defaultRules = {

  html:      R.beforeHead,
  head:      R.inHead,
  body:      R.inBody,
  frameset:  R.inFrameset,
  template:  R.fragmentRule, 

  applet:    R.inObject,
  object:    R.inObject,
  marquee:   R.inObject,

  svg:       R.inSvg,
  math:      R.inMath,

  select:    R.inSelect,
  option:    R.optionInFlow,
  optgroup:  R.optgroupInFlow,

  dl:        R.inDList,
  ol:        R.inList,
  ul:        R.inList,
  li:        R.inListItem,
  dt:        R.inDListItem,
  dd:        R.inDListItem,

  form:      R.inForm,
  button:    R.inButton,
  p:         R.inParagraph,

  div:       R.inDivAddress,
  address:   R.inDivAddress,

  style:     R.inData, // rawtext
  script:    R.inData, 
  xmp:       R.inData,
  noembed:   R.inData,
  noframes:  R.inData,
  textarea:  R.inData, // rcdata
  title:     R.inData, // rcdata
  iframe:    R.inData, // no corresponding bit yet
  plaintext: R.inData, // plain text // no corresponding bit yet
  // '#comment':inData, // comment data

  table:     R.inTable,
  caption:   R.inCaption,
  colgroup:  R.inColgroup,
  thead:     R.inTableBody,
  tbody:     R.inTableBody,
  tfoot:     R.inTableBody,
  tr:        R.inTableRow,
  th:        R.inTableCell,
  td:        R.inTableCell,
}

// Try; using a lookup table for the
// child rule relations
//const log2 = x => {
//  let i; for (i=0; x !== 1n; (i++, x>>=1n));
//  return i
//}
//
// for (let i=0; i<64; i++) precompiled[i] = null
// for (const k in defaultRules) {
//   let id = log2 (Kind ({name:k}, S.main))
//   precompiled [id] = defaultRules[k]
// }
//
// log (precompiled)
// process.exit (0)

// ### Table context

const tableRules = {
  select: R.inSelectInTable,
}

// ### Select context

const selectRules = {
  option: R.optionInSelect,
  optgroup: R.optgroupInSelect,
}

// ### Paragraph context 

const pRules = {
  option: R.optionInPhrasing,
  // default to defaultRules, but override defaultRules default to otherInPhrasing
}

// ### SVG and MathML contexts

const svgRules = {
  svg:  R.inSvg,
  math: R.inSvg, // NB
  foreignobject: R.inEmbeddedHtml,
  title: R.inEmbeddedHtml,
  desc: R.inEmbeddedHtml,
  // #default: inSvg,
}

const mathRules = {
  svg:  R.inMath, // NB
  math: R.inMath,
  mi: R.inEmbeddedHtml,
  mo: R.inEmbeddedHtml,
  mn: R.inEmbeddedHtml,
  ms: R.inEmbeddedHtml,
  mtext: R.inEmbeddedHtml,
  // annotation-xml: (depends on attribute)
  // #default: inMath,
}


// Exports
// =======

const { documentRule, fragmentRule } = Rules
export { 
  documentRule, fragmentRule, 
  childRule, siblingRule,
  Rules,
}