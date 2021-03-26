__path = process.cwd()

const fs = require('fs')
const util = require('util')
const path = require('path')
const FileType = require('file-type')
const { spawn, exec } = require('child_process')
const { MessageType, GroupSettingChange } = require('@adiwajshing/baileys')

const needle = require('needle')

const moment = require("moment-timezone")
const time = moment().tz('Asia/Jakarta').format("HH:mm:ss")

exports.WAConnection = (_WAConnection) => {
    class WAConnection extends _WAConnection {
        constructor(...args) {
            super(...args)

            if (!Array.isArray(this._events['CB:action,add:relay,message'])) this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message']]
            else this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message'].pop()]

            this._events['CB:action,add:relay,message'].unshift(async function (json) {
                try {
                    let m = json[2][0][2]
                    if (m.message && m.message.protocolMessage && m.message.protocolMessage.type == 0) {
                        let key = m.message.protocolMessage.key
                        let c = this.chats.get(key.remoteJid)
                        let a = c.messages.dict[`${key.id}|${key.fromMe ? 1 : 0}`]
                        let participant = key.fromMe ? this.user.jid : a.participant ? a.participant : key.remoteJid
                        let WAMSG = a.constructor
                        this.emit('message-delete', { key, participant, message: WAMSG.fromObject(WAMSG.toObject(a)) })
                    }
                } catch (e) {}
            })
        }

       async copyNForward(jid, message, idk = false, options = {}) {
            let mtype   = Object.keys(message.message)[0]
            let content = await this.generateForwardMessageContent(message, idk)
            let ctype   = Object.keys(content)[0]
            let context = {}
            if (mtype != MessageType.text) context = message.message[mtype].contextInfo
            content[ctype].contextInfo = {
                ...context,
                ...content[ctype].contextInfo
            }
            const waMessage = await this.prepareMessageFromContent(jid, content, options)
            await this.relayWAMessage(waMessage)
            return waMessage
        }

       async downloadM(m) {
            if (!m) return Buffer.alloc(0)
            if (!m.message) m.message = { m }
            if (!m.message[Object.keys(m.message)[0]].url) await this.updateMediaMessage(m)
            return await this.downloadMediaMessage(m)
        }

        reply(from, text, q) {
            this.sendMessage(from, text, MessageType.text, { quoted: q })
        }

        sendText(from, text) {
            this.sendMessage(from, text, MessageType.text)
        }

        getName(jid)  {
            let v = jid === this.user.jid ? this.user : this.contacts[jid] || { notify: jid.replace(/@.+/, '') }
            return v.name || v.vname || v.notify || '~'
        }
    }
    return WAConnection
}


exports.smsg = async (conn, m, hasParent) => {
    if (!m) return m

    if (m.key) {
        m.id = m.key.id
        m.isBaileys = m.id.startsWith('3EB0') && m.id.length === 12
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.sender = m.fromMe ? conn.user.jid : m.participant ? m.participant : m.key.participant ? m.key.participant : m.chat
        m.isGroup = m.chat.endsWith('@g.us')
        m.isOwner = m.sender === '6282299265151@s.whatsapp.net' ?? false
    }

    if (m.message) {
        m.mtype = Object.keys(m.message)[0]
        m.msg = m.message[m.mtype]
        if (m.mtype === 'ephemeralMessage') {
            exports.smsg(conn, m.msg)
            m.mtype = m.msg.mtype
            m.msg = m.msg.msg
        }
        m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
        m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
        if (m.quoted) {
            let type = Object.keys(m.quoted)[0]
            m.quoted = m.quoted[type]
            if (typeof m.quoted == 'string') m.quoted = { text: m.quoted }
            m.quoted.mtype = type
            m.quoted.id = m.msg.contextInfo.stanzaId
            m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('3EB0') && m.quoted.id.length === 12 : false
            m.quoted.sender = m.msg.contextInfo.participant
            m.quoted.fromMe = m.quoted.sender == conn.user.jid
            m.quoted.text = m.quoted.text || m.quoted.caption || ''
            m.getQuotedObj = async () => {
               let q
               await conn.findMessage(m.chat, 25, s => {
                   q = s
                   return s.key ? m.quoted.id.includes(s.key.id) : false
               })
               return q ? exports.smsg(conn, q) : false
            }
            if (m.quoted.url) m.quoted.download = conn.downloadM({
                message: {
                    [m.quoted.mtype]: m.quoted
                }
            })
        }
        if (m.msg.url) m.download = conn.downloadM(m)
        m.text = m.msg.text || m.msg.caption || m.msg || ''
        m.reply = (text, chatId, options) => conn.reply(chatId ? chatId : m.chat, text, m,  options)
    }
}
