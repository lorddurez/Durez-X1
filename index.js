const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion,
downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const Pino = require("pino");
const config = require("./config");

let autoTyping = false;
let antiDelete = false;
let autoReact = false;

async function startBot() {
const { state, saveCreds } = await useMultiFileAuthState("./session");
const { version } = await fetchLatestBaileysVersion();

const conn = makeWASocket({
logger: Pino({ level: "silent" }),
printQRInTerminal: true,
auth: state,
version
});

conn.ev.on("creds.update", saveCreds);

// AUTO VIEW STATUS
conn.ev.on("messages.upsert", async ({ messages }) => {
const m = messages[0];
if (!m.message) return;

if (autoTyping) {
await conn.sendPresenceUpdate("composing", m.key.remoteJid);
}

if (m.key.remoteJid === "status@broadcast") {
await conn.readMessages([m.key]);
}

if (autoReact && m.key.remoteJid.endsWith("@g.us")) {
await conn.sendMessage(m.key.remoteJid, {
react: { text: "🔥", key: m.key }
});
}

if (antiDelete && m.message?.protocolMessage?.type === 0) {
const msg = m.message.protocolMessage;
await conn.sendMessage(m.key.remoteJid, {
text: "⚠️ *Anti Delete Triggered*\nA message was deleted."
});
}

const body =
m.message.conversation ||
m.message.extendedTextMessage?.text ||
"";

if (!body.startsWith(config.prefix)) return;

const args = body.slice(1).trim().split(/ +/);
const command = args.shift().toLowerCase();
const sender = m.key.participant || m.key.remoteJid;
const isOwner = config.ownerNumber.some(v => sender.includes(v));

// ================= COMMANDS =================

switch (command) {

case "ping":
await conn.sendMessage(m.key.remoteJid, { text: "🏓 Pong!" });
break;

case "alive":
await conn.sendMessage(m.key.remoteJid, {
text: `✅ *${config.botName} is Alive*\nOwner: ${config.ownerName}\nSupport:\n${config.support}`
});
break;

case "owner":
await conn.sendMessage(m.key.remoteJid, {
text: `👑 Owner: ${config.ownerName}\n📞 +2348062641931`
});
break;

case "repo":
await conn.sendMessage(m.key.remoteJid, {
text: `📦 Repo & Support:\n${config.support}`
});
break;

case "autotyping":
if (!isOwner) return;
autoTyping = args[0] === "on";
await conn.sendMessage(m.key.remoteJid, { text: `✅ AutoTyping ${args[0]}` });
break;

case "antidelete":
if (!isOwner) return;
antiDelete = args[0] === "on";
await conn.sendMessage(m.key.remoteJid, { text: `✅ AntiDelete ${args[0]}` });
break;

case "autoreact":
if (!isOwner) return;
autoReact = args[0] === "on";
await conn.sendMessage(m.key.remoteJid, { text: `✅ AutoReact ${args[0]}` });
break;

case "block":
if (!isOwner) return;
await conn.updateBlockStatus(args[0] + "@s.whatsapp.net", "block");
await conn.sendMessage(m.key.remoteJid, { text: "✅ Blocked" });
break;

case "unblock":
if (!isOwner) return;
await conn.updateBlockStatus(args[0] + "@s.whatsapp.net", "unblock");
await conn.sendMessage(m.key.remoteJid, { text: "✅ Unblocked" });
break;

case "tagall":
if (!m.key.remoteJid.endsWith("@g.us")) return;
const metadata = await conn.groupMetadata(m.key.remoteJid);
const users = metadata.participants.map(v => v.id);
let text = "*📢 TAG ALL*\n\n";
users.forEach(u => text += `@${u.split("@")[0]}\n`);
await conn.sendMessage(m.key.remoteJid, { text, mentions: users });
break;

case "vv":
if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return;
let q = m.message.extendedTextMessage.contextInfo.quotedMessage;
let type = Object.keys(q)[0];
let stream = await downloadContentFromMessage(q[type], type.includes("video") ? "video" : "image");
let buffer = Buffer.from([]);
for await (let chunk of stream) buffer = Buffer.concat([buffer, chunk]);
await conn.sendMessage(sender, {
[type.includes("video") ? "video" : "image"]: buffer,
caption: "✅ View Once Saved"
});
break;

case "aza":
await conn.sendMessage(m.key.remoteJid, {
text: `╭──── ✧ ────╮
_PAYMENT_

✦ Name: ADURAMIGBA
✦ No: 8133287211
✦ Bank: OPAY

📩 Screenshot after payment
╰──── ✧ ────╯`
});
break;

}
});
}

startBot();
