.PHONY: all clean run

files = browser.js lexer.js tokens.js parser.js index.js dom.js schema.js
sources = $(addprefix lib/, $(files))

all: dist/html.js dist/html.min.js

dist/html.min.js: dist/ $(sources)
	esbuild lib/browser.js --bundle --minify --outfile=dist/html.min.js

dist/html.js: dist/ $(sources)
	esbuild lib/browser.js --bundle --sourcemap --outfile=dist/html.js

dist/:
	mkdir dist/

clean:
	test -d dist/ && rm -r dist/ || exit 0

