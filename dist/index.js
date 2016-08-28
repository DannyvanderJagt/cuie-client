'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ws = require('ws');

var _ws2 = _interopRequireDefault(_ws);

var _client = require('./client');

var _client2 = _interopRequireDefault(_client);

var _service = require('./service');

var _service2 = _interopRequireDefault(_service);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

var WebSocket = _ws2.default;

function Cuie() {
  this.host = 'localhost';
  this.port = 2002;

  this.key;
  this.ws;
  this.callbacks = {};
  this.events = {};

  this.warningIsEnabled = true;

  // Reconnect...
  this.attempToReconnect = false;
  this.reconnectTimeout;

  return this;
}

Cuie.prototype.warn = function (msg) {
  if (!this.warningIsEnabled) {
    return this;
  }
  console.log('Cuie - ' + msg);
  return this;
};

Cuie.prototype.on = function (event, cb) {
  if (typeof event !== 'string') {
    this.warn('The event for \'Cuie.on\' must be a string.');
    return this;
  }
  if (typeof cb !== 'function') {
    this.warn('The callback for \'Cuie.on\' must be a function.');
    return this;
  }

  if (!this.events[event]) {
    this.events[event] = [];
  }

  this.events[event].push(cb);
  return this;
};

Cuie.prototype.emitAndWarn = function (event, data) {
  this.warn(data);
  return this.emit(event, data);
};

Cuie.prototype.emit = function (event, data) {
  if (!this.events[event]) {
    return this;
  }

  var i = 0,
      length = this.events.length;
  for (i; i < length; i++) {
    this.events[i].apply(null, data);
  }
  return this;
};

Cuie.prototype.setOptions = function (opts) {
  if (!opts) {
    opts = {};
  }

  if (typeof opts == 'string') {
    opts = { key: opts };
  }

  if (!(typeof opts === 'undefined' ? 'undefined' : _typeof(opts)) == 'object') {
    this.emitAndWarn('error', 'Options should be a string or an object');
    return this;
  }

  this.host = opts.host || this.host;
  this.port = opts.port || this.port;
  this.key = opts.key || this.key;
  this.warningIsEnabled = opts.warn !== undefined ? opts.warn : true;

  return this;
};

Cuie.prototype.connect = function (options) {
  this.setOptions(options);

  if (this.ws) {
    this.emitAndWarn('connection_error', 'Already connected');
    return this;
  }

  var url = ['ws://', this.host, ':', this.port, '/', this.key].join('');

  this.ws = new WebSocket(url);

  this.ws.onopen = this._connectionDidOpen.bind(this);
  this.ws.onclose = this._connectionDidClose.bind(this);
  this.ws.onerror = this._connectionDidError.bind(this);
  this.ws.onmessage = this._connectionDidSignal.bind(this);

  return this;
};

Cuie.prototype.disconnect = function () {
  if (!this.ws) {
    this.emitAndWarn('connection_error', 'Can not disconnect when there is no active connection.');
    return;
  }

  if (this.ws.cancelConnectionImpl) {
    this.ws.cancelConnectionImpl();
  }

  delete this.ws;
  return this;
};

Cuie.prototype._reconnect = function () {
  this.reconnectTimeout = setTimeout((function () {
    this.connect();
  }).bind(this), 1000);
  return this;
};

Cuie.prototype._connectionDidOpen = function () {
  this.emit('connect');
  return this;
};

Cuie.prototype._connectionDidClose = function () {
  if (!this.reconnectTimeout) {
    this.emit('disconnect');
  }

  delete this.ws;
  this.ws = undefined;
  this._reconnect();

  return this;
};

Cuie.prototype._connectionDidError = function (error) {
  this.emitAndWarn('connection_error', error.code);
  return this;
};

Cuie.prototype._connectionDidSignal = function (signal) {
  try {
    signal = JSON.parse(signal.data);
  } catch (error) {
    this.emitAndWarn('error', 'Could not parse incomming data.');
    return this;
  }

  var id = signal.id,
      event = signal.e,
      data = signal.d,
      close = signal.c;

  try {
    data = JSON.parse(data);
  } catch (error) {
    this.emitAndWarn('error', 'Could not parse data attribute without the incomming data packet.');
    return this;
  }

  if (this.callbacks[id] && this.callbacks[id][event]) {
    this.callbacks[id][event](data);
  }

  if (this.callbacks[id] && close) {
    delete this.callbacks[id];
  }

  return this;
};

Cuie.prototype._send = function (signal, callbacks) {
  if (!signal) {
    signal = {};
  }

  var id = Uid();
  signal.id = id;

  if (callbacks) {
    this.callbacks[id] = callbacks;
  }

  try {
    signal = JSON.stringify(signal);
  } catch (error) {
    this.emitAndWarn('error', 'Could not stringify the signal. Signal should be an object.');
    return this;
  }

  if (!this.ws) {
    this.emitAndWarn('error', 'Could not send data due to no live connection');
    return this;
  }

  this.ws.send(signal);
};

/*
  Public api
 */
Cuie.prototype.client = function (key) {
  return new _client2.default(this, key);
};

Cuie.prototype.service = function (key) {
  return new _service2.default(this, key);
};

exports.default = new Cuie();