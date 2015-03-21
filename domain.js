#!/usr/bin/env node

var argv = require('optimist').argv,
  async = require('async'),
  path = require('path'),
  fs = require('fs');

var config_file = path.join(process.env.HOME, '.ovh-domain.config');
var api_config = {};

function api() {
  var ovh = require('ovh')(api_config);
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
  console.error('Please specify a command.');
  console.error('List of available commands: ovh-domain help');
  process.exit(1);
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
    no_conf: true,
    run: function(params) {
      if (params.length > 0) {
        if (commands[params[0]]) {
          if (commands[params[0]].syntax) {
            console.log('Syntax:', commands[params[0]].syntax());
          }
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
    },
    args_min: 0,
  },
  configure: {
    no_conf: true,
    run: function(params) {
      var c = {
        endpoint: params[2] || 'ovh-eu',
        appKey: params[0],
        appSecret: params[1],
      };
      var ovh = require('ovh')(c);
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
        console.log('Please validate this consumer key on:', credential.validationUrl);
        c.consumerKey = credential.consumerKey;
        fs.writeFileSync(config_file, JSON.stringify(c));
      });
    },
    syntax: function() {
      return 'configure <application_key> <application_secret> [endpoint]';
    },
    help: function() {
      console.log('Configure ovh-domain by generating a consumer key.');
      console.log('Write a config file to $HOME/.ovh-domain.config');
      console.log('Default value for endpoint is ovh-eu');
    },
    args_min: 2,
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
    syntax: function() {
      return 'domains';
    },
    help: function() {
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
    syntax: function() {
      return 'show <zone_name>';
    },
    help: function() {
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
    syntax: function() {
      return 'create <zone_name> <record_name> <type> <target>';
    },
    help: function() {
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
    syntax: function() {
      return 'create <zone_name> <record_name> <target>';
    },
    help: function() {
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
    syntax: function() {
      return 'delete <zone_name> <record_name>';
    },
    help: function() {
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
  console.log('Syntax error:', commands[c].syntax());
  process.exit(1);
}

if (commands[c].no_conf === undefined) {
  if (fs.existsSync(config_file)) {
    api_config = JSON.parse(fs.readFileSync(config_file));
  }
  else {
    console.error('Please run ovh-domain configure');
    process.exit(1);
  }
}

if (argv.debug) {
  api_config.debug = true;
}

commands[c].run(argv._);
