import { E, C, elemIds, classIds, Any, None, printKind, states as S, Kind, EqClass } from './categories.js'
import { Rules as _Rules, defaultRules as _defaultRules } from './rules.js'
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

  constructor (r, name = r.name) {
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

const R = {}
for (const k in _Rules)
  R[k] = new Rule (_Rules[k], k)

const defaultRules =
  _defaultRules.map (r => r ? new Rule (r, r.name) : new Rule ({}, 'emptyRule'))


// Transition functions
// ====================

const _otherInFlow =
  defaultRules [classIds.otherHtml]

function childRule (ctx, node) {
  const id = EqClass (node, ctx)
  switch (id) {
    case elemIds.select:
      return ctx & S.inTable ? R.inSelectInTable
        : defaultRules [id];

    case elemIds.option:
      return ctx & S.inSelect ? R.optionInSelect
        : ctx & S.inParagraph ? R.optionInPhrasing
        : defaultRules [id];

    case elemIds.optgroup:
      return ctx & S.inSelect ? R.optgroupInSelect
        : ctx & S.inParagraph ? R.optgroupInPhrasing
        : defaultRules [id];

    default:
      const rule = defaultRules [id]
      return rule === _otherInFlow && ctx & S.inParagraph
        ? R.otherInPhrasing : rule
  }
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



// Exports
// =======

const { documentRule, fragmentRule } = R
export { 
  documentRule, fragmentRule, 
  childRule, siblingRule,
  R as Rules,
}