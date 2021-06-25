// Samples
// -------

window['html-samples'] = [

  // Test integration points
  '<svg><desc>foo<rect>foo<tr><div>bar</svg>bee',
  '<svg><foreignObject>foo<rect>bar<tr><div>baz</svg>bee',

  // Test foreign content
  '<svg><desc>foo<b>bar',
  '<svg><b>foo',
  '<svg>foo<sub>bar',
  '<svg>foo<other>bar',
  '<svg>foo<body>bar',
  '<svg>foo<center>bar',
  `<svg><big><rect></svg>`,
  '<svg>foo<rect><path><circle></rect>sd<center>bar',
  `<svg><path>text<bar>Foo<p>Test<rect></body><!--->`,
  '<svg>foo<blockquote>bar', //*/


  // Test list scope
  '<li>a<ul><li>a<li>b',
  '<li>a<div><li>a<li>b',
  '<li>a<address><li>a<li>b',
  '<li>a<p><li>a<li>b',
  '<li>a<sd><li>a<li>b',
  '<li>a<dl><li>a<li>b',
  '<li>a<di><li>a<li>b',


  /* Test reopening of formatting 
  '<i><s><b>bar</s>foo',
  '<i><s><b>bar</i>foo',
  '<div><b>bar</div>foo',
  '<applet><b>bar</applet>foo',
  '<marquee><b>bar</marquee>foo',
  '<sdiv><b>bar</sdiv>foo',
  '<object><b>bar</object>foo',
  '<template><b>bar</template>foo',
  '<table><th><b>bar<th>foo',
  '<a><i><b>foo</i>ibs',
  '<a><i><b>foo</b>ibs',
  '<i><sdiv><b> a</sdiv>foo',
  '<li>a<ul><li>a<b>a<li>b', //*/

  // Test reconstruction of formatting 
  '<div><s><s><i><b><tt>foo</i></div><select>',
  '<a><i><b>foo</i><div>one',
  '<a><i><b>foo</i><nobr>one',
  '<a><i><b>foo</i><a>one',
  '<a><i><b>foo</i><br>one',
  '<a><i><b>foo</i><input>one',
  '<a><i><b>foo</i><sdiv>one',


  // Test foster parenting
  '<button>text<table>foo<button>bar<td>baz</table>γαμμα',
  '<table><caption><button>text<table>foo<button>bar<p>bee<td>baz<tr></table>γαμμα',
  '<button>text<table>foo<button>bar<p>bee<td>baz<tr></table>γαμμα',
  '<!doctype html><main><p><table><p>foo<td>bar', 
  '<main><table><caption><ul><li>text<table><p>foo<td>bar<tr></table>γαμμα',
  '<!doctype html><p>Test<h1>Head1<table>foo<div></h2>Text',
  '<!doctype html><p>TestHead1<table>foo<div></h2>Text',

  // Test foster parenting with formatting tags
  '<table><caption><b>text<table>foo<b>bar<p>bee<td>baz<tr></table>γαμμα', 


  // Test dd dt scope
  `text<li>li<dd><li><td>dd1<dd>dd2`,
  `text<li>li<dd>dd1<dd>dd2`,
  `text<li>li<dd><div>dd1<dd>dd2`,


  // Test select, option and optgroup
  `<bar><p>as<select><li>foo`,
  `Foo bar<p>as<select><li>foo<li>bar<option>bee<li><option><p><h1><select>ad`,
  `Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee<select>Baz<optgroup>Item<li>item<optgroup>g<di>Di</select>`,
  `Test nesting of option and optgroup.
    <select>Foo<textarea>Bar</textarea>
    <select>Foo<input>
    <select>Foo<keygen>
    <select>Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee<select>Baz<optgroup>Item<li>item<optgroup>g<di>Di</select>
  `,
  
  // `<option>Item<li>item<di><option><select><option>Item<li>item<di><option><select>`,
  // `<option>Item<li>item<di><option>Item2<li>item<di><option><select><option>Item<li>item<di><option><option>Item2<li><optgroup>item<di>`,

  // Test implicit head and body
  `Hello`,
  `<body>Hello`,
  `<script>fn</script>Hello`,
  `<br>`,
  `</head>Foo`,
  `</body>Foo`,
  `</html>Foo`,
  `<head></head>After head</head>Foo`,
  `<head></head>After head</body>Foo`,
  `<head></head>After head</html>Foo`,


  // Test headings
  `text<h1>s<div>b<h2>`,
  `text<h1>b<h2>`,
  `<p>Test<h1>Head1<div><h2>Head2`,
  `<p>Test<h1>Head1<sdiv><h2>Head2`,
  `<p>Test<h1>Head1<div></h2>Text`,
  `<p>Test<h1>Head<button><h2>`,
  `<p>Test<h1>Head<div><h2>`,
  `<p>Test<h1>Head<ul><h2>`,
  `<p>Test<h1>Head<dd><h2>`,
  `<p>Test<h1>Head<applet><h2>`,
  `<p>Test<h1>Head<h2><h2>`,
  `<table><td><p>Test<h1>Head<button><td><h2>`,
  `<p>Test<h1>Head`,


  // Others
  `<uli>a<button>b</uli><p>c<button>dee`,
  `<ul><li>one<ul></li>text`,
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

  `<table><td><p>Test<blockquote>Foo<p>bar<td>`,
  `<p>Test<li>li<blockquote>Foo<p>bar<p>`,
  `<table><td>foo<button>one<button><p>two<button>three<td>cell`,
  `<p><foo><li>`,
  `<tr><b>bold<i>italic<li></b>`,

  `Test close by cell
  <table><colgroup><td>cell1<td>cell2`,
  `Test close by cell (2)
  <template><colgroup><td>cell1<td>cell2`,
  `<table><td>foo<tr><td>bar<col>`, 
  '<p>para<span>foo<select><dd>dd',
  '<table><td><applet><td>',
  '<button><div><p><applet><button>',
  '<button><div><p><applet><p>', 
]
