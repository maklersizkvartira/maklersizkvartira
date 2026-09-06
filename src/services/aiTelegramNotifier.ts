/**
 * Telegram notification service for Uyiz AI Chat.
 *
 * Sends the full transcript of user and AI messages to admins
 * when the user ends the conversation ("yakunlash").
 */

const AI_BOT_TOKEN = '8760567987:AAF5Qg1jVk7xClHJuTkxOSWvgDs9WEptL_M';
const TARGET_CHANNEL_ID = '-1004486550551';

export interface ChatMessageItem {
  from: 'me' | 'ai';
  text: string;
}

export interface SendAiChatParams {
  userName?: string | null;
  userPhone?: string | null;
  log: ChatMessageItem[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Split a long text into chunks under Telegram's 4096 character limit.
 */
function chunkMessage(text: string, maxLen = 3800): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let current = '';

  const lines = text.split('\n');
  for (const line of lines) {
    if ((current + '\n' + line).length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function sendAiChatToTelegram(params: SendAiChatParams): Promise<void> {
  const { userName, userPhone, log } = params;

  // Only send if there are user messages
  const userMessages = log.filter((m) => m.from === 'me');
  if (userMessages.length === 0) return;

  const now = new Date().toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const clientName = userName?.trim() || 'Mehmon (Noma’lum foydalanuvchi)';
  const clientPhone = userPhone?.trim() || 'Kiritilmagan';

  const header =
    `🤖━━━━━━━━━━━━━━━━━━━━━━🤖\n` +
    `   💬 <b>UYIZ AI — MIJOZ BILAN SUHBAT</b> 💬\n` +
    `🤖━━━━━━━━━━━━━━━━━━━━━━🤖\n\n` +
    `👤 <b>Mijoz:</b> ${escapeHtml(clientName)}\n` +
    `📱 <b>Telefon:</b> ${escapeHtml(clientPhone)}\n` +
    `⏰ <b>Vaqt:</b> ${escapeHtml(now)}\n` +
    `💬 <b>Jami xabarlar soni:</b> ${log.length} ta\n` +
    `📍 <b>Manba:</b> Uyiz Online AI Yordamchi\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 <b>SUHBAT YOZISHMALARI:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  let transcript = '';
  for (const msg of log) {
    const isUser = msg.from === 'me';
    const sender = isUser ? '👤 <b>Mijoz:</b>' : '🤖 <b>Uyiz AI:</b>';
    transcript += `${sender}\n${escapeHtml(msg.text.trim())}\n\n`;
  }

  const fullMessage = header + transcript + `━━━━━━━━━━━━━━━━━━━━━━\n🏁 <i>Suhbat mijoz tomonidan yakunlandi</i>\n🤖━━━━━━━━━━━━━━━━━━━━━━🤖`;
  const messageChunks = chunkMessage(fullMessage);

  for (const chunk of messageChunks) {
    try {
      await fetch(`https://api.telegram.org/bot${AI_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TARGET_CHANNEL_ID,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
    } catch (err) {
      console.warn(`Failed to send AI chat notification to ${TARGET_CHANNEL_ID}:`, err);
    }
  }
}
