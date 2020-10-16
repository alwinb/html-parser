const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ }

// HTML5 parser
// ============

// States and Tokens
// -----------------

const [
  /* States/ Tokens/ Substates */
  PlainText, RawText, RcData, Data, CLOSE, Comment, MDecl, Bogus, AMP_IN,
  TagName, BeforeAtt, AttName, AfterAttName, BeforeValue, Value,

  Assign, StartTagStart, EndTagStart, CommentStart, CommentEnd, 
  StartQuote, EndQuote, TagEnd, BogusStart, BogusEnd, Space ] = range (1)

const tokenTypes =  {
  PlainText, RawText, RcData, Data, Comment, Bogus, 
  BeforeAtt, AttName, AfterAttName, BeforeValue, Value,

  Assign, StartTagStart, EndTagStart, CommentStart, CommentEnd, 
  StartQuote, EndQuote, TagEnd, BogusStart, BogusEnd, Space
}

tokenTypes.EndTag =  tokenTypes.EndTagStart
tokenTypes.StartTag =  tokenTypes.StartTagStart

const names = [ null,
  /* Stat/ Token/ Substate/ names */
  'plaintext', 'rawtext', 'rcdata', 'data', 'close', 'commentData', 'mdecl', 'commentData', 'amp_in',
  'tagName', 'beforeAttribute', 'attributeName', 'afterAttributeName', 'beforeValue', 'attributeValueData',

  'attributeAssign', 'startTagStart', 'endTagStart',
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

// function printState ({ st, last, quote, sub } = {}) {
//   return names [st] +
//     (sub && (st === TagName || st === Comment) ? '_' + names[sub] : '') +
//     ('</-!' .split ('') .includes (last) ? ` (${last})` : '')
// }

function printState (st) {
  st = Object.assign ({}, st)
  st.st = names[st.st]
  st.content = names[st.content]
  st.sub = st.sub ? names[st.sub] : null
  st.last = String.fromCharCode (st.last)
  return JSON.stringify (st) .replace (/("")|(":)|(")|(,)/g, _ => ({ '""':'""', '":':':', '"':'', ',':', '}[_]))
}


function Lexer () {
  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname queue
  let tag

  // Stream and Emitter  state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0, label1    // output labels

  const self = this
  Object.assign (this, { restart, write, end, batchRead, read, _unwrite })
  Object.defineProperty (this, 'state', { get: $=> ({ st, sub, content, last, quote, tag, tagname, tagname_ })})
  restart () // init

  function restart () {
    st = content = Data; tag = sub = null
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
        // log (input[i], 'in', printState (self.state))

        //////////  This is the Lexer Core  ///////////
        ////////// Start of transition table //////////

        let l0 = label0
        const c = input.charCodeAt (i)
        do {
          if (st === Value && quote) { // rows - quoted values
            [label1, st] = c === quote ? [EndQuote, BeforeAtt] : [Value, Value]
            continue
          }

          if (c === LT && st <= Data) {
            label1 = null
            continue
          }

          if (c === SL && last === LT && st <= Data) { // cells - start closetag
            [label1, st] = [null, CLOSE]
            continue
          }

          if (last === LT && st === Data) { // row - potential start tag in data
            [label1, st, tag, tagname_]
              = isAlpha (c) ? [null, TagName, StartTagStart, input[i]]
              : c === BANG  ? [null, MDecl, null, null]
              : c === QM    ? [BogusStart, Bogus, null, null]
              : [Data, Data, null, null]
            continue
          }

          if (st >= TagName && c === GT) { // cells
            if (tag === EndTagStart && content !== Data && tagname !== tagname_)
              [label1, st] = [content, content]
            else {
              [tagname, content]
                = tag === StartTagStart ? [tagname_, contentMap [tagname_] || Data]
                : ['', Data];
              [l0, label1, st, tag] = [st === TagName ? tag : st, TagEnd, content, null];
            }
            continue
          }

          if (c === GT) { // remains of the '>' column
            if (st === Comment) [label1, st, sub]
              = (sub === CommentEnd || sub === CommentStart && last === DASH) ? [CommentEnd, Data, null]
              : [Comment, Comment, null]
            else [l0, label1, st]
              = (st === CLOSE || st === MDecl) ? [BogusStart, BogusEnd, content]
              : (st === Bogus) ? [Bogus, BogusEnd, content]
              : [content, content, content]
            continue
          }

          if (st === CLOSE) { // rows - start closetag - tagname or bogus
            [l0, label1, st, tag, tagname_]
              = isAlpha (c) ? [null, null, TagName, EndTagStart, input[i]]
              : [BogusStart, Bogus, Bogus, null, null]
            continue
          }

          if (st === TagName) { // row
            if (c === SL || isSpace (c)) // cells '/' and space
              [l0, label1, st]
                = (tag === EndTagStart && content !== Data && tagname !== tagname_) ? [content, content, content]
                : [tag, null, BeforeAtt]
            else [label1, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
            [l0, label1, st]
              = st <= Data ? [content, Space, st]
              : st <= Comment ? [st, Space, st]
              : st === Value && !quote ? [Value, null, BeforeAtt]
              : st === AttName ? [AttName, null, AfterAttName]
              : [st, st, st]
            continue
          }

          label1 = st

          if (st === Comment) {
            if (c === BANG)
              [label1, sub] = [null, sub === CommentEnd && last !== BANG ? sub : null]
            else if (c === DASH)
              [label1, sub] = [null, sub === CommentEnd ? null : last === DASH ? CommentEnd : sub]
            else sub = null
          }

          if (st === MDecl) { // rows (cells first)
            if (c === DASH) [label1, st, sub]
              = last === DASH ? [CommentStart, Comment, CommentStart]
              : [null, MDecl, null]
            else [l0, label1, st] = [BogusStart, Bogus, Bogus]
            continue
          }

          if (st === BeforeValue) { let l // row
            [l0, label1, st, quote] = c === DQ || c === SQ ? [BeforeValue, StartQuote, Value, c] : [BeforeValue, Value, Value, 0];
            continue
          }

          if (c === EQ && (st === AfterAttName || st === AttName)) { // cells
            [l0, label1, st] = [st, Assign, BeforeValue]
            continue
          }

          if (c === SL) { // column // TODO clean this up
            [label1, st]
              = st === AfterAttName || st === AttName ?  [null, BeforeAtt]
              : st !== Value && st > TagName ? [null, st]
              : [st, st]
            continue
          }

          if (st === BeforeAtt || st === AfterAttName) { // rows - start attribute name
            [l0, label1, st] = [st, AttName, AttName]
            continue
          }

        }
        while (false) // Just to use continue as a break
        last = c // And this is outside the loop for that very reason

        ////////// End of transition table //////////
        //////////  Start of emitter code  //////////

        if (label0 === null) label0 = l0
        if (label0 && label0 !== label1) { // Indicates a cut
          sub = null // TODO clean this up, bug somewhere
          output[output.length] = [label0, input.substring (lastEmit, (lastEmit = i))]
          if (output.length === n) { yield output; output = [] }
        }
        label0 = label1
      }
      rest = input.substring (lastEmit, input.length)
    }

    // The input queue is now empty, but there may be an incomplete chunk that
    // has to be retained -- unless there has been an end call. 

    if (!writable && rest) {
      // TODO what if label0 is null?
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
  return Object.defineProperty (stream, 'state', { get: $=> l.state })
}


// Exports
// -------

// log (tokenTypes)
module.exports = { Lexer, chunks, stateNames:names, tokenTypes, printState }