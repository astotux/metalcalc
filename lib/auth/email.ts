import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

export interface EmailDeliveryResult {
  deliveredVia: "smtp" | "dev_preview";
  devPreviewCode?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS || undefined;
  const from = process.env.SMTP_FROM?.trim() || user || "no-reply@metalcalc.local";

  return { host, port, secure, user, pass, from };
}

export function generateSixDigitCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function readSmtpResponse(socket: net.Socket | tls.TLSSocket): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      // Многострочные ответы SMTP заканчиваются строкой вида "250 ..." (пробел после 3 цифр)
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve({ code: Number(last.slice(0, 3)), text: buffer });
      }
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendSmtpCommand(
  socket: net.Socket | tls.TLSSocket,
  command: string,
  expectedCodes: number[]
): Promise<string> {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP error ${response.code}: ${response.text.trim()}`);
  }
  return response.text;
}

function connectSocket(host: string, port: number, useTls: boolean): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = useTls
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(10000, () => {
      socket.destroy(new Error("SMTP connection timeout"));
    });
    socket.once("error", reject);
  });
}

function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => {
      resolve(secureSocket);
    });
    secureSocket.once("error", reject);
  });
}

async function sendViaSmtp(
  config: SmtpConfig,
  toEmail: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<void> {
  let socket = await connectSocket(config.host, config.port, config.secure);

  try {
    const greeting = await readSmtpResponse(socket);
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed: ${greeting.text}`);
    }

    const heloDomain = "metalcalc.online";
    const ehlo = await sendSmtpCommand(socket, `EHLO ${heloDomain}`, [250]);

    if (!config.secure && /STARTTLS/i.test(ehlo)) {
      await sendSmtpCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket as net.Socket, config.host);
      await sendSmtpCommand(socket, `EHLO ${heloDomain}`, [250]);
    }

    if (config.user && config.pass) {
      const authPlain = Buffer.from(`\u0000${config.user}\u0000${config.pass}`, "utf8").toString(
        "base64"
      );
      await sendSmtpCommand(socket, `AUTH PLAIN ${authPlain}`, [235]);
    }

    const fromAddress = config.from.match(/<([^>]+)>/)?.[1] || config.from;
    await sendSmtpCommand(socket, `MAIL FROM:<${fromAddress}>`, [250]);
    await sendSmtpCommand(socket, `RCPT TO:<${toEmail}>`, [250, 251]);
    await sendSmtpCommand(socket, "DATA", [354]);

    const boundary = `mc_${crypto.randomBytes(8).toString("hex")}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
    const message = [
      `From: ${config.from}`,
      `To: ${toEmail}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(textBody, "utf8").toString("base64"),
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(htmlBody, "utf8").toString("base64"),
      "",
      `--${boundary}--`,
      ".",
    ].join("\r\n");

    socket.write(`${message}\r\n`);
    const dataResp = await readSmtpResponse(socket);
    if (dataResp.code !== 250) {
      throw new Error(`SMTP DATA rejected (${dataResp.code}): ${dataResp.text}`);
    }

    await sendSmtpCommand(socket, "QUIT", [221]).catch(() => undefined);
  } finally {
    socket.destroy();
  }
}

export async function sendVerificationCodeEmail(params: {
  toEmail: string;
  name: string;
  code: string;
}): Promise<EmailDeliveryResult> {
  const { toEmail, name, code } = params;
  const smtp = getSmtpConfig();

  const subject = `Код подтверждения MetalCalc: ${code}`;
  const textBody = [
    `Здравствуйте, ${name}!`,
    "",
    `Ваш код подтверждения почты для MetalCalc: ${code}`,
    "Код действует 10 минут.",
    "",
    "Если вы не регистрировались в MetalCalc, просто проигнорируйте это письмо.",
  ].join("\n");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 10px;">
      <div style="display: inline-block; background: #6c2d2c; color: #f1dcc9; font-weight: bold; padding: 6px 10px; border-radius: 6px; font-size: 13px;">MC MetalCalc</div>
      <h2 style="margin: 16px 0 8px; font-size: 18px; color: #18181b;">Подтверждение электронной почты</h2>
      <p style="margin: 0 0 16px; color: #52525b; font-size: 14px;">Здравствуйте, ${name}! Введите этот 6-значный код на странице регистрации:</p>
      <div style="background: #f4f4f5; border: 1px solid #d4d4d8; border-radius: 8px; padding: 14px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #6c2d2c;">${code}</div>
      <p style="margin: 16px 0 0; color: #71717a; font-size: 12px;">Срок действия кода — 10 минут. Не сообщайте его третьим лицам.</p>
    </div>
  `;

  if (!smtp) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMTP-сервер не настроен. Задайте SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASS."
      );
    }
    console.info(`[MetalCalc Auth DEV] Код подтверждения для ${toEmail}: ${code}`);
    return {
      deliveredVia: "dev_preview",
      devPreviewCode: code,
    };
  }

  await sendViaSmtp(smtp, toEmail, subject, htmlBody, textBody);
  return { deliveredVia: "smtp" };
}
