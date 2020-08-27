.PHONY: all clean run

files = browser.js lexer.js tokens.js parser.js index.js
sources = $(addprefix lib/, $(files))

all: dist/html.min.js

run: all
	open test/test.html

dist/html.min.js: dist/ $(sources)
	browserify lib/browser.js | terser -cm > dist/html.min.js

dist/:
	mkdir dist/

clean:
	test -d dist/ && rm -r dist/ || exit 0

