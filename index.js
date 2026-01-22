const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const Pino = require("pino");
const readline = require("readline");
const config = require("./config");

let autoTyping = false;
let antiDelete = false;
let autoReact = false;

// input for pairing code
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: Pino({ level: "silent" }),
    auth: state,
    version
  });

  conn.ev.on("creds.update", saveCreds);

  // 🔐 PAIRING CODE LOGIN
  if (!state.creds.registered) {
    rl.question("📞 Enter your WhatsApp number (234XXXXXXXXXX): ", async (number) => {
      number = number.replace(/[^0-9]/g, "");
      const code = await conn.requestPairingCode(number);
      console.log(`\n🔢 PAIRING CODE: ${code}\n`);
      console.log("📲 Go to WhatsApp > Linked Devices > Link with phone number\n");
      rl.close();
    });
  }

  // ================= MESSAGE HANDLER =================
  conn.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;
    const isGroup = chat.endsWith("@g.us");

    // AUTO VIEW STATUS
    if (chat === "status@broadcast") {
      await conn.readMessages([m.key]);
      return;
    }

    // AUTO TYPING
    if (autoTyping) {
      await conn.sendPresenceUpdate("composing", chat);
    }

    // AUTO REACT
    if (autoReact && isGroup) {
      await conn.sendMessage(chat, {
        react: { text: "🔥", key: m.key }
      });
    }

    // ANTI DELETE
    if (antiDelete && m.message?.protocolMessage?.type === 0) {
      await conn.sendMessage(chat, {
        text: "⚠️ *Anti Delete*\nA message was deleted."
      });
    }

    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      "";

    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isOwner = config.ownerNumber.some(v => sender.includes(v));

    // ================= COMMANDS =================

    switch (command) {

      case "ping":
        await conn.sendMessage(chat, { text: "🏓 Pong!" });
        break;

      case "alive":
        await conn.sendMessage(chat, {
          text: `✅ *${config.botName} is Alive*\n👑 Owner: ${config.ownerName}\n🔗 Support:\n${config.support}`
        });
        break;

      case "owner":
        await conn.sendMessage(chat, {
          text: `👑 Owner: ${config.ownerName}\n📞 +2348062641931`
        });
        break;

      case "repo":
        await conn.sendMessage(chat, {
          text: `📦 Repo & Support:\n${config.support}`
        });
        break;

      case "autotyping":
        if (!isOwner) return;
        autoTyping = args[0] === "on";
        await conn.sendMessage(chat, { text: `✅ AutoTyping ${args[0]}` });
        break;

      case "antidelete":
        if (!isOwner) return;
        antiDelete = args[0] === "on";
        await conn.sendMessage(chat, { text: `✅ AntiDelete ${args[0]}` });
        break;

      case "autoreact":
        if (!isOwner) return;
        autoReact = args[0] === "on";
        await conn.sendMessage(chat, { text: `✅ AutoReact ${args[0]}` });
        break;

      case "block":
        if (!isOwner) return;
        await conn.updateBlockStatus(args[0] + "@s.whatsapp.net", "block");
        await conn.sendMessage(chat, { text: "✅ Blocked" });
        break;

      case "unblock":
        if (!isOwner) return;
        await conn.updateBlockStatus(args[0] + "@s.whatsapp.net", "unblock");
        await conn.sendMessage(chat, { text: "✅ Unblocked" });
        break;

      case "tagall":
        if (!isGroup) return;
        const meta = await conn.groupMetadata(chat);
        const users = meta.participants.map(v => v.id);
        let txt = "*📢 TAG ALL*\n\n";
        users.forEach(u => txt += `@${u.split("@")[0]}\n`);
        await conn.sendMessage(chat, { text: txt, mentions: users });
        break;

      case "vv":
        if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) return;
        const q = m.message.extendedTextMessage.contextInfo.quotedMessage;
        const type = Object.keys(q)[0];
        const stream = await downloadContentFromMessage(
          q[type],
          type.includes("video") ? "video" : "image"
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await conn.sendMessage(sender, {
          [type.includes("video") ? "video" : "image"]: buffer,
          caption: "✅ View Once Saved"
        });
        break;

      case "aza":
        await conn.sendMessage(chat, {
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
