import { getClient, isReady } from './client';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minSec: number, maxSec: number): number {
  return (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');

  if (phone.includes('@c.us')) return phone;

  if (clean.startsWith('0')) {
    return `54${clean.slice(1)}@c.us`;
  }

  if (!clean.startsWith('54')) {
    return `54${clean}@c.us`;
  }

  return `${clean}@c.us`;
}

export type SendResult = {
  success: boolean;
  messagesSent: number;
  error?: string;
};

export async function sendMessageSequence(
  phone: string,
  messages: string[],
  delayMinSec: number,
  delayMaxSec: number,
): Promise<SendResult> {
  if (!isReady()) {
    return {
      success: false,
      messagesSent: 0,
      error: 'Cliente WhatsApp no conectado',
    };
  }

  if (!messages.length) {
    return {
      success: false,
      messagesSent: 0,
      error: 'No hay mensajes para enviar',
    };
  }

  const client = getClient();
  const chatId = formatPhone(phone);
  let messagesSent = 0;

  try {
    for (let i = 0; i < messages.length; i++) {
      await client.sendMessage(chatId, messages[i]);
      messagesSent++;

      if (i < messages.length - 1) {
        const delay = randomDelay(delayMinSec, delayMaxSec);
        console.log(
          `[sender] Mensaje ${i + 1}/${messages.length} enviado a ${phone}. ` +
          `Próximo en ${delay / 1000}s`
        );
        await sleep(delay);
      }
    }

    console.log(`[sender] Secuencia completa para ${phone} (${messagesSent} mensajes)`);
    return { success: true, messagesSent };

  } catch (err: any) {
    console.error(`[sender] Error enviando a ${phone}:`, err.message);
    return {
      success: false,
      messagesSent,
      error: err.message,
    };
  }
}
