import { Node, MDecl, EndTag } from './dom.js'
// import { kinds, otherKind } from './categories.js'
const { defineProperties:define } = Object
const log = console.log.bind (console)

// TODO I think, defer encoding / decoding to the builder stage,
// or even beyond that. This is fine for any ASCII compatible encoding.

let decode = new TextDecoder ()
decode = decode.decode.bind (decode)

// States correspond to positions into a finite stack,
// let's see...
//
// - Rawtext
//   - Space
// - Rcdata
//   - Space
//   - Charref
// - Data
//   - Space
//   - Charref
//   - Mdecl
//     - 'Name'
//     - 'Content'
//   - Tag (Start/ End)
//     - Name
//     - Attrs
//       - Attr
//         - Name
//         - (=)
//         - Value
//           - SingleQuoted
//             - Charref
//           - DoubleQuoted
//             - Charref
//           - Unquoted
//             - Charref

const RAW = Symbol ('RAW')
const DATA = Symbol ('DATA')
const RCDATA = Symbol ('RCDATA')

function Lexer ({ writeTag, writeEndTag, writeData, writeSpace, writeNulls, writeMDecl, writeEOF }) {

  let emit           // reference to appropriate tag handler
  let anchor = 0     // start position of the current token
  let tagStart = -1  // position of "<"
  let refStart = -1  // position of "&"

  let _raw = null    // data / vs raw vs rawtext (vs plaintext)
  let _tagname = ''  // start-tag tagname buffer (for raw / rcdata)

  let space = null
  let tag = null
  let endtag = null
  let attributes = null
  let attribute = null
  let name = null
  let assign = null
  let value = null
  let quotation = 0 // 0x22 for double, 0x27 for single, using 0x20 for unquoted
  let last = 0      // last char, used in selfclosing tags (TODO and CRLF newlines)

  function getState () {
    return { 
      anchor, tagStart, refStart, _raw, emit,
      space, _tagname, tag, attributes, attribute,
      name, assign, value, quotation, last
    }
  }

  define (this, { state: { get:getState }})
  return Object.assign (this, { parse, end })

  function write () {
    // TODO -- across-buffer handoffs not implemented yet
  }

  function end () {
    writeEOF ()
  }

  // TODO parse will be equivalent to
  // new Lexer (delegate) .write (input) .end ()

  function parse (input) {
    if (typeof input === 'string') 
      input = new Uint8Array (new TextEncoder () .encode (input))
  
    for (let pos = 0, l = input.length; pos < l; pos++) {
      let c = input [pos]
      // log (String.fromCharCode(c), { tag, attributes, attribute, name, value })
      // log ({ pos, c, char:String.fromCharCode(c), anchor, pos, tagStart, tag, pos })

      // Inside attribute value

      if (quotation) {
        if (c === quotation) {
          attribute.value = decode (input.subarray (anchor, anchor = pos))
          quotation = value = assign = name = attribute = null
        }
        else if (c === 0x09 && quotation === 0x20) { // tab vs [space signifying unquoted]
          // TODO handle other whitespace chars as well; remaining / cr / lf
          attribute.value = decode (input.subarray (anchor, anchor = pos))
          quotation = value = assign = name = attribute = null
        }
        else if (c === 0x3E && quotation === 0x20) { // (>) vs [space signifying unquoted]
          attribute.value = decode (input.subarray (anchor, anchor = pos))
          _raw = emit (tag) .raw // REVIEW
          quotation = value = assign = name = attribute = attributes = tag = endtag = null
          anchor = pos+1
        }
        continue
      }

      // After Attribute assign (=)

      if (assign) {
        if (c === 0x22 || c === 0x27) { // ("), (')
          quotation = c
          anchor = pos + 1
        }
        else if (c === 0x3E) { // (>)
          if (last === 0x2F) tag.selfclose = true // last is Slash (/)
          _raw = emit (tag) .raw // REVIEW
          value = assign = name = attribute = attributes = tag = endtag = null
          anchor = pos+1
        }
        else if (c !== 0x20 && c !== 0x9 && c !== 0xA && c !== 0xD) { // non-space
          quotation = 0x20 // using 0x20 to signify unquoted atts
          anchor = pos
        }
        continue
      }

      // After Attribute Name -- Before Equals
 
      if (name) {
        if (c === 0x3D) { // Equals
          anchor = pos+1
          assign = c
        }
        else if (c === 0x2F) { // Slash (/)
          anchor = pos+1
          name = attribute = null
        }
        else if (c === 0x3E) { // (>)
          if (last === 0x2F) tag.selfclose = true // last is Slash (/)
          _raw = emit (tag) .raw // REVIEW
          anchor = pos+1
          name = attribute = attributes = tag = endtag = null
        }
        else if (c !== 0x20 && c !== 0x9 && c !== 0xA && c !== 0xD) { // not whitespace
          attributes.push (attribute = { })
          name = null
          anchor = pos
        }
        last = c
        continue
      }

      // Inside Attribute Name -- Before Equals
      
      if (attribute) {
        if (c === 0x3D) { // Equals
          const v = decode (input.subarray (anchor, anchor = pos))
          attribute.name = name = v
          assign = true
          anchor = pos+1
        }
        else if (c === 0x20 && c === 0x9 && c === 0xA && c === 0xD) { // Whitespace
          name = attribute.name = decode (input.subarray (anchor, anchor = pos))
          anchor = pos+1
        }
        else if (c === 0x2F) { // Slash (/)
          attribute.name = decode (input.subarray (anchor, anchor = pos))
          anchor = pos+1
          value = assign = name = attribute = null
        }
        else if (c === 0x3E) { // (>)
          if (last === 0x2F) tag.selfclose = true // last is Slash (/)
          _raw = emit (tag) .raw // REVIEW
          attribute.name = decode (input.subarray (anchor, anchor = pos))
          anchor = pos+1
          value = assign = name = attribute = attributes = tag = endtag = null
        }
        last = c
        continue
      }

      // Inside Tag, before attribute name

      if (attributes) {
        if (c === 0x3E) { // (>)
          if (last === 0x2F) tag.selfclose = true // last is Slash (/)
          _raw = emit (tag) .raw // REVIEW
          attributes = tag = endtag = null
          anchor = pos+1
        }
        else if (c !== 0x20 && c !== 0x9 && c !== 0xA && c !== 0xD && c !== 0x2F) { // not space nor slash
          attributes.push (attribute = { })
          anchor = pos
        }
        else
          anchor = pos+1
        last = c
        continue
      }

      // Inside Tag (-name)

      if (tag) {
        if (c === 0x20 || c === 0x09 || c === 0x2f) { // space or slash
          const _name = decode (input.subarray (anchor, pos))
          if (!_raw || (endtag && _name === _tagname)) {
            _tagname = tag.name = _name
            attributes = tag.attributes = []
            tagStart = -1
            anchor = pos
          }
          else {
            tag = endtag = null
            anchor = tagStart
            tagStart = -1
          }
        }
        else if (c === 0x3E) { // (>)
          const _name = decode (input.subarray (anchor, pos))
          if (!_raw || (endtag && _name === _tagname)) {
            _tagname = tag.name = _name
            if (last === 0x2F) tag.selfclose = true // last is Slash (/)
            _raw = emit (tag) .raw // REVIEW
            anchor = pos + 1
            tagStart = -1
            tag = endtag = null
          }
          else {
            tag = endtag = null
            anchor = tagStart
            tagStart = -1
          }
        }
        last = c
        continue
      }

      // Some amount after (<)

      if (tagStart >= 0) {
        let len = pos - tagStart
        if (!_raw && ((0x41 <= c && c <= 0x5A) || (0x61 <= c && c <= 0x7A))) { // Alpha
          tag = new Node ()
          emit = writeTag
          anchor = pos
        }
        else if (c === 0x2F && len === 1) { // (/)
          tag = endtag = new EndTag ()
          emit = writeEndTag
          anchor = pos+1
        }
        else if (len === 1 && (c === 0x21 || c === 0x3F || c === 0x2F)) { // (!?/)
          tag = new MDecl ()
          emit = writeMDecl
          anchor = pos+1
        }
        else {
          anchor = tagStart
          tagStart = -1
        }
        continue
      }

      /* Some amount after (&)
      if (refStart >= 0) {
        let len = pos - refStart
        
        continue
      }*/
      
      // Within Data

      if (c === 0x3C) { // (<)
        tagStart = pos
        if (anchor < pos) writeData (input.subarray (anchor, anchor=pos))
        continue
      }

      if (c === 0x26) { // (&)
        refStart = pos // charrefs then?
        if (anchor < pos) writeData (input.subarray (anchor, anchor=pos))
        continue
      }

      if (c === 0x20 || c === 0x09) { // space or tab
        if (anchor < pos) writeData (input.subarray (anchor, anchor = pos))
        do { c = input[++pos] } while ((c === 0x20 || c === 0x09) && pos < l)
        // TODO, possibly do the check for leading-space vs space here already
        writeSpace (input.subarray (anchor, anchor=pos--))
        continue
      }

      if (c === 0xA || c === 0xD) { // CR / LF // FIXME newlines (count, etc)
        if (anchor < pos) writeData (input.subarray (anchor, anchor = pos))
        do { c = input[++pos] } while ((c === 0xA || c === 0xD) && pos < l)
        // TODO, possibly do the check for leading-space vs space here already
        writeSpace (input.subarray (anchor, anchor=pos--))
        continue
      }

      if (c === 0) { // null character
        if (anchor < pos) writeData (input.subarray (anchor, anchor = pos))
        do { c = input[++pos] } while (c === 0 && pos < l)
        writeNulls (input.subarray (anchor, anchor=pos--))
        continue
      }

      // TODO
      // And the char refs
    }


    // END // TODO emit all remaining opens properly
    // Thus, tagname, attribute name, attribute value, ...
    // And/ rawtext elements properly as well

    if (tag) {
      if (tag.name) emit (tag)
    }
    else if (anchor < input.length)
      writeData (input.subarray (anchor))
  }

}


// Exports
// -------

export { Lexer }