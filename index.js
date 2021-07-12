import { config } from "dotenv";
config();
import cron from "node-cron";
import puppeteer from "puppeteer";
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

const getPageNotices = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set the viewport first
  await page.setViewport({
    width: 375,
    height: 900,
  });

  // Access page
  await page.goto("https://vaccines.sciseed.jp/itabashi/login");

  // Take a screenshot
  await page.screenshot({ path: "screenshot.png" });

  // Get the notices from the page
  const notices = await page.evaluate(() => {
    const noticesEl = document.querySelector(".page-login_articles");
    const noticeEls = document.querySelectorAll(".page-login_article");

    if (noticesEl) {
      const noticesArray = [...noticeEls].map((noticeEl) => {
        const noticeUpdatedAt = noticeEl.querySelector(
          ".page-login_article-header__updated-at"
        ).innerText;
        const noticeHeader = noticeEl.querySelector(
          ".page-login_article-header__title"
        ).innerText;
        const noticeDescription = noticeEl.querySelector(
          ".page-login_article-description"
        ).innerText;

        return {
          updated_at: noticeUpdatedAt,
          title: noticeHeader,
          description: noticeDescription,
        };
      });

      return noticesArray;
    }
  });

  await browser.close();

  return notices;
};

// Send notices to chat
const sendNoticesToChat = async (chatId) => {
  bot.sendMessage(chatId, "Getting your notices...");

  const notices = await getPageNotices();

  if (notices.length > 0) {
    let noticeString = ``;
    notices.forEach((notice) => {
      noticeString =
        noticeString +
        `${notice.updated_at}\n*${notice.title}*\n${notice.description}\n\n`;
    });

    bot.sendMessage(chatId, noticeString, { parse_mode: "MarkdownV2" });
    bot.sendPhoto(chatId, "./screenshot.png");

    console.log(`Notices sent.`);
  } else {
    bot.sendMessage(chatId, "Oops, no notices found.");
    console.error("No notices found.");
  }
};

// Run the Telegram bot
bot.onText(/\/update/, (msg) => {
  const date = new Date();
  console.log(`\nUPDATE COMMAND (${date}):`);

  sendNoticesToChat(msg.chat.id);
});

// Run the job every 30mins
cron.schedule("0 */2 * * *", () => {
  const date = new Date();
  console.log(`\nCRON JOB (${date}):`);

  sendNoticesToChat(process.env.GROUP_CHAT_ID);
});
