/** bot ciduk wa
 * author: ibnusyawall 
 * lib simple from: nurutomo
 * don't change this credit! 
 */

var qrcode = require("qrcode-terminal"),
    moment = require('moment-timezone')

var fs = require("fs"),
     _ = require('lodash')

var simple = require('./lib/simple')

let {
   WAConnection: _WAConnection,
   MessageType,
   Presence,
   MessageOptions,
   Mimetype,
   WALocationMessage,
   WA_MESSAGE_STUB_TYPES,
   ReconnectMode,
   ProxyAgent,
   ChatModification,
   waChatKey,
   WA_DEFAULT_EPHEMERAL
} = require("@adiwajshing/baileys")

var { exec } = require("child_process")

var WAConnection = simple.WAConnection(_WAConnection)
var client = new WAConnection()

const start = async bot => {
    bot.logger.level = 'warn'

    bot.on('qr', qr => {
        qrcode.generate(qr, { small: true })
        console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] Scan kode qr dengan whatsapp!`)
    })

    bot.on('credentials-updated', () => {
        const authInfo = bot.base64EncodedAuthInfo()
        console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] credentials updated!`)

        fs.writeFileSync('./auth_info.json', JSON.stringify(authInfo, null, '\t'))
    })

    fs.existsSync('./auth_info.json') && bot.loadAuthInfo('./auth_info.json')

    bot.on("open", async () => {
        console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] Bot Is Online Now!!`)
    })

    bot.on("connecting", async function () {
        console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] Connecting`)
    })

    bot.on("ws-close", async function (cls) {
        console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] Bot closed...\nReason: ${cls.reason}`)
    })

    bot.connect()

    var timerandom = moment().tz('Asia/Jakarta').format('DDMMYYYYHHmmss')

    bot.hapus = bot.hapus ? bot.hapus : []

    bot.botHapus = async function (m) {
        bot.hapus.push({
            id: m.participant,
            time: moment().tz('Asia/Jakarta'),
            m
        })
    }

    bot.on('message-delete', bot.botHapus)

    // console.log(bot.hapus)
    bot.on('chat-update', async m => {
        try {
            if (!m.hasNewMessage) return;
            m = JSON.parse(JSON.stringify(m)).messages[0]

            if (!m) return

            simple.smsg(client, m)

            prefix = '/'
            const id = m.isGroup ? m.participant : m.key.remoteJid

            const { text, extendedText, contact, location, liveLocation, image, video, sticker, document, audio, product } = MessageType

            const argv = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()

            if (!m.key.fromMe) return  // self mode, remove logical not for change to non self modes

            bot.group = bot.group ? bot.group : {}


//            let target = "6288292156203-1598105837@g.us"
//            bot.modifyChat(target, ChatModification.delete).then(c => console.log(c)).catch(e => console.log(e))

            var filtered = []
            bot.hapus.filter(v => v.id === m.chat).map(( { id } ) => filtered.push(id))
            if ((m.quoted) && (filtered.indexOf(m.chat) >= 0)) {
                if (!m.quoted) return
                if (!/^pesan yang di hapus/i.test(m.quoted.text)) return

                var data = bot.hapus.filter(v => v.id === m.chat)
                var array = []

                if (m.text - 1  > data.length - 1) return
                var result = data[m.text - 1].m

                bot.copyNForward(m.chat, result.message, true)
            }

            console.log(filtered.indexOf(m.chat) >= 0)
            switch (argv) {
                case 'ciduk':
                    console.log(bot.hapus)
                    break
                case 'list':
                    var list = bot.hapus.filter(v => v.id === m.chat)

                    var temp = `pesan yang di hapus: *${bot.getName(id)}* | ${list.length}. chat\n\n`
                    var index = 1

                    list.map(({ id, time }) => temp += `*${index++}*. ${moment(time).format('DD-MM-YYYY HH:mm:ss')}\n`)

                    bot.sendText(m.chat, temp)
                    break
                default:
                    break
            }

            if (m.mtype === 'conversation' || m.mtype === 'extendedTextMessage') {
                console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] ${m.sender.split(/@/)[0]}: ${m.text}`)
            } else {
                console.log(`[ ${moment.tz('Asia/Jakarta').format('HH:mm:ss') } ] ${m.sender.split(/@/)[0]}: <media message>`)
            }

        } catch (e) { console.log(e) }
    })
}

( async () => await start(client) )()
