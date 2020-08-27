const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 parser
// ============

// States and Tokens
// -----------------

const [
  /* States/ Tokens */
  PlainText, RawText, RcData, Data, EndTag, Comment, MDecl, Bogus, AMP_IN,
  TagName, BeforeAtt, AttName, AfterAttName, Assign, BeforeValue, Value,
  /* Tokens, though  StartTagStart and EndTagStart, CommentStart and CommentEnd are used as substate, too */
  StartQuote, EndQuote, StartTagStart, EndTagStart, TagEnd, BogusStart, BogusEnd, CommentStart, CommentEnd, Space ] = range (1)

const names = [ null,
  /* State/ Token names */
  'plaintext', 'rawtext', 'rcdata', 'data', 'close', 'commentData', 'mdecl', 'commentData', 'amp_in',
  'tagName', 'beforeAttribute', 'attributeName', 'afterAttributeName', 'attributeAssign', 'beforeValue', 'attributeValueData',
  /* Token names */
  'attributeValueStart', 'attributeValueEnd', 'startTagStart', 'endTagStart', 'tagEnd', 'commentStartBogus', 'commentEndBogus', 'commentStart', 'commentEnd', 'space' ]

// A Tokenizer state consists of...
// a state/ substate, last seen char, optional quote-char, content, tagname and tagname_

function printState ({st, last, quote, sub } = {}) {
  return names [st] +
    (sub && (st === TagName || st === Comment) ? '_' + names[sub] : '') +
    ('</-!' .split ('') .includes (last) ? ` (${last})` : '')
}


// The tokenizer is parameterized by a configuration
// that specifies rawtext, plaintext and rcdata tags. 

const contentMap = 
  { style: RawText
  , script: RawText
  , xmp: RawText
  , iframe: RawText
  , noembed: RawText
  , noframes: RawText
  , textarea: RcData
  , title: RcData
  , plaintext: PlainText
  //, noscript: RawText // if scripting is enabled in a UA
  }


// Lexer
// -----

const isSpace = c => /[\t\n\f ]/.test (c)
const isAlpha = c => /[a-zA-Z]/.test (c)

function chunks (input) {
  let state = { st:Data, label:Data, last:'', quote:'', sub:null, content:Data }
  let lastEmit = 0 // emitter position
  let label0 = Data, label1 // output labels

  const generator = (function* () {
    generator.state = state
    generator.position = lastEmit
    for (let i=0, l=input.length; i<l; i++) {
      const c = input[i]
      // log (c, printState (state))
      state = delta (state, c)

      label1 = state.label
      if (Array.isArray (label1)) {
        label0 = label0 || label1[0]
        label1 = label1[1]
      }
      if (label1 !== label0) {
        if (label0) {
          yield [names[label0], input.substring (lastEmit, i)]
          lastEmit = i
          generator.state = state
          generator.position = i
        }
      }
      label0 = label1
    }
    yield [names[label0], input.substring (lastEmit, input.length)]
  })()

  return generator
}


// The transition table!
// ---------------------

// NB the quote is reset only upon a new value,
// so, it refers to the last seen opening quote if in Value state,
// and to the last seen closing quote otherwise. 

function delta ({ st, sub, last, quote, tagname, tagname_, content }, c) {
  let label; do {
  
  if (st === Value && quote) { // rows - quoted values
    [label, st] = quote === c ? [EndQuote, BeforeAtt] : [Value, Value]
    continue }

  if (c === '/' && last === '<' && st <= Data) { // cells - start closetag
    [label, st] = [null, EndTag]
    continue }

  if (last === '<' && st === Data) { // row - potential start tag in data
    [label, st, sub, tagname_] = 
      isAlpha (c) ? [null, TagName, StartTagStart, c]
      : c === '!' ? [null, MDecl, null, null]
      : c === '?' ? [BogusStart, Bogus, null, null]
      : [Data, Data, null, null]
    continue }

  if (st >= TagName && c === '>') { // cells
    if (sub === EndTagStart && content !== Data && tagname !== tagname_)
      [label, st] = [content, content]
    else {
      [tagname, content] = sub === StartTagStart
        ? [tagname_, contentMap [tagname_] || Data]
        : ['', Data]
      label = [st === TagName ? sub : null, TagEnd]
      ;[st, sub] = [content, null]
    }
    continue }

  if (c === '>') { // remains of the '>' column
    if (st === Comment)
      [label, st, sub] = sub === CommentEnd || sub === CommentStart && last === '-'
        ? [CommentEnd, Data, null]
        : [Comment, Comment, null]
    else if (st === EndTag || st === MDecl)
      [label, st] = [[BogusStart, BogusEnd], content]
    else if (st === Bogus)
      [label, st] = [[st, BogusEnd], content]
    else
      [label, st] = [content, content]
    continue
  }

  if (st === EndTag) { // rows - start closetag - tagname or bogus
    [label, st, sub, tagname_]
      = isAlpha (c) ? [null, TagName, EndTagStart, c]
      : [[BogusStart, Bogus], Bogus, null, null]
    continue
  }

  if (st === TagName) { // row
    if (c === '/' || isSpace (c)) // cells '/' and space
      [label, st] = (sub === EndTagStart && content !== Data && tagname !== tagname_)
        ? [content, content]
        : [[sub, null], BeforeAtt]
    else [label, tagname_] = [null, tagname_ + c]
    continue
  }

  if (st === Comment) {
    if (c === '-')
      [label, sub] = last === '-' ? [null, CommentEnd] : sub !== CommentStart ? [null, null] : [null, sub]
    else if (c === '!' && sub === CommentEnd && last !== c)
      label = null
    else sub = null
  }

  if (st === MDecl) { // rows (cells first)
    if (c === '-') [label, st, sub]
      = last === '-' ? [CommentStart, Comment, CommentStart]
      : [null, MDecl, null]
    else [label, st] = [[BogusStart, Bogus], Bogus]
    continue }

  if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
    [label, st]
      = st <= Data ? [[content, Space], st]
      : st === Value && !quote ? [[st, null], BeforeAtt]
      : st === AttName ? [null, AfterAttName]
      : [st, st]; continue }

  if (st === BeforeValue) { let l // row
    [l, quote] = c === '"' || c === "'" ? [StartQuote, c] : [Value, '']
    ;[label, st] = [[BeforeValue, l], Value]
    continue }

  if (c === '=' && (st === AfterAttName || st === AttName)) { // cells
    [label, st] = [[st, Assign], BeforeValue]
    continue }

  if (c === '/') { // column
    [label, st]
      = st === AfterAttName || st === AttName ?  [[st, null], BeforeAtt]
      : st !== Value && st > TagName ? [null, st]
      : [st,st]; continue }
  
  else if (st === BeforeAtt || st === AfterAttName) { // rows - start attribute name
    [label, st] = [[st, AttName], AttName]
    continue }

  // That's all !!
  } while (false) // just once for now
  if (label === undefined) label = c === '<' ? null : st // TODO clean
  return { st, sub, last:c, quote, tagname, tagname_, content, label }
}


// Exports
// -------

module.exports = { chunks, stateNames:names, printState }