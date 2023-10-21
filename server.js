//Server for API call to Db2 database with IMDB data
//@author Andrew Laidlaw
//@version 1.0


// Import required packages
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const ibmdb = require('ibm_db');

// Set up the web server (based on Express.js)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Set the variables for the connection to Db2 instance
// These are pulled from environment variables
const DB_DATABASE = process.env.db_database || "imdb";
const DB_HOSTNAME = process.env.db_hostname || "localhost";
const DB_PORT = process.env.db_port || 50000;
const DB_UID = process.env.db_uid || "root";
const DB_PWD = process.env.db_pwd || "password";
const DB_SCHEMA = process.env.db_schema || "root";

// Setup the endpoint for the Db2 database we are connecting to
let connStr = "DATABASE=" + process.env.DB_DATABASE + ";HOSTNAME=" + process.env.DB_HOSTNAME + ";PORT=" + process.env.DB_PORT + ";PROTOCOL=TCPIP;UID=" + process.env.DB_UID + ";PWD=" + process.env.DB_PWD + ";";

// Simple JSON response for base service
app.get('/', function (request, response) {
  console.log('Request for /');
  response.json({ success: 1, message: 'service running' });
});

// Basic healthcheck endpoint
app.get('/healthz', function (request, response) {
  console.log('Healthcheck');
  response.send('ok');
});

// Test the connection to the Db2 database with a fixed query
// Allows troubleshooting of any connection errors
app.get('/testconnection', function (request, response) {
  console.log("Request to test connection");
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT A.PRIMARY_TITLE AS "title" \
                FROM DAVID.TITLES A, DAVID.PRINCIPALS B \
                WHERE A.TCONST = B.TCONST \
                and A.TITLE_TYPE LIKE' + "'%movie%' \
                and B.CHARACTERS LIKE '%James Bond%' \
                ORDER BY PRIMARY_TITLE LIMIT 1;",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          // return response.json(data);
          return response.json({ success: 1, message: 'Connection tested', data: data });
        });
      })
  })
});

// Get all the productions with the requested character
// Request should be of form <hostname>:8080/film/bycharacter/{character}
app.get('/film/bycharacter/:character', function (request, response) {
  console.log("Request for /film/bycharacter with character name " + request.params.character);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT A.PRIMARY_TITLE AS "title", C.PRIMARY_NAME AS "actor" \
                FROM DAVID.TITLES A, DAVID.PRINCIPALS B, DAVID.NAME C \
                WHERE A.TCONST = B.TCONST \
                and B.NCONST = C.NCONST \
                and A.TITLE_TYPE LIKE' + "'%movie%' \
                and B.CHARACTERS LIKE '%"+ request.params.character + "%';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          // return response.json(data);
          return response.json({ success: 1, message: 'Data Received', data: { films: data } });
        });
      })
  })
});

// Get all the productions with the requested actor
// Request should be of form <hostname>:8080/film/byactor/{actor name}
app.get('/film/byactor/:actor', function (request, response) {
  console.log("Request for /film/byactor with actor name " + request.params.actor);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT A.PRIMARY_TITLE as "title", B.CHARACTERS as "characters" \
                FROM DAVID.TITLES A, DAVID.PRINCIPALS B, DAVID.NAME C '+ "\
                WHERE A.TCONST = B.TCONST \
                and B.NCONST = C.NCONST \
                and A.TITLE_TYPE LIKE '%movie%' \
                and C.PRIMARY_NAME LIKE '%"+ request.params.actor + "%';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          // return response.json(data);
          return response.json({ success: 1, message: 'Data Received', data: unescapecharacters(data) });
        });
      })
  })
});

// Get character name of an actor in a film
// Request should be of form <hostname>:8080/character/{film name}/{actor}
app.get('/character/:film/:actor', function (request, response) {
  console.log("Request for /character for actor " + request.params.actor + " in film " + request.params.film);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT B.CHARACTERS as "characters" \
                FROM DAVID.NAME A, DAVID.PRINCIPALS B, DAVID.TITLES C '+ "\
                WHERE B.TCONST = C.TCONST \
                AND A.NCONST = B.NCONST \
                AND C.TITLE_TYPE='movie' \
                AND A.PRIMARY_NAME LIKE '%"+ request.params.actor + "%' \
                AND C.PRIMARY_TITLE LIKE '" + request.params.film + "';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          // return response.json(data);
          return response.json({ success: 1, message: 'Data Received', data: unescapesinglecharacters(data) });
        });
      })
  })
});

// Get actor who played a character in a film
// Request should be of form <hostname>:8080/actor/{film name}/{character}
app.get('/actor/:film/:character', function (request, response) {
  console.log("Request for /actor for character " + request.params.character + " in film " + request.params.film);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT A.PRIMARY_NAME as "actor" \
                FROM DAVID.NAME A, DAVID.PRINCIPALS B, DAVID.TITLES C '+ "\
                WHERE B.TCONST = C.TCONST \
                AND A.NCONST = B.NCONST \
                AND C.TITLE_TYPE='movie' \
                AND B.CHARACTERS LIKE '%"+ request.params.character + "%' \
                AND  C.PRIMARY_TITLE LIKE '" + request.params.film + "';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          // return response.json(data);
          return response.json({ success: 1, message: 'Data Received', data: data[0] });
        });
      })
  })
});

// Get principal actors in given film
// Request should be of form <hostname>:8080/actor/{film name}
app.get('/actor/:film', function (request, response) {
  console.log("Request for /actor for film called " + request.params.film);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT A.PRIMARY_NAME as "actor", B.CHARACTERS as "characters" \
                FROM DAVID.NAME A, DAVID.PRINCIPALS B, DAVID.TITLES C '+ "\
                WHERE B.TCONST = C.TCONST \
                AND A.NCONST = B.NCONST \
                AND C.TITLE_TYPE='movie' \
                AND B.CHARACTERS!=' ' \
                AND C.PRIMARY_TITLE LIKE '" + request.params.film + "';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          return response.json({ success: 1, message: 'Data Received', data: unescapeactors(data) });
        });
      })
  })
});

// Get career history for given actor
// Request should be of form <hostname>:8080/filmography/{actor}
app.get('/filmography/:actor', function (request, response) {
  console.log("Request for /filmography for actor called " + request.params.actor);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT C.PRIMARY_TITLE as "title", B.CHARACTERS as "characters", \
                C.TITLE_TYPE as "type", C.START_YEAR as "released", \
                D.AVERAGE_RATING as "rating", D.NUM_VOTES as "votes" \
                FROM DAVID.NAME A, DAVID.PRINCIPALS B, DAVID.TITLES C, DAVID.RATINGS D '+ "\
                WHERE B.TCONST = C.TCONST \
                AND B.TCONST = D.TCONST \
                AND A.NCONST = B.NCONST \
                AND C.TITLE_TYPE='movie' \
                AND B.CHARACTERS!=' ' \
                AND A.PRIMARY_NAME='"+ request.params.actor + "';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log("Response provided");
          return response.json({ success: 1, message: 'Data Received', data: unescapefilmography(data) });
        });
      })
  })
});

// Get full details about a specific film
// Request should be of form <hostname>:8080/film/details/<film>
app.get('/film/details/:film', function (request, response) {
  console.log("Request for /film/details for film: " + request.params.film);
  ibmdb.open(connStr, function (err, conn) {
    if (err) {
      console.log(err);
      return response.json({ success: -1, message: err });
    }
    conn.query('SELECT C.PRIMARY_TITLE as "title", \
                C.TITLE_TYPE as "type", C.START_YEAR as "released", \
                D.AVERAGE_RATING as "rating", D.NUM_VOTES as "votes" \
                FROM DAVID.TITLES C, DAVID.RATINGS D '+ "\
                WHERE C.TCONST = D.TCONST \
                AND C.TITLE_TYPE='movie' \
                AND C.PRIMARY_TITLE LIKE '" + request.params.film + "';",
      function (err, data) {
        if (err) {
          console.log(err);
          return response.json({ success: -2, message: err });
        }
        conn.close(function () {
          console.log(data);
          console.log("Response provided");
          return response.json({ success: 1, message: 'Data Received', data: data });
        });
      })
  })
});

// Various supporting functions to tidy up the output
// The raw output from the Db2 query is not exactly pretty

// Remove escape characters from array of films
function unescapecharacters(data) {
  output = {};
  output.films = [];
  data.forEach(element => {
    film = {};
    film.title = element.title;
    film.characters = [];
    chararray = JSON.parse(element.characters);
    if (chararray != null) {
      chararray.forEach(character => {
        film.characters.push(character);
      })
    }
    output.films.push(film);
  });
  return output;
};

// Remove escape characters from an array of characters
function unescapesinglecharacters(data) {
  output = {};
  if (data[0]) {
    chararray = JSON.parse(data[0].characters);
    output.characters = [];
    if (chararray != null) {
      chararray.forEach(character => {
        output.characters.push(character);
      })
    }
  }
  return output;
};

// Remove escape characters from an array of actors
function unescapeactors(data) {
  output = {};
  output.actors = [];
  data.forEach(element => {
    actor = {};
    actor.actor = element.actor;
    actor.characters = [];
    chararray = JSON.parse(element.characters);
    if (chararray != null) {
      chararray.forEach(character => {
        actor.characters.push(character);
      })
    }
    output.actors.push(actor);
  });
  return output;
};

// Remove escape characters from an array of films
function unescapefilmography(data) {
  output = {};
  output.films = [];
  data.forEach(element => {
    film = {};
    film.title = element.title;
    film.characters = [];
    film.type = element.type;
    film.released = element.released;
    film.rating = element.rating;
    film.votes = element.votes;
    chararray = JSON.parse(element.characters);
    if (chararray != null) {
      chararray.forEach(character => {
        film.characters.push(character);
      })
    }
    output.films.push(film);
  });
  return output;
};

// Start the server listening for clients
app.listen(8080, function () {
  console.log("Server is listening on port 8080");
  console.log('Connection string is: ' + connStr)
});