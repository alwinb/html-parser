import machine from './machine.mjs'
import { Element, EndTag, MDecl, Comment, Doctype } from './dom.js'
const { eqClass, defaultClass, tokens:T, states:S, initialState, table, minAccepts } = machine
const log = console.log.bind (console)

const FAIL = 0
const errorToken = 0
const names = []
for (const k in T) names[T[k]] = k

// Ugh

// let  = new Text ()
//  = ..bind ()
// let encode = new TextEncoder ()
// encode = encode.encode.bind (encode)

// log ({S, T})
S.PlainText = S.RawText

// Tokeniser
// ---------
// A double loop; the inner loop implements the lexer, running the DFA.
// The outer loop switches on the token-types produced by the lexer,
// constructors the tokens and feeds state changes back into the lexer.

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

function Tokeniser (delegate) {

  let tokenState = initialState
  let anchor = 0, end = 0, pos = 0
  let line = 1, lastnl = 0, _c = 0

  // HTML specific
  let lastStartTag = ''
  let xmlIsh = false
  let tag, attr = null, attrValue, emit // Token constructing state

  // this.setState = function setSate (tokenState, lastStartTag_ = '') {
  //   state = tokenState
  //   lastStartTag = lastStartTag .toLowerCase ()
  //   xmlIsh = false
  // }

  this.parse = function (input) {
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
      const name = names [typeId]

      switch (typeId) {

        case errorToken: {
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

        case T.attributeAssign:
          tokenState = S.BeforeValue
        break

        case T.valueStartQuot:
          tokenState = S.ValueQuoted
        break

        case T.valueStartSquo:
          tokenState = S.ValueSQuoted
        break

        case T.valueEnd:
          tokenState = S.BeforeAttribute
        break

        case T.unquoted:
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
          tokenState = S.Bogus
        } break

        case T.bogusStart: {
          tag = new Comment ()
          emit = delegate.writeComment
          tokenState = S.Bogus
        } break

        case T.bogusData:
          tag.data.push (input.substring (anchor, end))
        break

        case T.commentData:
          tag.data.push (input.substring (anchor, end))
          tokenState = S.CommentData
        break

        case T.nulls: // REVIEW
          //if (!tag)
          if (xmlIsh) {
            let replaced = ''
            for (let i=0, l=end-anchor; i<l; i++) {
              replaced += '\uFFFD'
            }
            // const buf = new Uint8Array ((end - anchor) * 3)
            // for (let i=0, l=buf.length; i<l; i+=3) {
            //   buf[i] = 0xEF
            //   buf[i+1] = 0xBF
            //   buf[i+2] = 0xBD
            // }
            delegate.writeData (replaced)
          }
        break

        case T.space:
          if (!tag) delegate.writeSpace (input.substring (anchor, end))
          else if (attr) {
            tokenState = S.BeforeAttribute // HACK
          }
        break

        case T.rawtext:
        case T.rcdata:
        case T.other:
        case T.text:
        case T.ampersand:
        case T.lt:
          delegate.writeData (input.substring (anchor, end))
        break
        
        case T.charRefNamed:
          // quick / temp
          const ref =  (input.substring (anchor+1, end-1))
          delegate.writeData ( ({lt:'<', amp:'&'}[ref] || ''))
        break
      }
      
      // log ([typeId, name, (input.substring (anchor, end))])
      anchor = pos = end
    }
  }

  this.end = function end () {
    // TODO if in comment / bogus // then emit
    delegate.writeEOF ()
  }

}



// log (contentMap)



// Test
// ----

const delegate = {
  write:log,
  writeComment:log,
  writeTag:log,
  writeEndTag:log,
  writeSpace:log,
  writeData:log,
  writeDoctype:log,
  writeEOF:log,
}

const tokeniser = new Tokeniser (delegate)
// log (tokeniser.parse ('</ tttt>'))
// log (tokeniser.parse ('<table><input type=hidden type=still-hidden>foo'))

export { Tokeniser }