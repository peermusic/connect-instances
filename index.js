var debug = require('debug')('meta-swarm')
var events = require('events')
var inherits = require('inherits')
var Meta = require('meta-swarm')
var nacl = require('tweetnacl')
var swarm = require('secure-webrtc-swarm')

inherits(Connect, events.EventEmitter)
module.exports = Connect

function Connect (keyPair, peers, hubs, opts) {
  if (!(this instanceof Connect)) return new Connect(opts)
  if (!opts) opts = {}

  this.events = opts.events || []
  this.hubs = hubs || []
  this.issuedInvites = opts.issuedInvites || []
  this.keyPair = keyPair || nacl.box.keyPair()
  this.namespace = opts.namespace || 'peermusic'
  this.opts = opts.opts || {}
  this.receivedInvites = opts.receivedInvites || {}

  this._init()
}

Connect.prototype._init = function () {
  var events = ['connect', 'disconnect']
  Object.assign(this.opts, {events})
  this.swarm = new Meta(swarm, this.hubs, this.opts)
  if (!this.swarm.opts.issuedInvites) this.swarm.opts.issuedInvites = []
  if (!this.swarm.opts.receivedInvites) this.swarm.opts.receivedInvites = {}
}

Connect.prototype.issueInvite = function (hub) {
  if (!hub) throw new Error('hub needed')
  hub = hub.indexOf('://') === -1 ? 'http://' + hub : hub
  var signKeyPair = nacl.sign.keyPair()
  var signPrivKey = nacl.util.encodeBase64(signKeyPair.secretKey)
  var signPubKey = nacl.util.encodeBase64(signKeyPair.publicKey)
  // var myPubKey   = nacl.util.encodeBase64(o2a(keyPair.publicKey))
  var myPubKey = nacl.util.encodeBase64(signKeyPair.publicKey)

  if (this.hubs.indexOf(hub) === -1) {
    this.swarm.addHub(hub)
    this.hubs.push(hub)
  }
  this.swarm.opts.issuedInvites.push(signPubKey)
  this.issuedInvites.push(signPubKey)
  return [signPubKey, hub + '/#' + myPubKey + ':' + signPrivKey]
}

Connect.prototype.receiveInvite = function (uri) {
  function parseInvite (uri) {
    // format: http://host:port/#boxPubkey:signPrivKey
    var parts = uri.split('/#', 2)
    var hub = parts[0]
    parts = parts[1].split(':', 2)
    var pubKey = parts[0]
    var signPrivKey = parts[1]
    return [hub, pubKey, {[pubKey]: signPrivKey}]
  }
  var invite = parseInvite(uri)

  if (this.receivedInvites[invite[1]]) {
    debug('already received invite')
    return
  }
  this.receivedInvites = Object.assign(this.receivedInvites, invite[2])
  if (this.hubs.indexOf(invite[0]) === -1) {
    this.swarm.opts.receivedInvites = this.receivedInvites
    this.swarm.addHub(invite[0])
    this.hubs.push(invite[0])
  }
  return invite
}
