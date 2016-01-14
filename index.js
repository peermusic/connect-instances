var debug = require('debug')('meta-swarm')
var events = require('events')
var inherits = require('inherits')
var Meta = require('meta-swarm')
var nacl = require('tweetnacl')
var swarm = require('secure-webrtc-swarm')

inherits(Connect, events.EventEmitter)
module.exports = Connect

function Connect (keyPair, whitelist, hubs, opts) {
  if (!(this instanceof Connect)) return new Connect(opts)
  if (!opts) opts = {}

  this.hubs = hubs || []
  if (!keyPair) {
    keyPair = nacl.box.keyPair()
    keyPair = {
      secretKey: nacl.util.encodeBase64(keyPair.secretKey),
      publicKey: nacl.util.encodeBase64(keyPair.publicKey)
    }
  }
  this.keyPair = keyPair
  this.issuedInvites = opts.issuedInvites || []
  this.receivedInvites = opts.receivedInvites || {}

  this.opts = opts.opts || {}
  this.opts.keyPair = this.keyPair
  this.opts.namespace = opts.namespace || 'peermusic'
  this.opts.whitelist = whitelist || []

  this._init()
}

Connect.prototype._init = function () {
  var events = ['connect', 'disconnect']
  Object.assign(this.opts, {events})

  this.metaSwarm = new Meta(swarm, this.hubs, this.opts)

  if (!this.metaSwarm.opts.issuedInvites) {
    this.metaSwarm.opts.issuedInvites = []
  }
  if (!this.metaSwarm.opts.receivedInvites) {
    this.metaSwarm.opts.receivedInvites = {}
  }
}

Connect.prototype.issueInvite = function (hub) {
  if (!hub) throw new Error('hub needed')

  var signKeyPair = nacl.sign.keyPair()
  var signPrivKey = nacl.util.encodeBase64(signKeyPair.secretKey)
  var signPubKey = nacl.util.encodeBase64(signKeyPair.publicKey)
  // var myPubKey   = nacl.util.encodeBase64(o2a(keyPair.publicKey))
  var myPubKey = this.keyPair.publicKey

  if (this.hubs.indexOf(hub) === -1) {
    this.metaSwarm.addHub(hub)
    this.hubs.push(hub)
  }

  this.issuedInvites.push(signPubKey)
  this.metaSwarm.swarms[hub].issuedInvites.push(signPubKey)

  return [signPubKey,
    'web+peermusic://INVITE#' + hub + '#' + myPubKey + '#' + signPrivKey]
}

Connect.prototype.receiveInvite = function (uri) {
  function parseInvite (uri) {
    // format: web+peermusic://INVITE#host:port#boxPubkey#signPrivKey
    var parts = uri.split('#')
    var hub = parts[1]
    var pubKey = parts[2]
    var signPrivKey = parts[3]

    return [hub, pubKey, {[pubKey]: signPrivKey}]
  }

  var invite = parseInvite(uri)

  if (this.hubs.indexOf(invite[0]) === -1) {
    debug('skipping already known hub')
    this.metaSwarm.addHub(invite[0])
    this.hubs.push(invite[0])
  }
  if (this.receivedInvites[invite[1]]) {
    debug('we already received an invite from that peer but continue')
  }

  debug('adding new invite', invite[2])
  this.receivedInvites = Object.assign(this.receivedInvites, invite[2])
  this.metaSwarm.swarms[invite[0]].receivedInvites = this.receivedInvites

  return invite
}
