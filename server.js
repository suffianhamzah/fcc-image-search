// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();

// 3rd party requirements
var got = require('got');
var qs = require('query-string');
var moment = require('moment');

// DB initialization
var MongoClient = require('mongodb').MongoClient;

const dbUrl = `mongodb://asamlaksa:${process.env.MLAB_PASS}@ds247587.mlab.com:47587/fcc`;

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

var db
MongoClient.connect(dbUrl, (err, database) => {
  if (err) return console.log(err);
  db = database.db('fcc');
  var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
  });
});

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});


// request to get based on serach queries
app.get('/imagesearch/:search_term', (request, response) => {
  const offset = request.query.offset || 10;
  const pages = offset > 100 ? 100 : offset;
  
  //mongodb stuff aka. safe the search term
  const searchTerms = db.collection('search_terms');
  
  //insert one function
  const insertSearchTerm = (searchData) => {
    searchTerms.insertOne({
      'search_term': searchData,
      'when': moment().utc().format()
    }).then( (id) => {
      console.log('added ' + id + 'to db!');
    }).catch( error => {
      console.log(error);
    });
  };
  
  let query_strings = {
    q: request.params.search_term,
    cx: '003990609051204295574:w2f0iuplb_c',
    searchType: 'image',
    key: process.env.G_SEARCH
  }
  
  const query_image = (order) => {
      const g_search_url = 'https://www.googleapis.com/customsearch/v1/';
      const options = {
        query: qs.stringify(query_strings),
        json: true,
        start: order
      };
      return got(g_search_url, options).then ( results => {
        var items = results.body.items || [];
        const final_results = items.map( (item) => {
          return {
            url: item.link,
            snippet: item.snippet,
            thumbnail: item.image.thumbnailLink,
            context: item.image.contextLink, 
          }
        });
        return final_results;
      });
  };
  var searches = [];

  for (var off=1; off <= pages;off += 10) {
    searches.push(query_image(off));
  };
  
  Promise.all(searches)
    .then( data => {
      console.log(data);
      // handle all data [
      let searchResult = data.reduce( (a, b) => {
        return a.concat(b);
      });
      return searchResult.slice(0, pages);
  }).then( results => {
    insertSearchTerm(request.params.search_term);
    response.json(results);    
  }).catch( error => {
    console.log(error);
    response.json(error);
  });  
});

// GET 10 most recent search terms
app.get("/latest/imagesearch", (request, response) => {
  const searchTerms = db.collection('search_terms');
  var options = {
    limit: 10,
    sort: {$natural:-1}
  }
  searchTerms.find({}, options).toArray().then ( data => {
    let result = data || [];
    response.json(result);
  }).catch( error => {
    response.json(error);
  });
});

