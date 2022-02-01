import machine from './machine.mjs'
const { eqClass, defaultClass, tokens:T, states, initialState, table, minAccepts } = machine
import { Element, EndTag, MDecl, Comment } from './dom.js'
const log = console.log.bind (console)

const FAIL = 0
const errorToken = 0
const names = []
for (const k in T) names[T[k]] = k


// Push Tokeniser
// --------------

let decode = new TextDecoder ()
decode = decode.decode.bind (decode)

function Tokeniser (delegate) {

  let tokenState = initialState
  let anchor = 0, end = 0, pos = 0
  let line = 1, lastnl = 0, _c = 0

  // HTML specific
  let lastStartTag = ''
  let tag, attrName, attrValue, emit

  this.setState = function setSate (tokenState, lastStartTag_ = '') {
    state = tokenState
    lastStartTag = '</' + lastStartTag
  }

  this.parse = function (input) {
    if (typeof input === 'string') 
      input = new Uint8Array (new TextEncoder () .encode (input))
    this.write (input)
    this.end ()
  }

  this.write = function write (input) {
    const length = input.length
    while (pos < length) {
      let state = tokenState
      let match = FAIL
      do {
        const c = input[pos++]
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

        case errorToken:
          const message = `Lexer error at line ${line}:${pos-lastnl}`
          throw new SyntaxError (message)
        break
      
        case T.startTagStart: {
          const tagName = decode (input.subarray (anchor+1, end))
          // TODO Convert to lowcase
          lastStartTag = tagName //tagName.toLowerCase ()
          tag = new Element (tagName)
          emit = delegate.writeTag
        } break

        case T.endTagStart: {
          const tagName = decode (input.subarray (anchor+2, end))
          tag = new EndTag (tagName)
          emit = delegate.writeEndTag
          // log ('endTagStart, in ...', lastStartTag, value)
          if (tokenState !== initialState && lastStartTag !== value .toLowerCase ())
            typeId = names [tokenState === RcData ? rcdata : rawtext] // REVIEW
        } break

        case T.attributeName:
          attrName = decode (input.subarray (anchor, end))
          attrValue = []
          tag.attrs = tag.attrs || {}
        break

        case T.unquoted:
        case T.squoted:
        case T.quoted:
          attrValue.push (input.subarray (anchor, end))
        break;

        case T.tagEnd: {
          if (attrName) tag.attrs[attrName] = attrValue
          emit (tag)
          tag = attrName = attrValue = null
        }

        case T.mDeclStart:
        case T.commentStart:
        case T.bogusStart: {
          tag = new Comment ()
          emit = delegate.writeMDecl
        } break

        case T.bogusData:
        case T.commentData:
          tag.data.push (input.subarray (anchor, end))
        break

        case T.space:
          delegate.writeSpace (input.subarray (anchor, end))
        break

        case T.rawtext:
        case T.rcdata:
        case T.other:
        case T.text:
        case T.ampersand:
        case T.lt:
          delegate.writeData (input.subarray (anchor, end))
        break
        
     
          

        /*
        rawtext, rcdata, space, other, text, ampersand, lt,
        charRefDecimal, charRefHex, charRefLegacy, charRefNamed,
        commentStart, bogusStart, bogusData, commentData, mDeclStart,
        startTagStart, endTagStart, tagEnd, 
        attributeAssign, attributeName, attributeSep,
        valueEnd, valueStartQuot, valueStartSquo,
        unquoted, squoted, quoted,
        */
        
      }

      tokenState = table2 [typeId] || tokenState
      anchor = pos = end

      // delegate.write (typeId, name, value)
    }
  }

  this.end = function end () {
    // TODO
  }

}


// So, can I now make tranitions for the tokeniser as well?
// Here it makes more sense to transpose the table;
// nextState = table [token] [state]
const S = states
const table2 = [
/* (unused)          */  0,
/* rawtext           */  S.RawText,
/* rcdata            */  S.RcData,
/* space             */  0, // do not change
/* other             */  S.Main,
/* text              */  S.Main,
/* amp               */  0, // do not change
/* lt                */  S.Main,
/* charRefDecimal    */  0, // do not change
/* charRefHex        */  0, // do not change
/* charRefLegacy     */  0, // do not change
/* charRefNamed      */  0, // do not change
/* commentStart      */  S.CommentData,
/* bogusStart        */  S.Bogus,
/* bogusData         */  S.Bogus,
/* commentData       */  S.InComment, // depends on context
/* mDeclStart        */  S.CommentData,
/* startTagStart     */  S.BeforeAttribute,
/* endTagStart       */  S.BeforeAttribute,
/* tagEnd            */  S.Main,
/* attributeAssign   */  S.BeforeValue,
/* attributeName     */  S.BeforeAssign,
/* attributeSep      */  S.BeforeAttribute,
/* valueEnd          */  S.BeforeAttribute,
/* valueStartQuot    */  S.ValueQuoted,
/* valueStartSquo    */  S.ValueSQuoted,
/* unquoted          */  S.ValueUnquoted,
/* squoted           */  S.ValueSQuoted,
/* quoted            */  S.ValueQuoted,
]

const tokeniser = new Tokeniser ({ write:log, writeMDecl:log, writeTag:log, writeEndTag:log, writeSpace:log, writeData:log })

export { Tokeniser }