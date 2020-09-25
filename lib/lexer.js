const log = console.log.bind (console)
function* range (a, z = Infinity) { while (a <= z) yield a++ << 2 }

// HTML5 parser
// ============

// States and Tokens
// -----------------

const [
  // States
  LT_SL, MDECL, AMP_IN,
  // Token types, (also used as states)
  PlainText, RawText, RcData, Data, Comment, Bogus,
  TagName, BeforeAtt, AttName, AfterAttName, Assign, BeforeValue, Value,
  StartTag, EndTag, Tag, Space ] = range (1)

const names = [ null,
  'LT_SL', 'MDECL', 'AMP_IN', 
  'plainText', 'rawText', 'rcData', 'data', 'comment', 'bogus', 'tagName',
  'beforeAtt', 'attName', 'afterAttName', 'assign', 'beforeValue', 'value',
  'startTag', 'endTag', 'tag', 'space'
 ]

const tokenTypes = {
  PlainText, RawText, RcData, Data, Comment, Bogus,
  TagName, BeforeAtt, AttName, AfterAttName, Assign, BeforeValue, Value,
  StartTag, EndTag, Tag, Space
}

// Tokens may be annotated with Roles. The TokenBuilder has default rules based on these roles. 
// Currenty it has only Start/End, e.g. StartTag|Start, or Comment, Comment|Start, Comment|End.
// NB I'm also using Start and End as sub-states though, which may be confusing

const typeMask = ~0<<2
const roleMask = 0b11

const Start = 0b01
const End   = 0b10

// I like the idea of adding postfix/ infix/ prefix/ here, amogst others
// But for html that's not needed. 
// Ignore, or Space/Padding, may be useful though

const tokenRoles = {
  Start, End
}

const modnames = ['', '|Start', '|End', '']


// Converting tokenTypes to strings

const tokenName = st =>
  names [st>>2] + modnames [st & 0b11]

function printState ({ st, last, quote, sub } = {}) {
  return tokenName (st) + 
    (sub && (st === TagName || st & typeMask === Comment) ? '_' + modnames (sub) : '') +
    ('</-!' .split ('') .includes (last) ? ` (${last})` : '')
}


// The tokenizer is parameterized by a configuration
// that specifies rawtext, plaintext and rcdata tags. 

// TODO use toLowerCase for this eh?/
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


function Lexer () {
  const self = this

  // Lexer state
  let st, sub, content  // state, substate, tag-content
  let last, quote       // last seen char, quotation style
  let tagname, tagname_ // last complete tagname, tagname buffer

  // Stream and Emitter state
  let writable          // set to false after an end () call
  let rest, queue       // retained incomplete chunk, input queue
  let input, lastEmit   // current lexer loop input and lastEmit position within
  let label0, label1    // output labels

  Object.assign (this, { restart, read, batchRead, write, end, _unwrite })
  Object.defineProperty (this, 'state', { get: $=> ({ st, sub, content, last, quote, tagname, tagname_ })})
  return restart () // init

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
    if (writable && str.length) queue [queue.length] = str
    return self
  }

  function end (str = '') {
    if (writable && str.length) queue [queue.length] = str
    writable = false
    return self
  }

  function* read () {
    for (let x of batchRead (1)) yield* x
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
      for (let i=rest.length, l=input.length; i<l; i++) {

        //////////  This is the Lexer Core  ///////////
        ////////// Start of transition table //////////

        let labels
        const c = input.charCodeAt (i)
        do {
          labels = undefined
          if (st === Value && quote) { // rows - quoted values
            [labels, st] = quote === c ? [Value|End, BeforeAtt] : [Value, Value]
            continue }

          if (c === SL && last === LT && st <= Data) { // cells - start closetag
            [labels, st] = [null, LT_SL]
            continue }

          if (last === LT && st === Data) { // row - potential start tag in data
            [labels, st, sub, tagname_] = 
              isAlpha (c) ? [null, TagName, StartTag, input[i]]
              : c === BANG ? [null, MDECL, null, null]
              : c === QM ? [Bogus|Start, Bogus, null, null]
              : [Data, Data, null, null]
            continue }

          if (st >= TagName && c === GT) { // cells
            if (sub === EndTag && content !== Data && tagname !== tagname_)
              [labels, st] = [content, content]
            else {
              [tagname, content] = sub === StartTag
                ? [tagname_, contentMap [tagname_] || Data]
                : ['', Data]
              labels = [st === TagName ? sub|End : null, Tag|End]
              ;[st, sub] = [content, null]
            }
            continue }

          if (c === GT) { // remains of the '>' column
            if (st === Comment)
              [labels, st, sub] = sub === End || sub === Start && last === DASH
                ? [Comment|End, Data, null]
                : [Comment, Comment, null]
            else if (st === LT_SL || st === MDECL)
              [labels, st] = [[Bogus|Start, Bogus|End], content]
            else if (st === Bogus)
              [labels, st] = [[st, Bogus|End], content]
            else
              [labels, st] = [content, content]
            continue
          }

          if (st === LT_SL) { // rows - start closetag - tagname or bogus
            [labels, st, sub, tagname_]
              = isAlpha (c) ? [null, TagName, EndTag, input[i]]
              : [[Bogus|Start, Bogus], Bogus, null, null]
            continue
          }

          if (st === TagName) { // row
            if (c === SL || isSpace (c)) // cells '/' and space
              [labels, st] = (sub === EndTag && content !== Data && tagname !== tagname_)
                ? [content, content]
                : [[sub|Start, null], BeforeAtt]
            else [labels, tagname_] = [null, tagname_ + input[i]]
            continue
          }

          if (st === Comment) {
            if (c === DASH)
              [labels, sub] = [null, last === DASH ? End : sub === Start ? sub : null]
            else if (c === BANG)
              [labels, sub] = [null, sub === End && last !== c ? sub : null]
            else sub = null
          }

          if (st === MDECL) { // rows (cells first)
            if (c === DASH) [labels, st, sub]
              = last === DASH ? [Comment|Start, Comment, Start]
              : [null, MDECL, null]
            else [labels, st] = [[Bogus|Start, Bogus], Bogus]
            continue }

          if (isSpace (c)) { // column; (handles deviating cell in BeforeValue row too)
            [labels, st]
              = st <= Data ? [[content, Space], st]
              : st === Value && !quote ? [[st, null], BeforeAtt]
              : st === AttName ? [null, AfterAttName]
              : [st, st]; continue }

          if (st === BeforeValue) { let l // row
            [l, quote] = c === DQ || c === SQ ? [Value|Start, c] : [Value, 0]
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
module.exports = { Lexer, chunks, tokenTypes, tokenRoles, typeMask, roleMask, tokenName, printState }