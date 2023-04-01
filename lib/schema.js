import { E, C, elemIds, classIds, Any, None, printKind, states as S, Kind } from './categories.js'
import { Rules as _Rules } from './rules.js'
const log = console.log.bind (console)

// Schema
// ======

// The rules may declare:
// * modifiers:
//   hide, escalate, allow, hidenest,
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
    this.hidenest  = (r.hidenest ?? None)
    this.hide      = (r.hide    ?? None) | _unclosable
      // adding void / rc / raw is an optimisation
    this.escalate  = r.escalate ?? None
    this.content   = (r.content ?? None) | (r.trap ?? None)
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
    let opens = '<table style="border-collapse:collapse;display:inline-table">'
    let closes = '<table style="border-collapse:collapse;display:inline-table">'
    let nests = '<table style="border-collapse:collapse;display:inline-table">'
    const actions = [], names = []
    for (let i=0; i<64; i++) {
      const x = 1n<<BigInt (i)
      const n = printKind (x)
      const h = `<td title=${n}>${this.hide & x ? '🈲' : '⇧'}</td>`;
      const hn = `<td title=${n}>${this.hidenest & x ? '🟩' : '◽️'}</td>`;
      const a = 
        this.trap & x ? `<td title=${n}>♻️</td>` : 
        // this.content  & x && this.hidenest & x ? `<td title=${n}>⇧</td>` :
        this.content  & x ? `<td title=${n}>✅</td>` : 
        this.openFor  & x ? `<td title=${n}>▶️</td>` : 
        this.escalate & x ? `<td title=${n}>⇧</td>` : 
        `<td title=${n}>🈲</td>`
      if (i%8===0) { opens += '<tr>'; closes += '<tr>'; nests += '<tr>' }
      opens += a
      closes += h
      nests += hn
    }
    opens += '</table>'
    closes += '</table>'
    nests += '</table>'
    log (this.name ? `<h4 style=margin-bottom:0>${this.name}</h4><div>` : this, '<br>', opens, nests, closes, '</div>')
    if (typeof process !== 'undefined') process.exitCode = 205
    return this
  }

}


// Compile the rules
// =================

const Rules = {}
const R = Rules
for (const k in _Rules) {
  Rules[k] = new Rule (_Rules[k], k)
}


// Transition functions
// ====================

function childRule (state, name, kind) {
  let rule
  if (state & S.inMath)
    return kind & C.embedHtml ? R.inEmbeddedHtml
        : kind  & E.embedXml  ? R.inEmbeddedXml 
        : state & S.inSvg && kind & E.svg ? R.inSvg // TODO remove hack case for inAnnotationXML
        : mathRules [name] ?? R.inMath

  if (state & S.inSvg)
    return svgRules [name] ?? R.inSvg

  if (state & S.inTable && (rule = tableRules [name]))
    return rule

  if (state & S.inSelect && (rule = selectRules [name]))
    return rule

  if (state & S.inParagraph && (rule = pRules [name]))
    return rule

  if (name in defaultRules)
    return defaultRules [name]
  // Keep ordered
  if (kind & (C.block | E.button)) // also in paragraph (E.p is in C.block)
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

  ol:        R.inList,
  ul:        R.inList,
  li:        R.inListItem,
  dt:        R.inDListItem,
  dd:        R.inDListItem,

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
  iframe:    R.inData, // rcdata
  plaintext: R.inData, // no corresponding bit yet...

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
  optgroup: R.optgroupInPhrasing,
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