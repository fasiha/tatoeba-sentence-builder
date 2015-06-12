require 've'

# This takes an array of Ve::Word objects and produces a JSON string
def ve2json(words)
  JSON.pretty_generate(words.collect { |w| w.as_json(true) })
end

ARGF.each {|s|
  puts ve2json(Ve.in(:ja).words(s.gsub('&nbsp;', ' ').gsub(/<[^>]+>/, '').split("\t")[0].strip))
}
