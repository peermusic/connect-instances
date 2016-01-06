var Connect = require('./index.js')
// window.localStorage.debug = ''

var a = new Connect(null, null, ['localhost:7000'])
var b = new Connect(null, null, ['localhost:7001'])

var invite = a.issueInvite('localhost:7001')

b.receiveInvite(invite[1])

b.metaSwarm.on('data', function (data) {
  console.log('b: someone wrote me:', data)
})

a.metaSwarm.on('connect', function () {
  console.log('a: someone connected to me')
  setTimeout(function () {
    a.metaSwarm.send('hello I am a! Who are you?')
  }, 300)
})

window.a = a
window.b = b
