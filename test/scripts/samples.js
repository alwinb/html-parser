// Samples
// -------

// FIXME: 23, ...

window['html-samples'] = [

  // NB parsed differently in Firefox
  `<bar><p>as<select><li>foo`,
  `Foo bar<p>as<select><li>foo<li>bar<option>bee<li><option><p><h1><select>ad`,
  `Test nesting of option and optgroup.
  <select>Foo<textarea>Bar</textarea>
  <select>Foo<input>
  <select>Foo<keygen>
  <select>Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee<select>Baz<optgroup>Item<li>item<optgroup>g<di>Di</select>
  `,
  `Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee<select>Baz<optgroup>Item<li>item<optgroup>g<di>Di</select>`,
  
  // `<option>Item<li>item<di><option><select><option>Item<li>item<di><option><select>`,
  // `<option>Item<li>item<di><option>Item2<li>item<di><option><select><option>Item<li>item<di><option><option>Item2<li><optgroup>item<di>`,


  `text<li>li<dd><li><td>dd1<dd>dd2`,
  `text<li>li<dd>dd1<dd>dd2`,
  `text<li>li<dd><div>dd1<dd>dd2`,
  
  `a<h1>s<div>b<h2>`,
  `a<h1>b<h2>`,
  `<table><td><p>Test<h1>Head<button><td><h2>`,
  `<uli>a<button>b</uli><p>c<button>dee`,
  `<ul><li>one<ul></li>text`,
  `<p>Test<h1>Head1<div><h2>Head2`,
  `<p>Test<h1>Head1<sdiv><h2>Head2`,
  `<p>Test<h1>Head1<div></h2>Text`,
  '<li><applet>a </li>test <li>test',
  '<ul><li>one<ul></li>text',
  '<table><td><template><td>',
  '<table><caption><table><td></caption>text',
  '<table><caption><td><table><td></caption>text',
  '<table><caption><applet>applet-text</table>body-text',
  '<table><td><applet>applet-text</table>body-text',
  '<table><caption><td></table>Hello',
  '<table><caption><td><div></table>Hello',

  `<ul><li><applet><as></li>test</ul>
  <ul><li><p><as></li>test`,

  `<p>para<object>and<p>para`,

  `<p>Test<h1>Head<button><h2>`,
  `<p>Test<h1>Head<div><h2>`,
  `<p>Test<h1>Head<ul><h2>`,
  `<p>Test<h1>Head<dd><h2>`,
  `<p>Test<h1>Head<applet><h2>`,
  `<p>Test<h1>Head<h2><h2>`,
  
  `<table><td><p>Test<h1>Head<button><td><h2>`,
  `<p>Test<h1>Head`,
  `<table><td><p>Test<blockquote>Foo<p>bar<td>`,
  `<p>Test<li>li<blockquote>Foo<p>bar<p>`,
  `<table><td>foo<button>one<button><p>two<button>three<td>cell`,
  `<p><foo><li>`,
  `<svg><big><rect></svg>`,
  `<tr><b>bold<i>italic<li></b>`,
  `<svg><path>text<bar>Foo<p>Test<rect></body><!--->`,

  `Hello`,
  `<body>Hello`,
  `<script>fn</`+`script>Hello`,
  `<table><td>foo<tr><td>bar<col>`, 
  `<br>`, 

  `Test close by cell
  <table><colgroup><td>cell1<td>cell2`,

  `Test close by cell (2)
  <template><colgroup><td>cell1<td>cell2`,
  '<p>para<span>foo<select><dd>dd',
  '<table><td><applet><td>',
  '<button><div><p><applet><button>',
  '<button><div><p><applet><p>', 
]
