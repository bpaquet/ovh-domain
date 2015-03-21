#!/usr/bin/env node

var argv = require('optimist').argv;
var async = require('async');

var syntax = 'Unable to parse commande line !\nSyntax: ovh-domain command args\nExample: ovh-domain help';

function syntax_error() {
  console.error(syntax);
  process.exit(1);
}

function api() {
  if (process.env.APP_KEY === undefined || process.env.APP_SECRET === undefined || process.env.CONSUMER_KEY === undefined) {
    console.error('Please set env vars APP_KEY APP_SECRET CONSUMER_KEY');
    process.exit(1);
  }
  var ovh = require('ovh')({
    endpoint: process.env.ENDPOINT || 'ovh-eu',
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    consumerKey: process.env.CONSUMER_KEY,
    debug: argv.debug,
  });
  return function(method, url, body, callback) {
    if (!callback) {
      callback = body;
      body = undefined;
    }
    ovh.request(method, url, body, function(err, result) {
      if (err) {
        console.error('API Call error', url, err, body ? JSON.stringify(body) : '');
        process.exit(1);
      }
      callback(result);
    });
  };
}

if (argv._.length === 0) {
  syntax_error();
}

function fill(s, k) {
  if (s.length === k) {
    return s;
  }
  return fill(s + ' ', k);
}

function read_zone(name, callback) {
  var a = api();
  a('GET', '/domain/zone/' + name + '/record', function (records) {
    var res = {};
    async.eachSeries(records, function(id, callback) {
      a('GET', '/domain/zone/' + name + '/record/' + id, function(r) {
        res[id] = r;
        callback();
      });
    }, function() {
      callback(res);
    });
  });
}

var commands = {
  help: {
    run: function(params) {
      if (params.length > 0) {
        if (commands[params[0]]) {
          commands[params[0]].help();
        }
        else {
          console.error('Unknown command', params[0]);
          process.exit(1);
        }
      }
      else {
        console.log('List of available commands');
        Object.keys(commands).sort().forEach(function(s) {
          console.log(s);
        });
        process.exit(0);
      }
    },
    help: function() {
      console.log('This help page :)');
      process.exit(0);
    },
    args_min: 0,
  },
  consumer_key: {
    run: function() {
      var ovh = require('ovh')({
        endpoint: process.env.ENDPOINT || 'ovh-eu',
        appKey: process.env.APP_KEY,
        appSecret: process.env.APP_SECRET,
      });
      ovh.request('POST', '/auth/credential', {
        'accessRules': [
          { 'method': 'GET', 'path': '/*'},
          { 'method': 'POST', 'path': '/*'},
          { 'method': 'PUT', 'path': '/*'},
          { 'method': 'DELETE', 'path': '/*'}
        ]
      }, function (err, credential) {
        if (err) {
          console.error('Unable to create consumer key');
          console.log(err);
          process.exit(1);
        }
        console.log('Consumer key:', credential.consumerKey);
        console.log('Please validate this key on:', credential.validationUrl);
      });
    },
    help: function() {
      console.log('Syntax: ovh-domain consumer-key');
      console.log('Generate a consumer key');
    }
  },
  zones: {
    run: function() {
      api()('GET', '/domain/zone', function (zones) {
        console.log('Number of zones', zones.length);
        zones.forEach(function(z) {
          console.log(z);
        });
      });
    },
    help: function() {
      console.log('Syntax: ovh-domain domains');
      console.log('List available domains');
    }
  },
  show: {
    run: function(params) {
      read_zone(params[0], function(z) {
        var l = Object.keys(z).map(function(k) {return z[k];}).sort(function(item1, item2) {
          if ( item1.fieldType < item2.fieldType) {
            return -1;
          }
          if ( item1.fieldType > item2.fieldType ) {
            return 1;
          }
          if ( item1.subDomain < item2.subDomain) {
            return -1;
          }
          if ( item1.subDomain > item2.subDomain) {
            return 1;
          }
          return 0;
        });
        console.log('Number of records', l.length);
        l.forEach(function(x) {
          console.log(fill(x.fieldType, 6), fill(x.subDomain, 20), x.target);
        });
      });
    },
    help: function() {
      console.log('Syntax: ovh-domain show <zone_name>');
      console.log('List all records in a zone');
    },
    args_min : 1,
  },
  create: {
    run: function(params) {
      if (params[2] === 'CNAME' && !params[3].toString().match(/\.$/)) {
        console.error('Wrong CNAME value, must end with .', params[2]);
        process.exit(1);
      }
      api()('GET', '/domain/zone/' + params[0] + '/record?subDomain=' + params[1], function (r) {
        if (r.length === 1) {
          console.error('Record already exists in zone', params[0], params[1]);
          process.exit(1);
        }
        api()('POST', '/domain/zone/' + params[0] + '/record', {
          fieldType: params[2],
          target: params[3],
          subDomain: params[1],
        }, function() {
          console.log('OK, created record', params[1], params[2], params[3]);
        });
      });
    },
    help: function() {
      console.log('Syntax: ovh-domain create <zone_name> <record_name> <type> <target>');
      console.log('Create a new record in a given zone.');
    },
    args_min : 4,
  },
  update: {
    run: function(params) {
      api()('GET', '/domain/zone/' + params[0] + '/record?subDomain=' + params[1], function (r) {
        if (r.length !== 1) {
          console.error('Record not found in zone', params[0], params[1]);
          process.exit(1);
        }
        api()('GET', '/domain/zone/' + params[0] + '/record/' + r[0], function (rec) {
          if (rec.fieldType === 'CNAME' && !params[2].toString().match(/\.$/)) {
            console.error('Wrong CNAME value, must end with .', params[2]);
            process.exit(1);
          }
          console.log(rec);
          api()('PUT', '/domain/zone/' + params[0] + '/record/' + r[0], {
            target: params[2],
          }, function() {
            console.log('OK, updated record', params[1], rec.fieldType, params[2]);
          });
        });
      });
    },
    help: function() {
      console.log('Syntax: ovh-domain create <zone_name> <record_name> <target>');
      console.log('Update a record in a given zone.');
    },
    args_min : 3,
  },
  delete: {
    run: function(params) {
      api()('GET', '/domain/zone/' + params[0] + '/record?subDomain=' + params[1], function (r) {
        if (r.length !== 1) {
          console.error('Record not found in zone', params[0], params[1]);
          process.exit(1);
        }
        api()('DELETE', '/domain/zone/' + params[0] + '/record/' + r[0], function() {
          console.log('OK, deleted record', params[1]);
        });
      });
    },
    help: function() {
      console.log('Syntax: ovh-domain delete <zone_name> <record_name>');
      console.log('Delete a record in a given zone.');
    },
    args_min : 2,
  }
};

var c = argv._.shift();
if (!commands[c]) {
  console.log('Unknown command', c);
  process.exit(1);
}

if (commands[c].args_min && argv._.length < commands[c].args_min) {
  console.error('Unable to parse commande line !');
  commands[c].help();
  process.exit(1);
}

commands[c].run(argv._);
