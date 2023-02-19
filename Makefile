.PHONY: all clean run

files = dfa.js tokeniser.js treebuilder.js parser.js index.js dom.js categories.js schema.js
sources = $(addprefix lib/, $(files))

all: dist/domex.min.js dist/html.min.js Makefile

dist/domex.min.js: test/domex-browser.js Makefile
	@ echo "Making domex browser module"
	@ esbuild node_modules/domex/src/browser.js --bundle --format=esm --minify --outfile=dist/domex.min.js

dist/html.min.js: dist/ $(sources) Makefile
	@ echo "Making html-parser ES module"
	@ esbuild lib/index.js --bundle --format=esm --minify --outfile=dist/html.min.js

dist/:
	mkdir dist/

clean:
	test -d dist/ && rm -r dist/ || exit 0

