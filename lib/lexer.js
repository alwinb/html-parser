const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 parser
// ============

// States and Tokens
// -----------------

const [
  /* States/ Tokens/ Substates */
  PlainText, RawText, RcData, Data, LT_SL, Comment, MDecl, Bogus, AMP_IN,
  TagName, BeforeAtt, AttName, AfterAttName, Assign, BeforeValue, Value,
  StartTagStart, EndTagStart, CommentStart, CommentEnd, 
  StartQuote, EndQuote, TagEnd, BogusStart, BogusEnd, Space ] = range (1)

const tokenTypes =  {
  PlainText, RawText, RcData, Data, Comment, Bogus, 
  BeforeAtt, AttName, AfterAttName, Assign, BeforeValue, Value,
  StartTagStart, EndTagStart, CommentStart, CommentEnd, 
  StartQuote, EndQuote, TagEnd, BogusStart, BogusEnd, Space
}

tokenTypes.EndTag =  tokenTypes.EndTagStart
tokenTypes.StartTag =  tokenTypes.StartTagStart



const names = [ null,
  /* Stat/ Token/ Substate/ names */
  'plaintext', 'rawtext', 'rcdata', 'data', 'close', 'commentData', 'mdecl', 'commentData', 'amp_in',
  'tagName', 'beforeAttribute', 'attributeName', 'afterAttributeName', 'attributeAssign', 'beforeValue', 'attributeValueData',
  'startTagStart', 'endTagStart',
  'commentStart', 'commentEnd',
  'attributeValueStart', 'attributeValueEnd', 'tagEnd', 'commentStartBogus', 'commentEndBogus', 'space' ]

// The tokenizer is parameterized by a configuration
// that specifies rawtext, plaintext and rcdata tags. 
// I like the idea of doing additional annotations here though
// Maybe tag categories/ scope boundaries, cool

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

// Internally this is a lazy pull parser, thus the main loop
// is driven by batchRead and/(or) read calls. 

// const _isSpace = /^[\t\n\r\f ]$/
const isSpace = c => {
  let d = c.charCodeAt (0)
  return 9 <= d && d <= 13 && d !== 11 || d === 32 }

const isAlpha = c => {
  let d = c.charCodeAt (0)
  if (d <= 90) d += 32
  return 97 <= d && d <= 122 }

function printState ({ st, last, quote, sub } = {}) {
  return names [st] +
    (sub && (st === TagName || st === Comment) ? '_' + names[sub] : '') +
    ('</-!' .split ('') .includes (last) ? ` (${last})` : '')
}

function Lexer () {
  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname buffer

  // Stream and Emitter  state
  let writable          // false after an end () call
  let rest, buffer      // retained incomplete chunk, input buffer
  let label0, label1    // output labels

  const self = this
  Object.assign (this, { restart, write, end, batchRead, read })
  Object.defineProperty (this, 'state', { get: $=> ({ st, sub, content, last, quote, tagname, tagname_ })})
  restart () // init

  function restart () {
    st = content = Data; sub = null
    last = quote = tagname = tagname_ = rest = ''
    writable = true
    buffer = []
    label0 = Data
    label1 = null
    return self
  }

  function write (str) {
    if (writable && str.length)
      buffer.push (str)
    return self
  }

  function end (str = '') {
    if (writable && str.length)
      buffer.push (str)
    writable = false
    return self
  }

  function* read () {
    for (let [x] of batchRead (1))
      yield x
  }

  function* batchRead (n = 4) {
    let input, lastEmit
    let output = []
    while (buffer.length) {
      lastEmit = 0
      input = rest + buffer.shift ()
      // log ('readLoop', { rest, input, lastEmit, buffer})
      for (let i=rest.length, l=input.length; i<l; i++) {

        //////////  This is the Lexer Core  ///////////
        ////////// Start of transition table //////////

        let labels
        const c = input[i]
        do {
          labels = undefined
          if (st === Value && quote) { // rows - quoted values
            [labels, st] = quote === c ? [EndQuote, BeforeAtt] : [Value, Value]
            continue }

          if (c === '/' && last === '<' && st <= Data) { // cells - start closetag
            [labels, st] = [null, LT_SL]
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
            else if (st === LT_SL || st === MDecl)
              [labels, st] = [[BogusStart, BogusEnd], content]
            else if (st === Bogus)
              [labels, st] = [[st, BogusEnd], content]
            else
              [labels, st] = [content, content]
            continue
          }

          if (st === LT_SL) { // rows - start closetag - tagname or bogus
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

          if (st === BeforeAtt || st === AfterAttName) { // rows - start attribute name
            [labels, st] = [[st, AttName], AttName]
            continue }
        }
        while (false) // Just to use continue as a break
        last = c // And this is outside the loop for that very reason
        if (labels === undefined) labels = c === '<' ? null : st // TODO clean this up

        ////////// End of transition table //////////
        //////////  Start of emitter code  //////////

        ;[label0, label1] = Array.isArray (labels) ? [label0 || labels[0], labels[1]] : [label0, labels]
        if (label0 !== label1) {
          if (label0) {
            output.push ([label0, input.substring (lastEmit, i)])
            if (output.length === n) {
              yield output; output = []
            }
            lastEmit = i
          }
        }
        label0 = label1
      }

      rest = input.substring (lastEmit, input.length)
    }
    // The input buffer is now empty, but there may be an incomplete chunk. 
    // This needs to be retained unless there has been an end call. 
    if (!writable && rest) {
      output.push ([label0, rest])
      yield output
      output = []
    }
  }

}

// Wrapping around the core

function chunks (input) {
  const l = new Lexer ()
  const stream = l.write (input) .end () .read ()
  Object.defineProperty (stream, 'state', { get: $=> l.state })
  return stream
}


// Exports
// -------

// log (tokenTypes)
module.exports = { Lexer, chunks, stateNames:names, tokenTypes, printState }