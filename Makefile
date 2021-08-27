.PHONY: all clean run

files = browser.js lexer.js tokens.js treebuilder.js parser.js index.js dom.js categories.js schema.js
sources = $(addprefix lib/, $(files))

all: dist/html.js dist/domex.min.js dist/html.min.js Makefile

dist/domex.min.js: test/domex-browser.js
	esbuild test/domex-browser.js --bundle --minify --outfile=dist/domex.min.js

dist/html.min.js: dist/ $(sources)
	esbuild lib/browser.js --bundle --minify --outfile=dist/html.min.js

dist/html.js: dist/ $(sources)
	esbuild lib/browser.js --bundle --outfile=dist/html.js

dist/:
	mkdir dist/

clean:
	test -d dist/ && rm -r dist/ || exit 0

