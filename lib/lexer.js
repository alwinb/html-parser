const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 parser
// ============

// States and Tokens
// -----------------

const [
  /* States/ Tokens/ Substates */
  PlainText, RawText, RcData, Data, EndTag, Comment, MDecl, Bogus, AMP_IN,
  TagName, BeforeAtt, AttName, AfterAttName, Assign, BeforeValue, Value,
  StartTagStart, EndTagStart, CommentStart, CommentEnd, 
  StartQuote, EndQuote, TagEnd, BogusStart, BogusEnd, Space ] = range (1)

const names = [ null,
  /* Stat/ Token/ Substate/ names */
  'plaintext', 'rawtext', 'rcdata', 'data', 'close', 'commentData', 'mdecl', 'commentData', 'amp_in',
  'tagName', 'beforeAttribute', 'attributeName', 'afterAttributeName', 'attributeAssign', 'beforeValue', 'attributeValueData',
  'startTagStart', 'endTagStart',
  'commentStart', 'commentEnd',
  'attributeValueStart', 'attributeValueEnd', 'tagEnd', 'commentStartBogus', 'commentEndBogus', 'space' ]


// The tokenizer is parameterized by a configuration
// that specifies rawtext, plaintext and rcdata tags. 
// I like the idea of doing additional annotations though

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


// const _isSpace = /^[\t\n\r\f ]$/
// c === ' ' || c === '\t' || c === '\n' || c === '\f'

const isSpace = c => {
  let d = c.charCodeAt (0)
  return 9 <= d && d <= 13 && d !== 11 || d === 32
}

const isAlpha = c => {
  let d = c.charCodeAt (0)
  if (d <= 90) d += 32
  return 97 <= d && d <= 122 }

function printState ({st, last, quote, sub } = {}) {
  return names [st] +
    (sub && (st === TagName || st === Comment) ? '_' + names[sub] : '') +
    ('</-!' .split ('') .includes (last) ? ` (${last})` : '')
}

function chunks (input) {

  const generator = (function* () {

    // Table state
    // Consisting of a state, substate, after-tag content, last seen char, quotation type, tagname and tagname_

    let st = Data, sub = null, content = Data
    let last = '', quote = ''
    let tagname = '', tagname_ = ''

    // Emitter state
    let lastEmit = 0 // emitter position
    let label0 = Data, label1 // output labels


    generator.state = { st, sub, last, quote, tagname, tagname_, content }
    generator.position = lastEmit

    // Main loop
    for (let i=0, l=input.length; i<l; i++) {
      // log (c, printState ({ st, sub, last, quote, tagname, tagname_, content }))
      const c = input[i]
      let labels

      ////////// Start of transition table //////////
      do {
      labels = undefined
      if (st === Value && quote) { // rows - quoted values
        [labels, st] = quote === c ? [EndQuote, BeforeAtt] : [Value, Value]
        continue }

      if (c === '/' && last === '<' && st <= Data) { // cells - start closetag
        [labels, st] = [null, EndTag]
        continue }

      if (last === '<' && st === Data) { // row - potential start tag in data
        [labels, st, sub, tagname_] = 
          isAlpha (c) ? [null, TagName, StartTagStart, c]
          : c === '!' ? [null, MDecl, null, null]
          : c === '?' ? [BogusStart, Bogus, null, null]
          : [Data, Data, null, null]
        continue }

      if (st >= TagName && c === '>') { // cells
        if (sub === EndTagStart && content !== Data && tagname !== tagname_)
          [labels, st] = [content, content]
        else {
          [tagname, content] = sub === StartTagStart
            ? [tagname_, contentMap [tagname_] || Data]
            : ['', Data]
          labels = [st === TagName ? sub : null, TagEnd]
          ;[st, sub] = [content, null]
        }
        continue }

      if (c === '>') { // remains of the '>' column
        if (st === Comment)
          [labels, st, sub] = sub === CommentEnd || sub === CommentStart && last === '-'
            ? [CommentEnd, Data, null]
            : [Comment, Comment, null]
        else if (st === EndTag || st === MDecl)
          [labels, st] = [[BogusStart, BogusEnd], content]
        else if (st === Bogus)
          [labels, st] = [[st, BogusEnd], content]
        else
          [labels, st] = [content, content]
        continue
      }

      if (st === EndTag) { // rows - start closetag - tagname or bogus
        [labels, st, sub, tagname_]
          = isAlpha (c) ? [null, TagName, EndTagStart, c]
          : [[BogusStart, Bogus], Bogus, null, null]
        continue
      }

      if (st === TagName) { // row
        if (c === '/' || isSpace (c)) // cells '/' and space
          [labels, st] = (sub === EndTagStart && content !== Data && tagname !== tagname_)
            ? [content, content]
            : [[sub, null], BeforeAtt]
        else [labels, tagname_] = [null, tagname_ + c]
        continue
      }

      if (st === Comment) {
        if (c === '-')
          [labels, sub] = last === '-' ? [null, CommentEnd] : sub !== CommentStart ? [null, null] : [null, sub]
        else if (c === '!' && sub === CommentEnd && last !== c)
          labels = null
        else sub = null
      }

      if (st === MDecl) { // rows (cells first)
        if (c === '-') [labels, st, sub]
          = last === '-' ? [CommentStart, Comment, CommentStart]
          : [null, MDecl, null]
        else [labels, st] = [[BogusStart, Bogus], Bogus]
        continue }

      if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
        [labels, st]
          = st <= Data ? [[content, Space], st]
          : st === Value && !quote ? [[st, null], BeforeAtt]
          : st === AttName ? [null, AfterAttName]
          : [st, st]; continue }

      if (st === BeforeValue) { let l // row
        [l, quote] = c === '"' || c === "'" ? [StartQuote, c] : [Value, '']
        ;[labels, st] = [[BeforeValue, l], Value]
        continue }

      if (c === '=' && (st === AfterAttName || st === AttName)) { // cells
        [labels, st] = [[st, Assign], BeforeValue]
        continue }

      if (c === '/') { // column
        [labels, st]
          = st === AfterAttName || st === AttName ?  [[st, null], BeforeAtt]
          : st !== Value && st > TagName ? [null, st]
          : [st,st]; continue }

      else if (st === BeforeAtt || st === AfterAttName) { // rows - start attribute name
        [labels, st] = [[st, AttName], AttName]
        continue }

      // That's all !!
      } while (false) // just once for now
      if (labels === undefined) labels = c === '<' ? null : st // TODO clean
      last = c
      ////////// End of transition table //////////
      
      //////////  Start of emitter code  //////////
      // TODO clean this up a bit
      ;[label0, label1] = Array.isArray (labels) ? [label0 || labels[0], labels[1]] : [label0, labels]
      if (label1 !== label0) {
        if (label0) {
          yield [names[label0], input.substring (lastEmit, i)]
          lastEmit = i
          generator.state = { st, sub, last, quote, tagname, tagname_, content, label0, label1 }
          generator.position = i
        }
      }
      label0 = label1
    }
    yield [names[label0], input.substring (lastEmit, input.length)]

  })()
  return generator
}


// Exports
// -------

module.exports = { chunks, stateNames:names, printState }