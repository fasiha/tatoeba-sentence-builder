#!/bin/bash
cp deckbuilder.html index.html
sed -i.bak -E 's/deckbuilder.js/deckbuilder.compat.js/' index.html
babel deckbuilder.js > deckbuilder.compat.js

mkdir -p review
cp review.html review/index.html
sed -i.bak -E 's/review.js/review.compat.js/' review/index.html
babel review.js > review/review.compat.js

