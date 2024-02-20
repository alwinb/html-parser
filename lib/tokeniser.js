import DFA from './dfa.js'
import { Element, EndTag, Comment, Doctype } from './dom.js'
import { C, None } from './schema.js'
const ForeignElement = C.ForeignElement
const { eqClass, defaultClass, tokens:T, states:S, initialState, table, tableWidth, minAccepts } = DFA
const log = console.log.bind (console)


// Tokeniser
// =========

// Tokenisation is implemented via a double loop, where the inner loop
// drives a DFA. The outer loop switches on the lexical token-type produced
// from the DFA, constructs token objects and selects the next start-state
// for running the DFA.

// ### Aliases (DFA)

// log ({S, T})

const errorToken = T.errorToken
S.PlainText = S.TOP // For now

// The DFA uses integers to encode the lexical token-types. The following
// creates an inverse map from type-integers to their human readable name.

const names = []
for (const k in T) names[T[k]] = k


// ### Content Map

// A content-map is used to determine how to tokenise the contents of
// an element after seeing a start-tag. In almost all cases this
// will be S.Main, but there are a small number of exceptions: 
// the RAWTEXT, PLAINTEXT and RCDATA elements.

const contentMap = {
  style: S.RawText,
  script: S.RawText,
  xmp: S.RawText,
  iframe: S.RawText,
  noembed: S.RawText,
  noframes: S.RawText,
  textarea: S.RcData,
  title: S.RcData,
  plaintext: S.PlainText
  // noscript: scriptingEnabled ? S.RawText : S.Main
  // -- S.main for all other start-tags
}


// Tokeniser class
// ---------------

// I am using the closure pattern to define the Tokeniser class.
// An instance can be created by using `new Tokeniser (delegateObject)`.

// The `write` method on the Tokeniser class implements the double loop
// that is at the heart of the tokeniser. The inner loop runs the DFA.
// The outer loop implements a state machine in code that combines the
// lower level lexical-tokens into start tags (potentially with attributes),
// end tags, commments and alike -- these objects correspond to what the
// HTML standard refers to as tokens. Upon completion of each such token,
// it is passed to the delegate via a write* method call: writeStartTag,
// writeEndTag, writeData, writeComment, etc.

// It is possible to split the input over multiple write calls. The last
// write call must be followed by an end call, otherwise some of the input
// may end up remaining uninterpreted. Calling tokeniser .parse (input) is
// equivalent to tokeniser .write (input) .end ().

function Tokeniser (delegate) {

  // DFA driver state
  // -- maintained across write calls.

  let tokenState = initialState
  let anchor = 0, end = 0, pos = 0
  let line = 1, lastnl = 0, _c = 0

  // HTML specific state
  // -- maintained across write calls.

  let parserContext = None // Builder.nesting
  let lastStartTag = ''
  let tag, attr = null, attrValue // Token construction state
  let emit

  // Initialisation / Reset

  function _reset () {
    tokenState = initialState
    anchor = end = pos = 0
    line = 1; lastnl = _c = 0 
    parserContext = None // union of eq classes of nested elements
    lastStartTag = ''
    tag = attr = attrValue = emit = null
  }

  // this.setState = function setSate (tokenState, lastStartTag_ = '') {
  //   state = tokenState
  //   lastStartTag = lastStartTag .toLowerCase ()
  //   parserContext = None
  // }

  this.parse = function parse (input) {
    this.write (input)
    this.end ()
  }

  this.write = function write (input) {
    const length = input.length
    while (pos < length) {

      let state = tokenState
      let match = S.Fail // state >= min_Accepts ? (end = pos, state) : S.Fail

      while (state > 0 && pos < length) {
        const c = input.charCodeAt (pos++)
        const cc = c <= 128 ? eqClass[c] : defaultClass
        state = table [state * tableWidth + cc];
        // log (input[pos-1], '==>', state)
        if (state >= minAccepts) (match = state, end = pos)
      }
      // if (state < 0) (match = -state, end = pos) // epsilon states coded as negative ints
      // let _entry = entry

      let tokenType = table [match * tableWidth]
      // log (tokenState, [names[tokenType], input.substring(anchor, end)])
      
      switch (tokenType) {

        case errorToken: { // Should not happen; if it does then that is a bug.
          const message = `Lexer error at line ${line}:${pos-lastnl}`
          throw new SyntaxError (message)
        } break


        // Count newlines

        case T.newline:
          lastnl = pos; line++
          if (!tag) delegate.writeSpace ('\n') // NB newline normalisation
          else if (attr) attr[1] += '\n'
          break

        case T.commentDataNL:
          // assert (tag instanceof Comment)
          tag.data.push ('\n')
          lastnl = pos; line++;
          tokenState = S.InCommentData
          break

        case T.tagSpaceNL:
          lastnl = pos; line++;
          // Don't change entry state
          break

        case T.attrSpaceNL:
          if (attr) (tag.attrs[attr[0]] = attr[1], attr = null)
          lastnl = pos; line++;
          tokenState = S.BeforeAttribute;
          break


        // Start tags
        
        case T.startTag: // optimised - start tag without attributes
        case T.startTag_: {
          lastStartTag = input.substring (anchor+1, end-1)
          if (tokenType === T.startTag_)
            lastStartTag = lastStartTag.toLowerCase ()

          parserContext = delegate.writeTag (new Element (lastStartTag))
          tokenState = !(parserContext & ForeignElement)
            ? contentMap [lastStartTag] ?? S.Main
            : S.Main
          tag = attr = null
        } break


        case T.startTagStart:
        case T.startTagStart_: {
          // T.startTagStart_ is a non-normal startTag, it contains
          // NUL or uppercase ASCII characters and must be normalised.
          lastStartTag = input.substring (anchor+1, end)
          if (tokenType === T.startTagStart_) lastStartTag = lastStartTag.toLowerCase ()
          tag = new Element (lastStartTag)
          emit = delegate.writeTag
          tokenState = S.BeforeAttribute
        } break


        // End tags
        
        case T.endTag_: // optimised - end tag without attributes
        case T.endTag: {
          let tagName = input.substring (anchor+2, end-1)
          if (tokenType === T.endTag_) tagName = tagName.toLowerCase ()

          // If in RcData / RawText, check if closing tag
          if ((tokenState === S.Main || lastStartTag === tagName)) {
            parserContext = delegate.writeEndTag (new EndTag (tagName))
            tokenState = S.Main
            tag = attr = null
          }
          else {
            delegate.writeData (input.substring (anchor, end)) // REVIEW
            // tokenType = names [tokenState === S.RcData ? T.rcdata : T.rawtext] // REVIEW
          }
          
        } break

        case T.endTagStart_:
        case T.endTagStart: {
          let tagName = input.substring (anchor+2, end)
          if (tokenType === T.endTagStart_) tagName = tagName.toLowerCase ()

          // If in PlainText / RcData / RawText, check if closing tag
           if ((tokenState === S.Main || lastStartTag === tagName)) {
            tag = new EndTag (tagName)
            emit = delegate.writeEndTag
            tokenState = S.BeforeAttribute
          }
          else {
            delegate.writeData (input.substring (anchor, end))
            // tokenType = names [tokenState === S.RcData ? T.rcdata : T.rawtext] // REVIEW
          }
        } break


        case T.attributeName_:
        case T.attributeName: {
          tag.attrs = tag.attrs ?? {}
          if (attr) tag.attrs[attr[0]] = attr[1] // complete any potential previous attribute
          let attrName = input.substring (anchor, end) // the new attribute's name
          if (tokenType === T.attributeName_) attrName = attrName.toLowerCase () // normalise it if needed
          attr = (attrName in tag.attrs) ? null : [attrName, ''] // ignore if the attribute is already set
          tokenState = S.BeforeAssign
        } break


        case T.unquoted:
          if (attr) attr[1] += input.substring (anchor, end)
          tokenState = S.ValueUnquoted;
        break

        case T.squoted:
        case T.quoted:
          if (attr) attr[1] += input.substring (anchor, end)
        break;


        case T.tagEnd: {
          if (attr) // complete attribute node under construction
            tag .attrs [attr[0]] = attr[1]

          if (input[end-2] === '/') // 0x2f)
            tag.selfclose = true

          // NB The return value from the delegate method call is used
          // to update the Tokeniser state;

          parserContext = emit (tag)
          tokenState = tag instanceof Element && !(parserContext & ForeignElement)
            ? contentMap [lastStartTag] ?? S.Main
            : S.Main

          tag = attr = null
        } break


        case T.mDeclStart: {
          if (lowercaseEquiv (input.substring (anchor+2, anchor+9), 'doctype')) {
            tag = new Doctype ()
            emit = delegate.writeDoctype
            tokenState = S.InBogusComment
          }
          else {
            tag = new Comment ()
            tag.data.push (input.substring (anchor+2, end))
            emit = delegate.writeComment
            tokenState = S.BeforeCommentData
          }
          // REVIEW how is this handled in svg and math?
        } break

        case T.commentStart: {
          tag = new Comment ()
          emit = delegate.writeComment
          tokenState = S.BeforeCommentData
        } break

        case T.bogusStart: {
          tag = new Comment ()
          emit = delegate.writeComment
          tokenState = S.InBogusComment
        } break

        case T.bogusData:
          tag.data.push (input.substring (anchor, end))
          tokenState = S.InBogusComment
        break

        case T.commentData:
          tag.data.push (input.substring (anchor, end))
          tokenState = S.InCommentData
        break
        
        case T.commentEnd:
        case T.bogusEnd:
          emit (tag)
          tag = attr = null
          tokenState = S.Main
        break;

        case T.nulls: // REVIEW
          if (parserContext & ForeignElement || tokenState !== S.Main) {
            let replaced = ''
            for (let i=0, l=end-anchor; i<l; i++) replaced += '\uFFFD'
            
            if (tag && tag instanceof Comment)
              tag.data.push (replaced)
            else
              delegate.writeData (replaced)
          }
        break

        case T.space:
          if (!tag) { // TODO get rid of conditional
            // TRYOUT -- In tables, distinguish leading space for foster parenting
            // log ('space followed by', JSON.stringify (input.substring (end, end+2)))
            // TODO only use this in tables
            const allowFosterParenting = !(input[end] === '<' && /[?/!a-zA-Z]/.test(input [end+1]))
            delegate.writeSpace (input.substring (anchor, end), allowFosterParenting)
          }
          else if (attr) attr[1] += input.substring (anchor, end)
        break

        case T.data: case T.rawtext: case T.rcdata: 
        case T.amp: case T.lt: case T.other: case T.TOP:
          if (attr) attr[1] += input.substring (anchor, end)
          else delegate.writeData (input.substring (anchor, end))
        break

        case T.charRefHex:
        case T.charRefDecimal: {
          const [base, _start] = tokenType === T.charRefHex ? [16, anchor+3] : [10, anchor+2];
          const decoded = parseNumeric (input.substring (_start, end), base)
          if (!tag) delegate.writeData (decoded)
          else if (attr) attr[1] += decoded
          tokenState = tokenState === S.BeforeValue ? S.ValueUnquoted : tokenState
        }
        break
        
        case T.charRefNamed:
        case T.charRefLegacy:
          // quick / temp
          const ref = input.substring (anchor+1, end)
          const decoded = namedReferences [ref] || input.substring (anchor, end)
          if (!tag) delegate.writeData (decoded)
          else if (attr) attr[1] += decoded
          tokenState = tokenState === S.BeforeValue ? S.ValueUnquoted : tokenState
        break

        case T.tagSpace: break // Don't change state

        case T.attributeAssign: tokenState = S.BeforeValue; break
        case T.valueStartQuot:  tokenState = S.ValueQuoted; break
        case T.valueStartApos:  tokenState = S.ValueAposed; break

        case T.valueEnd:
        case T.attrSpace: 
          if (attr) (tag.attrs[attr[0]] = attr[1], attr = null) // REVIEW get rid of the conditional
          tokenState = S.BeforeAttribute;
        break


        default:
        throw new Error ('unknown token '+ names[tokenType])
      }
      
      // log ([tokenType, names [tokenType], (input.substring (anchor, end))])
      anchor = pos = end
    }
  }

  this.end = function end () {
    if (tag instanceof Comment)
      delegate.writeComment (tag)
    delegate.writeEOF ()
    _reset ()
  }

}

function lowercaseEquiv (s1, s2) {
  const len = s1.length
  let r = len === s2.length
  for (let i=0; r && i<len; i++)
    r = (s1.charCodeAt(i) | 32) === (s2.charCodeAt(i) | 32)
  return r
}


// Character References
// --------------------

// ### Decoding numeric character references

// NUL characters and references out of the unicode range are replaced with U+FFFD.
// Unicode surrogates are replaced with the unicode range are replaced with U+FFFD.
// Numeric references in the range 0x80-0x9F are decoded using the Windows-1252 codepage;
// In Unicode these code-points correspond to the non-printable C1 contol characters.
// <https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state>

function parseNumeric (str, base)  {
  const n = parseInt (str, base)
  return 0x80 <= n && n <= 0x9F ? _win1252 [n - 0x80] :
    0xD800 <= n && n <= 0xDFFF ? String.fromCodePoint (0xFFFD) :
    1 <= n && n <= 0x10FFFF ? String.fromCodePoint (n) :
    String.fromCodePoint (0xFFFD)
}

const _win1252 =
  '€\x81‚ƒ„…†‡ˆ‰Š‹Œ\x8DŽ\x8F\x90‘’“”•–—˜™š›œ\x9DžŸ'


// ### Decoding named, and legacy named character references

// A very small subset for now, until I've found a satisfactory
// way to compress the list of entities.

const namedReferences = {
  lt:'<',   LT:'<',  'lt;':'<',   'LT;':'<',
  gt:'>',   GT:'>',  'gt;':'>',   'GT;':'>',
  amp:'&',  AMP:'&', 'amp;':'&',  'AMP;':'&', 
  quot:'"', QUOT:'"', 'quot;':'"', 'QUOT;':'"',
  'apos;':"'",
  // Just to make te test pass
  'notin;': '∉',
}


// Exports
// -------

export { Tokeniser, DFA }