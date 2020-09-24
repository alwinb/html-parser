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
const isSpace = d => {
  return 9 <= d && d <= 13 && d !== 11 || d === 32 }

const isAlpha = d => {
  if (d <= 90) d += 32
  return 97 <= d && d <= 122 }

const [LT, SL, EQ, DQ, SQ, DASH, QM, BANG, GT] =
  '</="\'-?!>' .split('') .map (_ => _.charCodeAt(0))

function printState ({ st, last, quote, sub } = {}) {
  return names [st] +
    (sub && (st === TagName || st === Comment) ? '_' + names[sub] : '') +
    ('</-!' .split ('') .includes (last) ? ` (${last})` : '')
}

function Lexer () {
  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname queue

  // Stream and Emitter  state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0, label1    // output labels

  const self = this
  Object.assign (this, { restart, write, end, batchRead, read, _unwrite })
  Object.defineProperty (this, 'state', { get: $=> ({ st, sub, content, last, quote, tagname, tagname_ })})
  restart () // init

  function restart () {
    st = content = Data; sub = null
    last = quote = 0
    tagname = tagname_ = rest = ''
    writable = true
    queue = [], input = 
    lastEmit = 0
    label0 = Data
    label1 = null
    return self
  }

  function write (str) {
    if (writable && str.length)
      queue[queue.length] = str
    return self
  }

  function end (str = '') {
    if (writable && str.length)
      queue[queue.length] = str
    writable = false
    return self
  }

  function* read () {
    for (let x of batchRead (1))
      yield* x
  }

  function _unwrite () {
    const b = queue
    b.unshift (input.substr (lastEmit))
    ;[rest, input, queue] = ['', '', []]
    return b
  }

  function* batchRead (n = 4) {
    let output = []
    while (queue.length) {
      lastEmit = 0
      input = rest ? rest + queue.shift () : queue.shift ()
      //log ('readLoop', { rest, input, lastEmit, queue})
      for (let i=rest.length, l=input.length; i<l; i++) {

        //////////  This is the Lexer Core  ///////////
        ////////// Start of transition table //////////

        let labels
        const c = input.charCodeAt (i)
        do {
          labels = undefined
          if (st === Value && quote) { // rows - quoted values
            [labels, st] = quote === c ? [EndQuote, BeforeAtt] : [Value, Value]
            continue }

          if (c === SL && last === LT && st <= Data) { // cells - start closetag
            [labels, st] = [null, LT_SL]
            continue }

          if (last === LT && st === Data) { // row - potential start tag in data
            [labels, st, sub, tagname_] = 
              isAlpha (c) ? [null, TagName, StartTagStart, input[i]]
              : c === BANG ? [null, MDecl, null, null]
              : c === QM ? [BogusStart, Bogus, null, null]
              : [Data, Data, null, null]
            continue }

          if (st >= TagName && c === GT) { // cells
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

          if (c === GT) { // remains of the '>' column
            if (st === Comment)
              [labels, st, sub] = sub === CommentEnd || sub === CommentStart && last === DASH
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
              = isAlpha (c) ? [null, TagName, EndTagStart, input[i]]
              : [[BogusStart, Bogus], Bogus, null, null]
            continue
          }

          if (st === TagName) { // row
            if (c === SL || isSpace (c)) // cells '/' and space
              [labels, st] = (sub === EndTagStart && content !== Data && tagname !== tagname_)
                ? [content, content]
                : [[sub, null], BeforeAtt]
            else [labels, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (st === Comment) {
            if (c === DASH)
              [labels, sub] = [null, last === DASH ? CommentEnd : sub === CommentStart ? sub : null]
            else if (c === BANG)
              [labels, sub] = [null, sub === CommentEnd && last !== c ? sub : null]
            else sub = null
          }

          if (st === MDecl) { // rows (cells first)
            if (c === DASH) [labels, st, sub]
              = last === DASH ? [CommentStart, Comment, CommentStart]
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
            [l, quote] = c === DQ || c === SQ ? [StartQuote, c] : [Value, 0]
            ;[labels, st] = [[BeforeValue, l], Value]
            continue }

          if (c === EQ && (st === AfterAttName || st === AttName)) { // cells
            [labels, st] = [[st, Assign], BeforeValue]
            continue }

          if (c === SL) { // column
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
        if (labels === undefined) labels = c === LT ? null : st // TODO clean this up

        ////////// End of transition table //////////
        //////////  Start of emitter code  //////////

        ;[label0, label1] = Array.isArray (labels) ? [label0 || labels[0], labels[1]] : [label0, labels]
        if (label0 !== label1) {
          if (label0) {
            output[output.length] = ([label0, input.substring (lastEmit, (lastEmit = i))])
            if (output.length === n) {
              yield output
              output = []
            }
          }
        }
        label0 = label1
      }
      rest = input.substring (lastEmit, input.length)
    }

    // The input queue is now empty, but there may be an incomplete chunk that
    // has to be retained -- unless there has been an end call. 

    if (!writable && rest) {
      output[output.length] = [label0, rest]
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