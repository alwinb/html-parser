// Samples
// -------

window ['html-suites'] = [
  
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

  {
    title: 'Formatting / AAA',
    samples: [
      '<i><b><i>1<p><s><u>2<p>bar</b>3',

      '<i><b><i>1<p>bar</b>3',
      '<i><b><i>1<aside>bar</b>3',
      '<i><b><i>1<div>bar</b>3',
      '<i><b><i>1<address>bar</b>3',
      '<i><b><i>1<blockquote>bar</b>3',
      '<i><b><i>1<main>bar</b>3',
      '<i><b><i>1<li>bar</b>3',
      '<i><b><i>1<ul>bar</b>3',
      '<i><b><i>1<dl>bar</b>3',
      '<i><b><i>1<dd>bar</b>3',
      '<i><b><i>1<object>bar</b>3',
      '<i><b><i>1<h1>bar</b>3',
      '<i><b><i>1<aside>bar</b>3',
      '<i><b><i>1<other>bar</b>3',

      '<i><b><s>foo<p>bar</b>bee',
      '<b>foo<p>bar</b>bee',
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
      '<b>foo<button>bar</b>bee',
      '<b>foo<article>bar</b>bee',
      '<b>foo<h1>bar</b>bee',
      '<tr><b>bold<i>italic<li></b>bee',
    ]
  },

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
      
      // Special case end tag
      '</p>foo',
      '<html></p>foo',
      's</p>foo',
      '<body></p>foo',
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
      '<p>Test<h1>Head<div><h2>foo',
      '<p>Test<h1>Head<div></h2>foo',
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
      '<p>Test<li>Head<div><li>foo',
      '<p>Test<li>Head<div></li>foo',
      '<p>Test<li>Head<address><li>foo',
      '<p>Test<li>Head<address></li>foo',
      '<p>Test<li>Head<center><li>foo',
      '<p>Test<li>Head<center></li>foo',
    ]
  },

  {
    title: 'List scopes 2',
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
      '<svg><b>foo',
      '<svg>foo<sub>bar',
      '<svg>foo<other>bar',
      '<svg>foo<body>bar',
      '<svg>foo<head>bar',
      '<svg>foo<center>bar',
      `<svg><big><rect></svg>`,
      '<svg>foo<rect><path><circle></rect>sd<center>bar',
      `<svg><path>text<bar>Foo<p>Test<rect></body><!--->`,
      '<svg>foo<blockquote>bar',

      // Test self-closing flags
      '<svg>foo<close/>bar',
      '<svg>foo<desc><close/>bar',
      '<svg>foo<foreignobject><close/>bar',
      '<svg>foo<foreignObject><close/>bar',
      '<svg>foo<close/>bar',

      '<svg>foo<mi><close/>bar',
      '<svg>foo<mo><close/>bar',
      '<svg>foo<mn><close/>bar',
      '<svg>foo<ms><close/>bar',

      '<math>foo<close/>bar',
      '<math>foo<desc><close/>bar',
      '<math>foo<foreignobject><close/>bar',
      '<math>foo<foreignObject><close/>bar',

      '<math>foo<close/>bar',
      '<math>foo<mi><close/>bar',
      '<math>foo<mo><close/>bar',
      '<math>foo<mn><close/>bar',
      '<math>foo<ms><close/>bar',

      // In tables...
      
      '<div><table><svg><desc><td>',
      '<div><table></svg><desc><td>',
      '<div><table><td><svg><desc><td>',
      '<div><other><svg><desc><td>',

      // Breakout tags
      '<svg><font size>foo',
      '<svg><font color>foo',
      '<svg><font face>foo',

      // Yet more
      '<svg></body>foo<!-->bar',
      '<svg></html>foo<!-->bar',
      '<svg><body></body>foo<!-->bar',
      '<svg><body></body>foo<!-->bar',
      '<svg><html></html>foo<!-->bar',
      '<svg><html></html>foo<!-->bar',

      // Non-breakout
      '<svg><font Size>foo',
      '<svg><font cOlor>foo',
      '<svg><font faCe>foo',
      '<svg><font>foo',
      '<svg><font other>foo',

    ]
  },

  {
    title: 'Integration points',
    samples: [
      '<svg><a>foo',
      '<math>foo<desc>bar<div>bee',
      '<svg><desc>foo<b>bar',
      '<svg>foo<desc></svg>bar',
      '<svg>foo<desc><selfClose/><br/>bar',
      '<svg>foo<desc><selfClose/><other/>bar',

      // test closing of <desc>
      '<svg>foo<desc>bar</svg>bee',
      '<svg>foo<desc>bar<a></svg>bee',
      '<svg>foo<desc>bar<div></svg>bee',
      '<svg>foo<desc>bar<ul></svg>bee',
      '<svg>foo<desc>bar<p></svg>bee',
      '<svg>foo<desc>bar<li></svg>bee',
      '<svg>foo<desc>bar<select></svg>bee',
      '<svg>foo<desc>bar<option></svg>bee',
      '<svg>foo<desc>bar<select><option></svg>bee',
      '<svg>foo<desc>bar<p><option></svg>bee',
      '<svg>foo<desc>bar<p><button></svg>bee',
      '<svg>foo<desc>bar<optgroup></svg>bee',
      '<svg>foo<desc>bar<table></svg>bee',
      '<svg>foo<desc>bar<table><tbody></svg>bee',
      '<svg>foo<desc>bar<table><tr></svg>bee',
      '<svg>foo<desc>bar<table><td></svg>bee',
      '<svg>foo<desc>bar<table><caption></svg>bee',
      '<svg>foo<desc>bar<table><colgroup></svg>bee',

      // test closing of <foreignobject>
      '<svg>foo<foreignobject>bar</svg>bee',
      '<svg>foo<foreignobject>bar<a></svg>bee',
      '<svg>foo<foreignobject>bar<div></svg>bee',
      '<svg>foo<foreignobject>bar<ul></svg>bee',
      '<svg>foo<foreignobject>bar<p></svg>bee',
      '<svg>foo<foreignobject>bar<li></svg>bee',
      '<svg>foo<foreignobject>bar<select></svg>bee',
      '<svg>foo<foreignobject>bar<option></svg>bee',
      '<svg>foo<foreignobject>bar<select><option></svg>bee',
      '<svg>foo<foreignobject>bar<p><option></svg>bee',
      '<svg>foo<foreignobject>bar<p><button></svg>bee',
      '<svg>foo<foreignobject>bar<optgroup></svg>bee',
      '<svg>foo<foreignobject>bar<table></svg>bee',
      '<svg>foo<foreignobject>bar<table><tbody></svg>bee',
      '<svg>foo<foreignobject>bar<table><tr></svg>bee',
      '<svg>foo<foreignobject>bar<table><td></svg>bee',
      '<svg>foo<foreignobject>bar<table><caption></svg>bee',
      '<svg>foo<foreignobject>bar<table><colgroup></svg>bee',

      // test closing of math from withing math-foreign tags
      '<math>foo<mi>bar</math>bee',
      '<math>foo<mi>bar<a></math>bee',
      '<math>foo<mi>bar<div></math>bee',
      '<math>foo<mi>bar<ul></math>bee',
      '<math>foo<mi>bar<p></math>bee',
      '<math>foo<mi>bar<li></math>bee',
      '<math>foo<mi>bar<select></math>bee',
      '<math>foo<mi>bar<option></math>bee',
      '<math>foo<mi>bar<select><option></math>bee',
      '<math>foo<mi>bar<p><option></math>bee',
      '<math>foo<mi>bar<p><button></math>bee',
      '<math>foo<mi>bar<optgroup></math>bee',
      '<math>foo<mi>bar<table></math>bee',
      '<math>foo<mi>bar<table><tbody></math>bee',
      '<math>foo<mi>bar<table><tr></math>bee',
      '<math>foo<mi>bar<table><td></math>bee',
      '<math>foo<mi>bar<table><caption></math>bee',
      '<math>foo<mi>bar<table><colgroup></math>bee',

      // Other
      '<svg><foreignobject>foo<p>bar<p>baz</svg>bee',
      '<svg><foreignObject>foo<p>bar<p>baz</svg>bee',
      '<svg><foreigNObject>foo<p>bar<p>baz</svg>bee',
      '<svg><desc>foo<rect>foo<tr><div>bar</svg>bee',
      '<math><desc>foo<svg>foo<tr><div>bar</svg>bee',
      
      // Math annotation-xml
      
      '<math><annotation-xml><p><p>',
      '<math><annotation-xml><other>',
      '<math><annotation-xml encoding=TeXt/Html><p><p>',
      '<math><annotation-xml encoding=TeXt/Html><other>',
      '<annotation-xml><p><p>',
      '<annotation-xml><other>',
      '<annotation-xml encoding=TeXt/Html><p><p>',
      '<annotation-xml encoding=TeXt/Html><other>',
      
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

      // After body, after frameset, after html
      '</body><title>X</title>',
      '</head> <head>',
      '</head> <p>',
      '</head> p',
      '<body></body></html>',
      '<head></head> <link>',
      '<head></head> <p>',
      '<html></html>',
      '<html><body></body>',
      '<html><frameset></frameset></html> ',
      '<table><th>',
      'foo</body><!--> bar<!--> bee',
      '<html><frameset></frameset></html><noframes>foo</noframes>',
      'foo</html><!-->',
      '</body><!-->bar',
    ]
  },

  {
    title: 'After Head',
    samples: [
      '</head> <link>',
      '</head> <style></style>foo',
      '</head> <style>bar</style>foo',
      '</head> <link>',
      '</head> <noscript>',
      '</head> <title>',

      '<head> </head> <style></style>foo',
      '<head> </head> <style>bar</style>foo',
      '<head> </head> <link>',
      '<html> </head> <link> </head> <body> foo',
      '<html> </head> <script> bar </script> </head> <body> foo',
      '<html> </head> <noscript> bar </noscript> </head> <body> foo',
      '<html> </head> <noframes> bar </noframes> </head> <body> foo',
      '<html> </head> <title> bar </title> </head> <body> foo',
    ]
  },

  {
    title: 'After Body',
    samples: [
      'foo</body><!--->',
      'foo</body><!---> ',
      'foo</body> <!--->',
      'foo</body>bar<!--->',
      'foo</body><other><!--->',
      'foo</body><body><!--->',
      'foo</body><!---></body><!--->',
      'foo</body><!---> </body><!--->',
      'foo</body> <!---></body> <!--->',
      //
      '<dl></body>foo',
      '<div></body>foo',
      '<address></body>foo',
      '<listing></body>foo',
      '<option></body>foo',
      '<optgroup></body>foo',
      '<button></body>foo',
      '<p></body>foo',
      '<li></body>foo',
      //
      '<dl></body><!-->foo',
      '<div></body><!-->foo',
      '<address></body><!-->foo',
      '<listing></body><!-->foo',
      '<option></body><!-->foo',
      '<optgroup></body><!-->foo',
      '<button></body><!-->foo',
      '<p></body><!-->foo',
      '<li></body><!-->foo',
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

      // Hidden input
      '<table><input type=hiddenfoo',
      '<table><input type=hidden type=still-hidden>foo',
    ]
  },

  {
    title: 'Others',
    samples: [
      '<table><caption><p><option><tr>',
      '<h1><option><h2>bar<option>',
      '<p><option><h1>bar<option>',
      '<button><li><button>bar<li>',
      '<other><li></other>bar<li>bee',
      '<dd><li></dd>bar<li>bee',
      '<other><dd></other>bar<dd>bee',
      
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
  
  {
    title: 'Body -> Frameset',
    samples: [
      '<head> </head> <span> <source> <frameset>',
      '<head> </head> <applet> <source> <frameset>',
      '<head> </head> <div> <source> <frameset>',

      '<head> </head> <pre> <source> <frameset>',
      '<head> </head> <listing> <source> <frameset>',
      '<head> </head> <menu> <source> <frameset>',
      '<head> </head> <main> <source> <frameset>',
    ]
  },


  // Tests taken from the html5lib = tests
  // -------------------------------------

  {
    title: 'tables01.dat',
    samples: [
      '<table><th>',
      '<table><td>',
      '<table><col foo=\'bar\'>',
      '<table><colgroup></html>foo',
      '<table></table><p>foo',
      '<table></body></caption></col></colgroup></html></tbody></td></tfoot></th></thead></tr><td>',
      '<table><select><option>3</select></table>',
      '<table><select><table></table></select></table>',
      '<table><select></table>',
      '<table><select><option>A<tr><td>B</td></tr></table>',
      '<table><td></body></caption></col></colgroup></html>foo',
      '<table><td>A</table>B',
      '<table><tr><caption>',
      '<table><tr></body></caption></col></colgroup></html></td></th><td>foo',
      '<table><td><tr>',
      '<table><td><button><td>',
      '<table><tr><td><svg><desc><td>',
    ]
  },

  { 
    title: 'blocks.dat',
    samples: [
      '<!doctype html><p>foo<address>bar<p>baz',
      '<!doctype html><address><p>foo</address>bar',
      '<!doctype html><p>foo<article>bar<p>baz',
      '<!doctype html><article><p>foo</article>bar',
      '<!doctype html><p>foo<aside>bar<p>baz',
      '<!doctype html><aside><p>foo</aside>bar',
      '<!doctype html><p>foo<blockquote>bar<p>baz',
      '<!doctype html><blockquote><p>foo</blockquote>bar',
      '<!doctype html><p>foo<center>bar<p>baz',
      '<!doctype html><center><p>foo</center>bar',
      '<!doctype html><p>foo<details>bar<p>baz',
      '<!doctype html><details><p>foo</details>bar',
      '<!doctype html><p>foo<dialog>bar<p>baz',
      '<!doctype html><dialog><p>foo</dialog>bar',
      '<!doctype html><p>foo<dir>bar<p>baz',
      '<!doctype html><dir><p>foo</dir>bar',
      '<!doctype html><p>foo<div>bar<p>baz',
      '<!doctype html><div><p>foo</div>bar',
      '<!doctype html><p>foo<dl>bar<p>baz',
      '<!doctype html><dl><p>foo</dl>bar',
      '<!doctype html><p>foo<fieldset>bar<p>baz',
      '<!doctype html><fieldset><p>foo</fieldset>bar',
      '<!doctype html><p>foo<figcaption>bar<p>baz',
      '<!doctype html><figcaption><p>foo</figcaption>bar',
      '<!doctype html><p>foo<figure>bar<p>baz',
      '<!doctype html><figure><p>foo</figure>bar',
      '<!doctype html><p>foo<footer>bar<p>baz',
      '<!doctype html><footer><p>foo</footer>bar',
      '<!doctype html><p>foo<header>bar<p>baz',
      '<!doctype html><header><p>foo</header>bar',
      '<!doctype html><p>foo<hgroup>bar<p>baz',
      '<!doctype html><hgroup><p>foo</hgroup>bar',
      '<!doctype html><p>foo<listing>bar<p>baz',
      '<!doctype html><listing><p>foo</listing>bar',
      '<!doctype html><p>foo<menu>bar<p>baz',
      '<!doctype html><menu><p>foo</menu>bar',
      '<!doctype html><p>foo<nav>bar<p>baz',
      '<!doctype html><nav><p>foo</nav>bar',
      '<!doctype html><p>foo<ol>bar<p>baz',
      '<!doctype html><ol><p>foo</ol>bar',
      '<!doctype html><p>foo<pre>bar<p>baz',
      '<!doctype html><pre><p>foo</pre>bar',
      '<!doctype html><p>foo<section>bar<p>baz',
      '<!doctype html><section><p>foo</section>bar',
      '<!doctype html><p>foo<summary>bar<p>baz',
      '<!doctype html><summary><p>foo</summary>bar',
      '<!doctype html><p>foo<ul>bar<p>baz',
      '<!doctype html><ul><p>foo</ul>bar',
    ]
  },
  
  {
    title: 'tests6.dat',
    samples: [
      '<!doctype html></head> <head>',
      '<!doctype html><form><div></form><div>',
      '<!doctype html><title>&amp;</title>',
      '<!doctype html><title><!--&amp;--></title>',
      '<!doctype>',
      '<!---x',
      '<body>',
      '<frameset></frameset>\nfoo',
      '<frameset></frameset>\n<noframes>',
      '<frameset></frameset>\n<div>',
      '<frameset></frameset>\n</html>',
      '<frameset></frameset>\n</div>',
      '<form><form>',
      '<button><button>',
      '<table><tr><td></th>',
      '<table><caption><td>',
      '<table><caption><div>',
      '</caption><div>',
      '<table><caption><div></caption>',
      '<table><caption></table>',
      '</table><div>',
      '<table><caption></body></col></colgroup></html></tbody></td></tfoot></th></thead></tr>',
      '<table><caption><div></div>',
      '<table><tr><td></body></caption></col></colgroup></html>',
      '</table></tbody></tfoot></thead></tr><div>',
      '<table><colgroup>foo',
      'foo<col>',
      '<table><colgroup></col>',
      '<frameset><div>',
      '</frameset><frame>',
      '<frameset></div>',
      '</body><div>',
      '<table><tr><div>',
      '</tr><td>',
      '</tbody></tfoot></thead><td>',
      '<table><tr><div><td>',
      '<caption><col><colgroup><tbody><tfoot><thead><tr>',
      '<table><tbody></thead>',
      '</table><tr>',
      '<table><tbody></body></caption></col></colgroup></html></td></th></tr>',
      '<table><tbody></div>',
      '<table><table>',
      '<table></body></caption></col></colgroup></html></tbody></td></tfoot></th></thead></tr>',
      '</table><tr>',
      '<body></body></html>',
      '<html><frameset></frameset></html> ',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN"><html></html>',
      '<param><frameset></frameset>',
      '<source><frameset></frameset>',
      '<track><frameset></frameset>',
      '</html><frameset></frameset>',
      '</body><frameset></frameset>',
    ]
  },

  {
    title: 'tests7.dat',
    samples: [
      '<!doctype html><body><title>X</title>',
      '<!doctype html><table><title>X</title></table>',
      '<!doctype html><head></head><title>X</title>',
      '<!doctype html></head><title>X</title>',
      '<!doctype html><table><meta></table>',
      '<!doctype html><table>X<tr><td><table> <meta></table></table>',
      '<!doctype html><html> <head>',
      '<!doctype html> <head>',
      '<!doctype html><table><style> <tr>x </style> </table>',
      '<!doctype html><table><TBODY><script> <tr>x </script> </table>',
      '<!doctype html><p><applet><p>X</p></applet>',
      '<!doctype html><p><object type="application/x-non-existant-plugin"><p>X</p></object>',
      '<!doctype html><listing>',
      '<!doctype html><select><input>X',
      '<!doctype html><select><select>X',
      '<!doctype html><table><input type=hidDEN></table>',
      '<!doctype html><table>X<input type=hidDEN></table>',
      '<!doctype html><table>  <input type=hidDEN></table>',
      '<!doctype html><table>  <input type=\'hidDEN\'></table>',
      '<!doctype html><table><input type=" hidden"><input type=hidDEN></table>',
      '<!doctype html><table><select>X<tr>',
      '<!doctype html><select>X</select>',
      '<!DOCTYPE hTmL><html></html>',
      '<!DOCTYPE HTML><html></html>',
      '<body>X</body></body>',
      '<div><p>a</x> b',
      '<table><tr><td><code></code> </table>',
      '<table><b><tr><td>aaa</td></tr>bbb</table>ccc',
      'A<table><tr> B</tr> B</table>',
      'A<table><tr> B</tr> </em>C</table>',
      '<select><keygen>',
    ]
  },

  {
    title: 'tests8.dat',
    samples: [
      '<div>',
      '<div>x<div></div>',
      '<div>x<div></div>x</span>x',
      '<div>x<div></div>y</span>z',
      '<table><div>x<div></div>x</span>x',
      '<table><li><li></table>',
      'x<table>x',
      'x<table><table>x',
      '<b>a<div></div><div></b>y',
      '<a><div><p></a>',
      '<div>',
      '<div>x<div></div>',
      '<div>x<div></div>x</span>x',
      '<div>x<div></div>y</span>z',
    ]
  },

  {
    title: 'tests9.dat',
    samples: [
      '<!DOCTYPE html><math></math>',
      '<!DOCTYPE html><body><math></math>',
      '<!DOCTYPE html><math><mi>',
      '<!DOCTYPE html><math><annotation-xml><svg><u>',
      '<!DOCTYPE html><body><select><math></math></select>',
      '<!DOCTYPE html><body><select><option><math></math></option></select>',
      '<!DOCTYPE html><body><table><math></math></table>',
      '<!DOCTYPE html><body><table><math><mi>foo</mi></math></table>',
      '<!DOCTYPE html><body><table><math><mi>foo</mi><mi>bar</mi></math></table>',
      '<!DOCTYPE html><body><table><tbody><math><mi>foo</mi><mi>bar</mi></math></tbody></table>',
      '<!DOCTYPE html><body><table><tbody><tr><math><mi>foo</mi><mi>bar</mi></math></tr></tbody></table>',
      '<!DOCTYPE html><body><table><tbody><tr><td><math><mi>foo</mi><mi>bar</mi></math></td></tr></tbody></table>',
      '<!DOCTYPE html><body><table><tbody><tr><td><math><mi>foo</mi><mi>bar</mi></math><p>baz</td></tr></tbody></table>',
      '<!DOCTYPE html><body><table><caption><math><mi>foo</mi><mi>bar</mi></math><p>baz</caption></table>',
      '<!DOCTYPE html><body><table><caption><math><mi>foo</mi><mi>bar</mi><p>baz</table><p>quux',
      '<!DOCTYPE html><body><table><caption><math><mi>foo</mi><mi>bar</mi>baz</table><p>quux',
      '<!DOCTYPE html><body><table><colgroup><math><mi>foo</mi><mi>bar</mi><p>baz</table><p>quux',
      '<!DOCTYPE html><body><table><tr><td><select><math><mi>foo</mi><mi>bar</mi><p>baz</table><p>quux',
      '<!DOCTYPE html><body><table><select><math><mi>foo</mi><mi>bar</mi><p>baz</table><p>quux',
      '<!DOCTYPE html><body></body></html><math><mi>foo</mi><mi>bar</mi><p>baz',
      '<!DOCTYPE html><body></body><math><mi>foo</mi><mi>bar</mi><p>baz',
      '<!DOCTYPE html><frameset><math><mi></mi><mi></mi><p><span>',
      '<!DOCTYPE html><frameset></frameset><math><mi></mi><mi></mi><p><span>',
      '<!DOCTYPE html><body xlink:href=foo><math xlink:href=foo></math>',
      '<!DOCTYPE html><body xlink:href=foo xml:lang=en><math><mi xml:lang=en xlink:href=foo></mi></math>',
      '<!DOCTYPE html><body xlink:href=foo xml:lang=en><math><mi xml:lang=en xlink:href=foo /></math>',
      '<!DOCTYPE html><body xlink:href=foo xml:lang=en><math><mi xml:lang=en xlink:href=foo />bar</math>',
    ]
  },

  {
    title: 'tests10.dat',
    samples: [
      '<!DOCTYPE html><svg></svg>',
      '<!DOCTYPE html><svg></svg><![CDATA[a]]>',
      '<!DOCTYPE html><body><svg></svg>',
      '<!DOCTYPE html><body><select><svg></svg></select>',
      '<!DOCTYPE html><body><select><option><svg></svg></option></select>',
      '<!DOCTYPE html><body><table><svg></svg></table>',
      '<!DOCTYPE html><body><table><svg><g>foo</g></svg></table>',
      '<!DOCTYPE html><body><table><svg><g>foo</g><g>bar</g></svg></table>',
      '<!DOCTYPE html><body><table><tbody><svg><g>foo</g><g>bar</g></svg></tbody></table>',
      '<!DOCTYPE html><body><table><tbody><tr><svg><g>foo</g><g>bar</g></svg></tr></tbody></table>',
      '<!DOCTYPE html><body><table><tbody><tr><td><svg><g>foo</g><g>bar</g></svg></td></tr></tbody></table>',
      '<!DOCTYPE html><body><table><tbody><tr><td><svg><g>foo</g><g>bar</g></svg><p>baz</td></tr></tbody></table>',
      '<!DOCTYPE html><body><table><caption><svg><g>foo</g><g>bar</g></svg><p>baz</caption></table>',
      '<!DOCTYPE html><body><table><caption><svg><g>foo</g><g>bar</g><p>baz</table><p>quux',
      '<!DOCTYPE html><body><table><caption><svg><g>foo</g><g>bar</g>baz</table><p>quux',
      '<!DOCTYPE html><body><table><colgroup><svg><g>foo</g><g>bar</g><p>baz</table><p>quux',
      '<!DOCTYPE html><body><table><tr><td><select><svg><g>foo</g><g>bar</g><p>baz</table><p>quux',
      '<!DOCTYPE html><body><table><select><svg><g>foo</g><g>bar</g><p>baz</table><p>quux',
      '<!DOCTYPE html><body></body></html><svg><g>foo</g><g>bar</g><p>baz',
      '<!DOCTYPE html><body></body><svg><g>foo</g><g>bar</g><p>baz',
      '<!DOCTYPE html><frameset><svg><g></g><g></g><p><span>',
      '<!DOCTYPE html><frameset></frameset><svg><g></g><g></g><p><span>',
      '<!DOCTYPE html><body xlink:href=foo><svg xlink:href=foo></svg>',
      '<!DOCTYPE html><body xlink:href=foo xml:lang=en><svg><g xml:lang=en xlink:href=foo></g></svg>',
      '<!DOCTYPE html><body xlink:href=foo xml:lang=en><svg><g xml:lang=en xlink:href=foo /></svg>',
      '<!DOCTYPE html><body xlink:href=foo xml:lang=en><svg><g xml:lang=en xlink:href=foo />bar</svg>',
      '<svg></path>',
      '<div><svg></div>a',
      '<div><svg><path></div>a',
      '<div><svg><path></svg><path>',
      '<div><svg><path><foreignObject><math></div>a',
      '<div><svg><path><foreignObject><p></div>a',
      '<!DOCTYPE html><svg><desc><div><svg><ul>a',
      '<!DOCTYPE html><svg><desc><svg><ul>a',
      '<!DOCTYPE html><p><svg><desc><p>',
      '<!DOCTYPE html><p><svg><title><p>',
      '<div><svg><path><foreignObject><p></foreignObject><p>',
      '<math><mi><div><object><div><span></span></div></object></div></mi><mi>',
      '<math><mi><svg><foreignObject><div><div></div></div></foreignObject></svg></mi><mi>',
      '<svg><script></script><path>',
      '<table><svg></svg><tr>',
      '<math><mi><mglyph>',
      '<math><mi><malignmark>',
      '<math><mo><mglyph>',
      '<math><mo><malignmark>',
      '<math><mn><mglyph>',
      '<math><mn><malignmark>',
      '<math><ms><mglyph>',
      '<math><ms><malignmark>',
      '<math><mtext><mglyph>',
      '<math><mtext><malignmark>',
      '<math><annotation-xml><svg></svg></annotation-xml><mi>',
      '<math><annotation-xml><svg><foreignObject><div><math><mi></mi></math><span></span></div></foreignObject><path></path></svg></annotation-xml><mi>',
      '<math><annotation-xml><svg><foreignObject><math><mi><svg></svg></mi><mo></mo></math><span></span></foreignObject><path></path></svg></annotation-xml><mi>',
    ]
  },

  {
    title: 'tests15.dat',
    samples: [
      '<!DOCTYPE html><p><b><i><u></p> <p>X',
      '<p><b><i><u></p>',
      '<!doctype html></html> <head>',
      '<!doctype html></body><meta>',
      '<html></html><!-- foo -->',
      '<!doctype html></body><title>X</title>',
      '<!doctype html><table> X<meta></table>',
      '<!doctype html><table> x</table>',
      '<!doctype html><table> x </table>',
      '<!doctype html><table><tr> x</table>',
      '<!doctype html><table>X<style> <tr>x </style> </table>',
      '<!doctype html><div><table><a>foo</a> <tr><td>bar</td> </tr></table></div>',
      '<frame></frame></frame><frameset><frame><frameset><frame></frameset><noframes></frameset><noframes>',
      '<!DOCTYPE html><object></html>',
    ]
  },

  {
    title: 'tests17.dat',
    samples: [
      '<!doctype html><table><tbody><select><tr>',
      '<!doctype html><table><tr><select><td>',
      '<!doctype html><table><tr><td><select><td>',
      '<!doctype html><table><tr><th><select><td>',
      '<!doctype html><table><caption><select><tr>',
      '<!doctype html><select><tr>',
      '<!doctype html><select><td>',
      '<!doctype html><select><th>',
      '<!doctype html><select><tbody>',
      '<!doctype html><select><thead>',
      '<!doctype html><select><tfoot>',
      '<!doctype html><select><caption>',
      '<!doctype html><table><tr></table>a',
    ]
  },

  {
    title: 'tests20.dat',
    samples: [
      '<!doctype html><p><button><button>',
      '<!doctype html><p><button><address>',
      '<!doctype html><p><button><blockquote>',
      '<!doctype html><p><button><menu>',
      '<!doctype html><p><button><p>',
      '<!doctype html><p><button><ul>',
      '<!doctype html><p><button><h1>',
      '<!doctype html><p><button><h6>',
      '<!doctype html><p><button><listing>',
      '<!doctype html><p><button><pre>',
      '<!doctype html><p><button><form>',
      '<!doctype html><p><button><li>',
      '<!doctype html><p><button><dd>',
      '<!doctype html><p><button><dt>',
      '<!doctype html><p><button><plaintext>',
      '<!doctype html><p><button><table>',
      '<!doctype html><p><button><hr>',
      '<!doctype html><p><button><xmp>',
      '<!doctype html><p><button></p>',
      '<!doctype html><address><button></address>a',
      '<!doctype html><address><button></address>a',
      '<p><table></p>',
      '<!doctype html><svg>',
      '<!doctype html><p><figcaption>',
      '<!doctype html><p><summary>',
      '<!doctype html><form><table><form>',
      '<!doctype html><table><form><form>',
      '<!doctype html><table><form></table><form>',
      '<!doctype html><svg><foreignObject><p>',
      '<!doctype html><svg><title>abc',
      '<option><span><option>',
      '<option><option>',
      '<math><annotation-xml><div>',
      '<math><annotation-xml encoding="application/svg+xml"><div>',
      '<math><annotation-xml encoding="application/xhtml+xml"><div>',
      '<math><annotation-xml encoding="aPPlication/xhtmL+xMl"><div>',
      '<math><annotation-xml encoding="text/html"><div>',
      '<math><annotation-xml encoding="Text/htmL"><div>',
      '<math><annotation-xml encoding=" text/html "><div>',
      '<math><annotation-xml> </annotation-xml>',
      '<math><annotation-xml>c</annotation-xml>',
      '<math><annotation-xml><!--foo-->',
      '<math><annotation-xml></svg>x',
      '<math><annotation-xml><svg>x',
    ]
  },

  //*
  {
    title: 'webkit01.dat',
    samples: [
      'Test',
      '<div></div>',
      '<div>Test</div>',
      '<di',
      '<div>Hello</div>',
      '<div foo="bar">Hello</div>',
      '<div>Hello</div>',
      '<foo bar="baz"></foo><potato quack="duck"></potato>',
      '<foo bar="baz"><potato quack="duck"></potato></foo>',
      '<foo></foo bar="baz"><potato></potato quack="duck">',
      '</ tttt>',
      '<div FOO ><img><img></div>',
      '<p>Test</p<p>Test2</p>',
      '<rdar://problem/6869687>',
      '<A>test< /A>',
      '&lt;',
      '<body foo=\'bar\'><body foo=\'baz\' yo=\'mama\'>',
      '<body></br foo="bar"></body>',
      '<bdy><br foo="bar"></body>',
      '<body></body></br foo="bar">',
      '<bdy></body><br foo="bar">',
      '<html><body></body></html><!-- Hi there -->',
      '<html><body></body></html><!-- Comment A --><!-- Comment B --><!-- Comment C --><!-- Comment D --><!-- Comment E -->',
      '<html><body></body></html>x<!-- Hi there -->',
      '<html><body></body></html>x<!-- Hi there --></html><!-- Again -->',
      '<html><body></body></html>x<!-- Hi there --></body></html><!-- Again -->',
      '<html><body><ruby><div><rp>xx</rp></div></ruby></body></html>',
      '<html><body><ruby><div><rt>xx</rt></div></ruby></body></html>',
      '<html><frameset><!--1--><noframes>A</noframes><!--2--></frameset><!--3--><noframes>B</noframes><!--4--></html><!--5--><noframes>C</noframes><!--6-->',
      '<select><option>A<select><option>B<select><option>C<select><option>D<select><option>E<select><option>F<select><option>G<select>',
      '<dd><dd><dt><dt><dd><li><li>',
      '<div><b></div><div><nobr>a<nobr>',
      '<head></head>',
      '<head></head> <style></style>ddd',
      '<kbd><table></kbd><col><select><tr>',
      '<kbd><table></kbd><col><select><tr></table><div>',
      '<a><li><style></style><title></title></a>',
      '<font></p><p><meta><title></title></font>',
      '<a><center><title></title><a>',
      '<svg><title><div>',
      '<svg><title><rect><div>',
      '<svg><title><svg><div>',
      '<img <="" FAIL>',
      '<ul><li><div id=\'foo\'/>A</li><li>B<div>C</div></li></ul>',
      '<svg><em><desc></em>',
      '<table><tr><td><svg><desc><td></desc><circle>',
      '<svg><tfoot></mi><td>',
      '<math><mrow><mrow><mn>1</mn></mrow><mi>a</mi></mrow></math>',
      '<!doctype html><input type="hidden"><frameset>',
      '<!doctype html><input type="button"><frameset>',
    ]
  },//*/
  
  {
    title: 'webkit02.dat',
    samples: [
      '<foo bar=qux/>',
      '<p id="status"><noscript><strong>A</strong></noscript><span>B</span></p>',
      '<p id="status"><noscript><strong>A</strong></noscript><span>B</span></p>',
      '<div><sarcasm><div></div></sarcasm></div>',
      '<html><body><img src="" border="0" alt="><div>A</div></body></html>',
      '<table><td></tbody>A',
      '<table><td></thead>A',
      '<table><td></tfoot>A',
      '<table><thead><td></tbody>A',
      '<legend>test</legend>',
      '<table><input>',
      '<b><em><foo><foo><aside></b>',
      '<b><em><foo><foo><aside></b></em>',
      '<b><em><foo><foo><foo><aside></b>',
      '<b><em><foo><foo><foo><aside></b></em>',
      '<b><em><foo><foo><foo><foo><foo><foo><foo><foo><foo><foo><aside></b></em>',
      '<b><em><foo><foob><foob><foob><foob><fooc><fooc><fooc><fooc><food><aside></b></em>',
      '<option><XH<optgroup></optgroup>',
      '<svg><foreignObject><div>foo</div><plaintext></foreignObject></svg><div>bar</div>',
      '<svg><foreignObject></foreignObject><title></svg>foo',
      '</foreignObject><plaintext><div>foo</div>',
    ]
  },
  
]

