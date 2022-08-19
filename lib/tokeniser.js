import DFA from './dfa.js'
import { Element, EndTag, MDecl, Comment, Doctype } from './dom.js'
const { eqClass, defaultClass, tokens:T, states:S, initialState, table, minAccepts } = DFA
const log = console.log.bind (console)

// Tokeniser
// =========

// Tokenisation is implemented via a double loop, where the inner
// loop drives a DFA. The outer loop switches on the token-type
// produced from the DFA, constructs token objects and selects the next
// start-state for running the DFA.

// ### Aliases (DFA)

// log ({S, T})

const errorToken = T.errorToken
const FAIL = S.STOP
S.PlainText = S.RawText

// The DFA uses integers to encode the token-types. The following creates
// an inverse map from token-type-integers to their human readable name.

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

/*
// TokenTypes
rawtext, rcdata, space, other, text, ampersand, lt,
charRefDecimal, charRefHex, charRefLegacy, charRefNamed,
commentStart, bogusStart, bogusData, commentData, mDeclStart,
startTagStart, endTagStart, tagEnd, 
attributeAssign, attributeName, attributeSep,
valueEnd, valueStartQuot, valueStartSquo,
unquoted, squoted, quoted,
*/

// Tokeniser class
// ---------------

// I am using the closure pattern to define a Tokeniser class;
// to be instantiated using `new Tokeniser (delegateObject)`.
// The `write` method on the Tokeniser class implements the
// double loop that is at the heart of the tokeniser.

// It is possible to split the input over multiple write calls. 
// The last write call must be followed by an end call.
// tokeniser .parse (input) is equivalent to tokeniser .write (input) .end ().

function Tokeniser (delegate) {

  // DFA driver state

  let tokenState = initialState
  let anchor = 0, end = 0, pos = 0
  let line = 1, lastnl = 0, _c = 0

  // HTML specific state

  let xmlIsh = false
  let lastStartTag = ''
  let tag, attr = null, attrValue // Token constructing state
  let emit

  // To reset the Tokeniser's state

  function _reset () {
    tokenState = initialState
    anchor = end = pos = 0
    line = 1; lastnl = _c = 0 
    xmlIsh = false
    lastStartTag = ''
    tag = attr = attrValue = emit = null
  }

  // this.setState = function setSate (tokenState, lastStartTag_ = '') {
  //   state = tokenState
  //   lastStartTag = lastStartTag .toLowerCase ()
  //   xmlIsh = false
  // }

  this.parse = function (input) {
    // log ('parse', input)
    // if (typeof input === 'string')
    //   input = new Uint8Array (new TextEncoder () .encode (input))
    this.write (input)
    this.end ()
  }

  this.write = function write (input) {
    const length = input.length
    while (pos < length) {
      let state = tokenState
      let match = FAIL
      do {
        const c = input.charCodeAt(pos++)
        state = table [state] [c <= 0x7a ? eqClass[c] : defaultClass]
        if (minAccepts <= state) (match = state, end = pos)
        //*/ Newline counter
        /**/ if (c === 0xD || c === 0xA) (lastnl = pos, line += (_c !== 0xD));
        /**/ _c = c
      } while (state && pos < length)

      // match can be FAIL
      let typeId = table [match] [0]

      switch (typeId) {

        case errorToken: { // Should not happen; if it does then that is a bug.
          const message = `Lexer error at line ${line}:${pos-lastnl}`
          throw new SyntaxError (message)
        } break
      
        case T.startTagStart: {
          lastStartTag =  (input.substring (anchor+1, end)) .toLowerCase ()
          tag = new Element (lastStartTag)
          emit = delegate.writeTag
          tokenState = S.BeforeAttribute
        } break

        case T.endTagStart: {
          const tagName =  (input.substring (anchor+2, end)) .toLowerCase ()

          // If in PlainText / RcData / RawText, check if closing tag
          if (tokenState === S.Main || lastStartTag === tagName) {
            tag = new EndTag (tagName)
            emit = delegate.writeEndTag
            // log ('endTagStart, in ...', lastStartTag, value)
            tokenState = S.BeforeAttribute
          }
          else {
            delegate.writeData (input.substring (anchor, end))
            // typeId = names [tokenState === S.RcData ? T.rcdata : T.rawtext] // REVIEW
          }
        } break

        case T.attributeName: {
          tag.attrs = tag.attrs || {}
          if (attr) tag.attrs[attr[0]] = attr[1]
          const attrName =  (input.substring (anchor, end))
          attr = (attrName in tag.attrs) ? null : [attrName, '']
          tokenState = S.BeforeAssign
        } break

        case T.unquoted:
          if (attr) attr[1] += input.substring (anchor, end)
          tokenState = S.ValueUnquoted;
        break

        case T.squoted:
        case T.quoted:
          if (attr) attr[1] +=  (input.substring (anchor, end))
        break;

        case T.tagEnd: {
          if (attr) {
            tag.attrs[attr[0]] = attr[1]
            attr = null
          }
          // log (tag,  (input.substring (anchor, end)), input[end-2])
          if (input[end-2] === '/') // 0x2f)
            tag.selfclose = true // TODO REVIEW, (only for proper end tags)
          xmlIsh = emit (tag) ?. xmlIsh
          // log ({ lastStartTag, xmlIsh })

          tokenState = tag instanceof Element && !xmlIsh ? contentMap [lastStartTag] || S.Main
            : lastStartTag === 'plaintext' ? S.PlainText : S.Main

          tag = attr = null
          anchor = pos = end
        }
        break

        case T.mDeclStart: {
          // TODO check name if indeed a doctype
          tag = new Doctype ()
          emit = delegate.writeDoctype
          tokenState = S.Bogus
        }
        break

        case T.commentStart: {
          tag = new Comment ()
          emit = delegate.writeComment
          tokenState = S.BeforeCommentData
        } break

        case T.bogusStart: {
          tag = new Comment ()
          emit = delegate.writeComment
          tokenState = S.Bogus
        } break

        case T.bogusData:
          tag.data.push (input.substring (anchor, end))
          tokenState = S.Bogus
        break

        case T.commentData:
          tag.data.push (input.substring (anchor, end))
          tokenState = S.InCommentData
        break
        
        case T.commentEnd:
        case T.bogusEnd:
          emit (tag)
          tag = attr = null
          anchor = pos = end
          tokenState = S.Main
        break;

        case T.nulls: // REVIEW
          if (xmlIsh || tokenState !== S.Main) {
            let replaced = ''
            for (let i=0, l=end-anchor; i<l; i++) replaced += '\uFFFD'
            delegate.writeData (replaced)
          }
        break

        case T.newline:
        case T.space:
          if (!tag) delegate.writeSpace (input.substring (anchor, end))
          else if (attr) {
            tokenState = S.BeforeAttribute // HACK
          }
        break

        case T.rawtext:
        case T.rcdata:
        case T.other:
        case T.data:
        case T.ampersand:
        case T.lt:
          delegate.writeData (input.substring (anchor, end))
        break
        
        case T.charRefNamed:
          // quick / temp
          const ref =  (input.substring (anchor+1, end-1))
          delegate.writeData ( ({lt:'<', amp:'&'}[ref] || ''))
        break
        
        case T.attributeSep:    tokenState = S.BeforeAttribute;   break
        case T.attributeAssign: tokenState = S.BeforeValue;       break
        case T.valueStartQuot:  tokenState = S.ValueQuoted;       break
        case T.valueStartApos:  tokenState = S.ValueAposed;       break
        case T.valueEnd:        tokenState = S.BeforeAttribute;   break
        default:
        throw new Error ('unknown token '+ names[typeId])
      }
      
      // log ([typeId, names [typeId], (input.substring (anchor, end))])
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

// Exports
// -------

export { Tokeniser, DFA }