const { assign } = Object
const log = console.log.bind (console)

const html = require ('./lexer')
assign (html, require ('./tokens'))
assign (html,  require ('./parser'))

function tags (str) {
  return html.TokenBuilder.build (html.chunks (str))
}

html.tags = tags
module.exports = html