const { defineProperties:define } = Object
const log = console.log.bind (console)

// const { kinds, otherKind } =
//   require ('./categories')

// TODO I think, defer encoding / decoding to the builder stage,
// or even beyond that. This is fine for any ASCII compatible encoding.

let encode = new TextEncoder ()
encode = encode.encode.bind (encode)

let decode = new TextDecoder ()
decode = decode.decode.bind (decode)


// Instead of start tags, produce nodes right away

function Node () {
  this.name
}

function EndTag () {
  this.type = 'EndTag'
  this.name
}

function MDecl () {
  this.type = 'MDecl'
  this.name
}

// States are positions into a finite stack,
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

const RAW = Symbol ()
const DATA = Symbol ()
const RCData = Symbol ()

function Lexer ({ writeTag, writeEndTag, writeData, writeSpace, writeNulls, writeMDecl, end }) {

  let emit           // reference to appropriate tag handler
  let anchor = 0     // start position of the current token
  let tagStart = -1  // position of "<"
  let refStart = -1  // position of "&"

  let _raw = null    // data / vs raw vs rawtext (vs plaintext)
  let _tagname = ''  // start-tag tagname buffer (for raw / rcdata)

  let space = null
  let endtag = null
  let tag = null
  let attributes = null
  let attribute = null
  let name = null
  let assign = null
  let value = null
  let quotation = 0 // 0x22 for double, 0x27 for single, using 0x20 for unquoted

  function getState () {
    return { 
      anchor, tagStart, refStart, _raw, emit,
      space, _tagname, tag, attributes, attribute,
      name, assign, value, quotation
    }
  }

  define (this, { state: { get:getState }})
  return Object.assign (this, { parse, end })

  function write () {
    // TODO -- across-buffer handoffs not implemented yet
  }

  function end () {
    // TODO -- 
  }

  // TODO parse will be equivalent to
  // new Lexer (delegate) .write (input) .end ()

  function parse (input) {
    if (typeof input === 'string') 
      input = new Uint8Array (encode (input))
  
    for (let pos = 0, l = input.length; pos < l; pos++) {
      let c = input [pos]
      // log (String.fromCharCode(c), { tag, attributes, attribute, name, value })
      // log ({ pos, c, char:String.fromCharCode(c), anchor, pos, tagStart, tag, pos })

      // Now the end tags
      // TODO and not in quotation value

      // Inside attribute value

      if (quotation) {
        if (c === quotation) {
          attribute.value = decode (input.subarray (anchor, anchor = pos))
          quotation = value = assign = name = attribute = null
        }
        else if (c === 0x09 && quotation === 0x20) { // tab vs (space signifying unquoted)
          // TODO handle other whitespace chars as well; remaining / cr / lf
          attribute.value = decode (input.subarray (anchor, anchor = pos))
          quotation = value = assign = name = attribute = null
        }
        else if (c === 0x3E && quotation === 0x20) { // (>) vs space
          attribute.value = decode (input.subarray (anchor, anchor = pos))
          _raw = emit (tag)
          quotation = value = assign = name = attribute = attributes = tag = endtag = null
          anchor = pos+1
        }
        continue
      }

      // After attribute assign (=)

      if (assign) {
        if (c === 0x22 || c === 0x27) { // ("), (')
          quotation = c
          anchor = pos + 1
        }
        else if (c === 0x3E) { // (>)
          _raw = emit (tag)
          value = assign = name = attribute = attributes = tag = endtag = null
          anchor = pos+1
        }
        else if (c !== 0x20 && c !== 0x9 && c !== 0xA && c !== 0xD) { // not space
          quotation = 0x20 // using 0x20 to signify unquoted atts
          anchor = pos
        }
        continue
      }

      // After Attribute Name
 
      if (name) { // before equals, after attribute name
        if (c === 0x3D) { // Equals
          anchor = pos+1
          assign = c
        }
        else if (c === 0x2F) { //(/)
          anchor = pos+1
          name = attribute = null
        }
        else if (c === 0x3E) { //(>)
          _raw = emit (tag)
          anchor = pos+1
          name = attribute = attributes = tag = endtag = null
        }
        else if (c !== 0x20 && c !== 0x9 && c !== 0xA && c !== 0xD) { // not whitespace
          attributes.push (attribute = { })
          name = null
          anchor = pos
        }
        continue
      }

      // Inside attribute name
      
      if (attribute) { // before equals
        if (c === 0x3D) { // Equals
          const v = decode (input.subarray (anchor, anchor = pos))
          attribute.name = name = v
          assign = true
          anchor = pos+1
        }
        else if (c === 0x20 && c === 0x9 && c === 0xA && c === 0xD) { // whitespace
          name = attribute.name = decode (input.subarray (anchor, anchor = pos))
          anchor = pos+1
        }
        else if (c === 0x2F) { //(/)
          attribute.name = decode (input.subarray (anchor, anchor = pos))
          anchor = pos+1
          value = assign = name = attribute = null
        }
        else if (c === 0x3E) { // (>)
          _raw = emit (tag)
          attribute.name = decode (input.subarray (anchor, anchor = pos))
          anchor = pos+1
          value = assign = name = attribute = attributes = tag = endtag = null
        }
        continue
      }

      // Inside Tag, before or after attribute

      if (attributes) { // before attname
        if (c === 0x3E) { // (>)
          _raw = emit (tag)
          attributes = tag = endtag = null
          anchor = pos+1
        }
        else if (c !== 0x20 && c !== 0x9 && c !== 0xA && c !== 0xD && c !== 0x2F) { // not space nor slash
          attributes.push (attribute = { })
          anchor = pos
        }
        else
          anchor = pos+1
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
            emit (tag)
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

      if (c === 0x20 || c === 0x09) {
        if (anchor < pos) writeData (input.subarray (anchor, anchor = pos))
        do { c = input[++pos] } while ((c === 0x20 || c === 0x09) && pos < l)
        // TODO, possibly do the check for leading-space vs space here already
        writeSpace (input.subarray (anchor, anchor=pos--))
        continue
      }

      if (c === 0) {
        if (anchor < pos) writeData (input.subarray (anchor, anchor = pos))
        do { c = input[++pos] } while (c === 0 && pos < l)
        writeNulls (input.subarray (anchor, anchor=pos--))
        continue
      }

      // TODO newlines
      // And the char refs
    }


    // END // TODO emit all remaining opens properly
    // Thus, tagname, attribute name, attribute value, ...
    // And/ rawtext elements properly as well

    if (tag)
      emit (tag)
    else if (anchor < input.length)
      writeData (input.subarray (anchor))
  }

}


// Exports
// -------

export default Lexer
