#!/bin/bash
cp deckbuilder.html index.html
sed -i.bak -E 's/deckbuilder.js/deckbuilder.compat.js/' index.html
babel deckbuilder.js > deckbuilder.compat.js

