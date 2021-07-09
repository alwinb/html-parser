// Samples
// -------

window['html-suites'] = [
  
  /*
  {
    title: 'QuirksMode'
    samples: [
      '<!doctype html><p>TestHead1<table>foo<div></h2>Text',
      '<!doctype html><main><p><table><p>foo<td>bar', 
      '<!doctype html><p>TestHead1<table>foo<div></h2>Text',
    ]
  },//*/

  {
    title: 'Reopen Formatting Tags',
    samples: [
      '<div><s><s><i><b><tt><s><s><s>foo</i><tt><tt><tt><tt></div>X',
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
      '<li>a<ul><li>a<b>a<li>b'
    ]
  },

  {
    title: 'Reconstruct Formatting',
    samples: [
      '<a><i><s><b><a>bar</i>foo',
      '<div><s><s><i><b><tt>foo</i></div><select>',
      '<a><i><b>foo</i><div>one',
      '<a><i><b>foo</i><nobr>one',
      '<a><i><b>foo</i><a>one',
      '<a><i><b>foo</i><br>one',
      '<a><i><b>foo</i><input>one',
      '<a><i><b>foo</i><sdiv>one',
    ]
  },

  {
    title: 'Formatting / Content',
    samples: [
      '<b>foo<optgroup>bar<b>bee',
      '<b>foo<option>bar<b>bee',
      '<b>foo<other>bar<b>bee',
      '<b>foo<div>bar<b>bee',
      '<b>foo<address>bar<b>bee',
      '<b>foo<dl>bar<b>bee',
      '<b>foo<applet>bar<b>bee',
      '<b>foo<center>bar<b>bee',
      '<b>foo<blockquote>bar<b>bee',
      '<b>foo<li>bar<b>bee',
      '<b>foo<p>bar<b>bee',
      '<b>foo<button>bar<b>bee',
      '<b>foo<article>bar<b>bee',
      '<b>foo<h1>bar<b>bee',
      '<tr><b>bold<i>italic<li><b>bee',
    ]
  },

  /*
  {
    title: 'Formatting / AAA',
    samples: [
      '<a>foo<p>bar<a>bee',
      '<a>asd<p><a>d',
      '<a>asd<h1><a>d',

      '<b>foo<optgroup>bar</b>bee',
      '<b>foo<option>bar</b>bee',
      '<b>foo<other>bar</b>bee',
      '<b>foo<div>bar</b>bee',
      '<b>foo<address>bar</b>bee',
      '<b>foo<dl>bar</b>bee',
      '<b>foo<applet>bar</b>bee',
      '<b>foo<center>bar</b>bee',
      '<b>foo<blockquote>bar</b>bee',
      '<b>foo<li>bar</b>bee',
      '<b>foo<p>bar</b>bee',
      '<b>foo<button>bar</b>bee',
      '<b>foo<article>bar</b>bee',
      '<b>foo<h1>bar</b>bee',
      '<tr><b>bold<i>italic<li></b>bee',
    ]
  },//*/

  {
    title: 'Table content in caption',
    samples: [
      '<table><caption><b>text<b>bar<p>bee<td>baz<tr></table>γαμμα',
    ]
  },

  {
    title: 'Foster parenting',
    samples: [
      '<button>text<table>foo<button>bar<td>baz</table>γαμμα',
      '<table><caption><button>text<table>foo<button>bar<p>bee<td>baz<tr></table>γαμμα',
      '<button>text<table>foo<button>bar<p>bee<td>baz<tr></table>γαμμα',
      '<main><table><caption><ul><li>text<table><p>foo<td>bar<tr></table>γαμμα',
      '<!doctype html><p>Test<h1>Head1<table>foo<div></h2>Text',
    ]
  },

  {
    title: 'Foster parenting and Formatting',
    samples: [
      '<table><b><td><s>bee<td>bar</table>buzz',
      '<table><caption><b>text<table>foo<b>bar<p>bee<td>baz<tr></table>γαμμα', 
    ]
  },

  {
    title: 'Paragraphs',
    samples: [
      '<optgroup>foo<p>bar</optgroup>bee',
      '<optgroup>foo<p>bar<optgroup>bee',
      '<option>foo<p>bar</option>bee',
      '<option>foo<p>bar<option>bee',
      '<other>foo<p>bar</other>bee',
      '<other>foo<p>bar<other>bee',
      '<div>foo<p>bar</div>bee',
      '<div>foo<p>bar<div>bee',
      '<address>foo<p>bar</address>bee',
      '<address>foo<p>bar<address>bee',
      '<center>foo<p>bar</center>bee',
      '<center>foo<p>bar<center>bee',
      '<blockquote>foo<p>bar</blockquote>bee',
      '<blockquote>foo<p>bar<blockquote>bee',
      '<li>foo<p>bar</li>bee',
      '<li>foo<p>bar<li>bee',
      '<p>foo<p>bar</p>bee',
      '<p>foo<p>bar<p>bee',
      '<button>foo<p>bar</button>bee',
      '<button>foo<p>bar<button>bee',
      '<h1>foo<p>bar</h1>bee',
      '<h1>foo<p>bar<h1>bee',
      '<h1>foo<p>bar</h2>bee',
      '<h1>foo<p>bar<h2>bee',
    ]
  },

  {
    title: 'Buttons',
    samples: [
      '<optgroup>foo<button>bar</optgroup>bee',
      '<optgroup>foo<button>bar<optgroup>bee',
      '<option>foo<button>bar</option>bee',
      '<option>foo<button>bar<option>bee',
      '<other>foo<button>bar</other>bee',
      '<other>foo<button>bar<other>bee',
      '<div>foo<button>bar</div>bee',
      '<div>foo<button>bar<div>bee',
      '<center>foo<button>bar</center>bee',
      '<center>foo<button>bar<center>bee',
      '<li>foo<button>bar</li>bee',
      '<li>foo<button>bar<li>bee',
      '<button>foo<button>bar</button>bee',
      '<button>foo<button>bar<button>bee',
      '<p>foo<button>bar</p>bee',
      '<p>foo<button>bar<p>bee',
      '<h1>foo<button>bar</h1>bee',
      '<h1>foo<button>bar<h1>bee',
      '<h1>foo<button>bar</h2>bee',
      '<h1>foo<button>bar<h2>bee',
    ]
  },

  {
    title: 'Headings',
    samples: [
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
      `<p>Test<h1>Head`,
      '<li><h1>asd</li>asd',
      '<li><h1>asd<li>asd',
      '<p><h1>asd<p>asd',
      '<div><h1>asd<div>asd',
    ]
  },

  {
    title: 'Others / Stacking',
    samples: [
      '<dd><other><dd><div><dt>',
      '<li><other><li><div><li>',
      '<button><other><button><div><button>',
      '<p><other><p><div><p>',
      '<h1><other><h2><div><h3>',
      '<h1><s><h2><s><h3>',
    ]
  },

  {
    title: 'Option and Optgroup',
    samples: [
      'Foo<option>Bar<s><option>Baz<optgroup>Baz<option>Bee',
      'Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee',
      `Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee<select>Baz<optgroup>Item<li>item<optgroup>g<di>Di</select>`,
      '<select><div><optgroup>foo<p>bar</optgroup>sd',
      '<select><div><optgroup>foo<p>bar<optgroup>sd',
      '<div><optgroup>foo<p>bar</optgroup>sd',
      '<div><optgroup>foo<p>bar<optgroup>sd',
      '<select><div><option>foo<p>bar</option>sd',
      '<select><div><option>foo<p>bar<option>sd',
      '<div><option>foo<p>bar</option>sd',
      '<div><option>foo<p>bar<option>sd',

      '<select><div><optgroup>foo<b>bar</optgroup>sd',
      '<select><div><optgroup>foo<b>bar<optgroup>sd',
      '<div><optgroup>foo<b>bar</optgroup>sd',
      '<div><optgroup>foo<b>bar<optgroup>sd',
      '<select><div><option>foo<b>bar</option>sd',
      '<select><div><option>foo<b>bar<option>sd',
      '<div><option>foo<b>bar</option>sd',
      '<div><option>foo<b>bar<option>sd',
    ]
  },

  {
    title: 'Select, Option and Optgroup',
    samples: [
      '<p>para<span>foo<select><dd>dd',
      '<select><table><div>foo</div><div>bar',
      `<bar><p>as<select><li>foo`,
      `Foo bar<p>as<select><li>foo<li>bar<option>bee<li><option><p><h1><select>ad`,
      `Test nesting of option and optgroup (1).
        <select>Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee
        <select>Taz<optgroup>Item<li>item<optgroup>g<di>Di`,
      `Test nesting of option and optgroup (2).
        <select>Foo<textarea>Bar</textarea>
        <select>Foo<input>
        <select>Foo<keygen>
        <select>Foo<option>Bar<option>Baz<optgroup>Baz<option>Bee
        <select>Baz<optgroup>Item<li>item<optgroup>g<di>Di</select>`,
      `<option>Item<li>item<di><option><select><option>Item<li>item<di><option><select>`,
      `<option>Item<li>item<di><option>Item2<li>item<di><option><select><option>Item<li>item<di><option><option>Item2<li><optgroup>item<di>`,
    ]
  },

  {
    title: 'Select in Table',
    samples: [
      '<table><select>foo<select>bar',
      '<table><td>bar<select><td>bee',
      '<table><caption>bar<select><table>bee',
      '<table><caption>bar<select><caption>bee',
      '<table><caption>bar<select><colgroup>bee',
      '<table><caption>bar<select><col>bee',
      '<table><caption>bar<select><tbody>bee',
      '<table><caption>bar<select><tr>bee',
      '<table><caption>bar<select><td>bee',
      '<table><caption>bar<select><option><caption>bee',
      '<table><caption>bar<select><option></caption>bee',
      '<table><caption>bar<select><optgroup></caption>bee',
      '<table><select>foo<td>bar</td>bee',
      '<table><select>foo<table>bar',
      '<table><select>foo<caption>bar',
      '<table><select>foo<colgroup>bar',
      '<table><select>foo<col>bar',
      '<table><select>foo<tbody>bar',
      '<table><select>foo<tr>bar',
      '<table><select>foo<td>bar',
    ]
  },

  {
    title: 'List scopes',
    samples: [
      '<p>Test<li>Head<template><li>foo',
      '<p>Test<li>Head<template></li>foo',
      '<p>Test<li>Head<object><li>foo',
      '<p>Test<li>Head<object></li>foo',
      '<p>Test<li>Head<dl><li>foo',
      '<p>Test<li>Head<dl></li>foo',
      '<p>Test<li>Head<button><li>foo',
      '<p>Test<li>Head<button></li>foo',
      '<p>Test<li>Head<p><li>foo',
      '<p>Test<li>Head<p></li>foo',
      '<p>Test<li>Head<ul><li>foo',
      '<p>Test<li>Head<ul></li>foo',
      '<p>Test<h1>Head<div><h2>foo',
      '<p>Test<h1>Head<div></h2>foo',
      '<p>Test<li>Head<div><li>foo',
      '<p>Test<li>Head<div></li>foo',
      '<p>Test<li>Head<address><li>foo',
      '<p>Test<li>Head<address></li>foo',
      '<p>Test<li>Head<center><li>foo',
      '<p>Test<li>Head<center></li>foo',
    ]
  },

  {
    title: 'List scopes (2)',
    samples: [
      '<li><dd><li>A</li>B',
      '<li><dd>A</li>B',
      '<li>a<ul><li>a<li>b',
      '<li>a<div><li>a<li>b',
      '<li>a<address><li>a<li>b',
      '<li>a<p><li>a<li>b',
      '<li>a<sd><li>a<li>b',
      '<li>a<dl><li>a<li>b',
      '<li>a<di><li>a<li>b',
    ]
  },

  {
    title: 'Definition-list scope',
    samples: [
      `text<li>li<dd><li><td>dd1<dd>dd2`,
      `text<li>li<dd>dd1<dd>dd2`,
      `text<li>li<dd><div>dd1<dd>dd2`,
    ]
  },

  {
    title: 'Foreign content',
    samples: [
      '<math><desc>foo<svg>foo<tr><div>bar</svg>bee',
      '<svg><desc>foo<b>bar',
      '<svg><b>foo',
      '<svg>foo<sub>bar',
      '<svg>foo<other>bar',
      '<svg>foo<body>bar',
      '<svg>foo<center>bar',
      `<svg><big><rect></svg>`,
      '<svg>foo<rect><path><circle></rect>sd<center>bar',
      `<svg><path>text<bar>Foo<p>Test<rect></body><!--->`,
      '<svg>foo<blockquote>bar',
    ]
  },

  {
    title: 'Integration points',
    samples: [
      '<svg><a>foo',
      '<math><desc>foo<div>bar',
      '<svg><foreignobject>foo<p>bar<p>baz</svg>bee',
      '<svg><foreignObject>foo<p>bar<p>baz</svg>bee',
      '<svg><foreigNObject>foo<p>bar<p>baz</svg>bee',
      '<svg><desc>foo<rect>foo<tr><div>bar</svg>bee',
    ]
  },

  {
    title: 'Implicit head and body',
    samples: [
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
    ]
  },
    
  /*
  {
    title: 'Templates',
    samples: [
      `<template><colgroup><td>cell1<td>cell2`,
    ]
  },//*/
  
  { 
    title: 'Space in Tables',
    samples: [
      '<table><colgroup>a b<col> <col>',
      '<table> s<td></td> </table>',
    ]
  },

  {
    title: 'Tables',
    samples: [
      '<table><td><template><td>',
      '<table><caption><table><td></caption>text',
      '<table><caption><td><table><td></caption>text',
      '<table><caption><applet>applet-text</table>body-text',
      '<table><td><applet>applet-text</table>body-text',
      '<table><caption><td></table>Hello',
      '<table><caption><td><div></table>Hello',
      `<table><td><p>Test<blockquote>Foo<p>bar<td>`,
      `<table><td>foo<button>one<button><p>two<button>three<td>cell`,
      `<table><td><p>Test<blockquote>Foo<p>bar<td>`,
      `<table><td>foo<button>one<button><p>two<button>three<td>cell`,
      `<table><colgroup><td>cell1<td>cell2`,
      `<table><tr><tr><td>cell1<td>cell2`,
      `<table><td>foo<tr><td>bar<col>`, 
      '<table><td><applet><td>',
    ]
  },

  {
    title: 'Others',
    samples: [
      `<uli>a<button>b</uli><p>c<button>dee`,
      `<ul><li>one<ul></li>text`,
      '<li><applet>a </li>test <li>test',
      '<ul><li>one<ul></li>text',
      `<ul><li><applet><as></li>test</ul>
      <ul><li><p><as></li>test`,
      `<p>para<object>and<p>para`,
      `<p>Test<li>li<blockquote>Foo<p>bar<p>`,
      `<p><foo><li>`,
      '<button><div><p><applet><button>',
      '<button><div><p><applet><p>', 
    ]
  },

] // End Suites

