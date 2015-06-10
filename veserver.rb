require 'sinatra'
require 'sinatra/cross_origin'
require 've'

# This takes an array of Ve::Word objects and produces a JSON string
def ve2json(words)
  (words.collect { |w| w.as_json(true) }).to_json
end

set :port, 5331
get '/:input' do
  content_type :json
  cross_origin
  ve2json(Ve.in(:ja).words(params['input'].strip))
end

