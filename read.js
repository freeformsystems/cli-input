var readline = require('readline')
var Mute = require('mute-stream')
  , rl
  , rlopts
  , history;

var errors = {
  cancel: new Error('cancelled'),
  timeout: new Error('timed out')
}

errors.cancel.cancel = true;
errors.timeout.timeout = true;

function open(opts) {
  //console.log('opening rl interface');
  close();
  opts = opts || {};
  opts.input = opts.input || process.stdin
  opts.output = opts.output || process.stdout
  opts.terminal = !!(opts.terminal || opts.output.isTTY)
  rl = readline.createInterface(opts)
  rl.history = history ? history : [];
  //if(history) {
    //rl.history = history;
  //}
  rlopts = opts;
  return rl;
}

function close() {
  if(rl) {
    rl.removeAllListeners();
    rl.close();
    rl = null;
  }
}

function read (opts, cb) {
  var input = opts.input || process.stdin
  var output = opts.output || process.stdout
  opts.rl = opts.rl || {};
  var prompt = (opts.prompt || '');
  var silent = opts.silent
  var editDef = false
  var timeout = opts.timeout
    , rlopts
    , m;

  var def = '' + opts.default || '';
  if (def && opts.edit) {
    editDef = true;
  }

  var terminal = !!(opts.terminal || output.isTTY)
  var mrl;

  if(!rl) {
    open(opts.rl);
  }

  if(silent) {
    m = new Mute({ replace: opts.replace, prompt: prompt })
    m.pipe(output, {end: false})
    output = m;
    history = rl.history;
    rl.close();
    mrl = readline.createInterface(
      {input: input, output: output, terminal: terminal});
    rl = mrl;
  }

  rl.setPrompt(prompt, opts.length || prompt.length);
  rl.prompt();

  if(silent) {
    output.mute()
  }else if(editDef) {
    rl.line = def
    rl.cursor = def.length
    rl._refreshLine()
  }

  var timer;

  // TODO: work out the line listener leak (infinite mode)
  // TODO: this should not be necessary
  rl.removeAllListeners('line');
  rl.removeAllListeners('error');

  rl.on('line', onLine);
  rl.on('error', onError);

  rl.on('SIGINT', function () {
    rl.close()
    onError(errors.cancel);
  })

  if(timeout) {
    timer = setTimeout(function () {
      onError(errors.timeout)
    }, timeout)
  }

  function done (err, line) {
    rl.removeListener('line', onLine);
    rl.removeListener('error', onError);
    rl.removeAllListeners('SIGINT');

    //console.log('read done() callback %s', rl.listeners('line').length);
    //

    clearTimeout(timer);
    if(silent) {
      mrl.close();
      rl.resume();
      opts.rl.output = process.stdout;
      output.unmute()
      output.end()
      close();
    }

    // get *undefined* string from mute stream on no input
    if(line == "undefined") line = '';

    if(err) return cb(err, null, null, rl);
    cb(null, line, rl)
  }

  function onError (err) {
    done(err);
  }

  function onLine (line) {
    if(silent) {
      //output.unmute()
      //output.write('\r\n')
    }

    // truncate the \n at the end.
    line = line.replace(/\r?\n$/, '')
    //var isDefault = !!(editDef && line === def)
    //if (def && !line) {
      //isDefault = true
      //line = def
    //}

    done(null, line);
  }
}

read.open = open;
read.errors = errors;
read.rl = rl;

module.exports = read
