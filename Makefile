# First we need npm modules. Nothing much, mostly lodash.
node_modules:
	npm install

# Now we can get cracking!

ordered-words.json words-only.json:
	node generate_words.js

# Node converts our list of words scraped from the Tono et al. file into two
# JSON files: words-only.json contains a flat array of words, some 5500 words
# long. This expansion happens because the same "word" in Tono can be broken
# down into two or even three words. ordered-words.json groups these sibling
# words together, so it contains an array of arrays.

data/JMdict_e data/examples.utf data/wwwjdic.csv:
	sudo updatedb-myougiden -f
	
	mkdir -p data
	cd data
	
	cp /usr/local/share/myougiden/JMdict_e.gz .
	gunzip -f JMdict_e.gz
	
	wget http://tatoeba.org/files/downloads/wwwjdic.csv
	sed -i.bak -e 's/|[0-9]//g' wwwjdic.csv
	
	wget http://www.csse.monash.edu.au/~jwb/examples.utf.gz
	gunzip -f examples.utf.gz
	
	cd ..
	
# Use myougiden to get JMdict. Also get the Tatoeba example sentences in two
# formats: one from Tatoeba and one from Jim Breen's website.

JMdict-headwords.json: data/JMdict_e
	node parse_jmdict.js

# Convert JMdict's XML file into a sparse data file that only has needed data.

wwwjdic-sentences.json wwwjdic-tags.json wwwjdic-good-tags.json: data/wwwjdic.csv
	node parse_wwwjdic_examples.js

# Do the same with the wwwjdic sentence example database. But convert
# pretty much all the data.

dummy: JMdict-headwords.json wwwjdic.sentences wwwjdic-tags.json wwwjdic-good-tags.json ordered-words.json
	node words_vs_headwords_jmdict.js

# Given the previous two, and our list of words, find what dictionary
# headwords are relevant to us, and then what sentences are relevant to
# each of those.

core5k.json:
	node routledge.js
