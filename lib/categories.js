
// Elements
// --------

const elements = {
  frameset: `frameset`,
  caption: `caption`,
  option: `option`,
  colgroup: `colgroup`,
  optgroup: `optgroup`,
  body: `body`,
  tr: `tr`,
  head: `head`,
  html: `html`,
  script: `script`,
  template: `template`,
  col: `col`,
  TEXT: `#text`,
}


// Element Categories
// ------------------

const categories = {
  special: `address applet area article aside base basefont bgsound blockquote body br button caption center col colgroup dd details dir dl dt embed fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html iframe img input keygen li link listing main marquee menu meta nav noembed noframes noscript object ol p param plaintext pre script section select source style summary table tbody td template textarea tfoot th thead title tr track ul wbr xmp`,
  void: `#text area base basefont bgsound br col embed frame hr img input keygen link meta param source track wbr`,
  ditem: `dd dt`,
  tbody: `tbody tfoot thead`,
  format: `a b big code em font i nobr s small strike strong tt u`,
  heading: `h1 h2 h3 h4 h5 h6`,
  meta: `base basefont bgsound link meta noframes noscript script style template title`,
  closep: `address article aside blockquote center details dialog dir div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup listing main menu nav ol p plaintext pre section summary table ul xmp`,
  cell: `td th`,
  closeS: `input keygen textarea`,
}


// Element Boundaries
// ------------------

const boundaries = {
  scope: `caption html table td template th`,
  li: `applet article aside blockquote body button caption center colgroup dd details dl dt fieldset figcaption figure footer form frameset h1 h2 h3 h4 h5 h6 head header hgroup html li listing main marquee menu nav noscript object ol pre section select summary table tbody td template tfoot th thead tr ul`,
  pgroup: `applet button caption html marquee object optgroup option select table td template th`,
  row: `caption html table tbody template tfoot thead tr`,
  table: `html table template`,
  tcontent: `caption html table tbody template tfoot thead`,
  cell: `caption html table tbody td template tfoot th thead tr`,
  list: `applet caption html marquee object ol optgroup option select table td template th ul`,
}
