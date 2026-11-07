# 🇬🇧🇺🇿 Uzbek–English Vocabulary Telegram Bot

Ingliz tilidagi so'zlarni o'zbek (lotin) tilida **SM-2 Spaced Repetition**, **Quiz rejimlar** va **Mini o'yinlar** yordamida samarali yodlash uchun mo'ljallangan production darajadagi Telegram bot.

---

## ✨ Asosiy Imkoniyatlar (Features)

1. **Onboarding (`/start`, `/settings`)**: Daraja (`A1`–`C1`), kunlik maqsad (`5 / 10 / 20` so'z) va kunlik eslatma vaqtini tanlash (`@grammyjs/conversations`).
2. **So'zlar Bazasi (Word Bank)**: `A1`–`A2` darajadagi **105 ta tayyor so'z** bilan avtomatik to'ldiriladi (`seed.ts`). Har bir so'zda inglizcha, o'zbekcha tarjima, so'z turkumi (`pos`), mavzu (`topic`), fonetik transkripsiya (`IPA`), misol gap va tarjimasi hamda audio talaffuz mavjud.
3. **Flashcard O'rganish (`/learn`)**:
   - `✅ Bilaman` (SM-2 sifat = 5)
   - `🤔 Keyinroq` (SM-2 sifat = 3)
   - `❌ Bilmayman` (SM-2 sifat = 1)
   - `🔊 Talaffuz` (Oxford / Telegram Audio)
4. **SM-2 Spaced Repetition (`src/services/srs.service.ts`)**: Har bir foydalanuvchi va har bir so'z uchun `ease_factor`, `interval`, `repetitions` va `next_review_at` saqlanadi. Muddati kelgan so'zlar birinchi navbatda chiqariladi.
5. **Quiz Rejimlari (`/quiz`)**:
   - `🇬🇧 ➔ 🇺🇿` va `🇺🇿 ➔ 🇬🇧` 4 variantli test (aqlli chalg'ituvchi variantlar — bir xil daraja va so'z turkumidan).
   - `✍️ Yozma (Typing)` — Levenshtein masofasi yordamida kichik harf xatolarini kechiradi.
   - `🎧 Tinglab topish (Listening)` — Audio va yashirilgan misol gap orqali so'zni topish.
6. **Mini O'yinlar (`/games`)**:
   - `🔤 Word Scramble` — Aralashgan harflarni tugmalar orqali terib so'z yasash.
   - `🪢 Hangman` — 6 ta jon (`❤️`) bilan harflarni topish o'yini.
   - `🧩 Juftlikni top (Matching Pairs)` — 4x2 tugmalar to'rida inglizcha va o'zbekcha so'zlarni juftlash.
   - `⚡ Tezkor raund (Speed Round)` — 60 soniya ichida eng ko'p to'g'ri javob berish.
7. **Gamifikatsiya (`/stats`, `/top`)**: XP, foydalanuvchi bosqichlari (Levels), kunlik faollik (Streak), 8 xil yutuq (Achievements) va haftalik peshqadamlar jadvali.
8. **Kunlik Eslatmalar (`src/jobs/reminder.job.ts`)**: BullMQ yordamida foydalanuvchi tanlagan soatda **faqat takrorlash vaqti kelgan so'zlari bo'lsagina** eslatma yuboriladi.
9. **Admin Panel (`/admin`)**: Bitta so'z qo'shish, CSV fayl/matn orqali ommaviy so'z yuklash, umumiy statistika va barcha foydalanuvchilarga xabar yuborish (Broadcast).

---

## 🚀 Lokal Ishga Tushirish (Windows / Mac / Linux — Docker siz ham ishlaydi!)

1. **Kutubxonalarni o'rnatish:**
   ```bash
   npm install
   ```
2. **`.env` faylini sozlash:**
   `.env` faylida `@BotFather` dan olingan `BOT_TOKEN` va o'zingizning Telegram ID raqamingizni (`ADMIN_IDS`) kiriting.
   *(Lokal rejimda `DATABASE_URL=file:./data/pglite` orqali ichki PostgreSQL bazasi avtomatik yaratiladi — alohida Postgres yoki Docker o'rnatish shart emas!)*
3. **Bazani yaratish va 105 ta so'zni yuklash:**
   ```bash
   npm run db:seed
   ```
4. **Unit testlarni tekshirish:**
   ```bash
   npm test
   ```
5. **Botni ishga tushirish:**
   ```bash
   npm run dev
   ```

---

## 🌐 Stage 8: Production Deployment (VPS + Docker Compose + Webhook)

### 1. VPS Serverni tayyorlash (Ubuntu 22.04 / 24.04)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
```

### 2. `.env` faylini Production uchun sozlash
```dotenv
NODE_ENV=production
LOG_LEVEL=info
BOT_TOKEN=1234567890:AAH_real_production_bot_token
ADMIN_IDS=123456789

BOT_MODE=webhook
WEBHOOK_DOMAIN=https://bot.yourdomain.com
WEBHOOK_PATH=/webhook/telegram
WEBHOOK_SECRET=very_strong_random_secret_string_2026
PORT=3000

POSTGRES_USER=vocab_user
POSTGRES_PASSWORD=strong_postgres_password
POSTGRES_DB=vocab_bot_db
DATABASE_URL=postgresql://vocab_user:strong_postgres_password@postgres:5432/vocab_bot_db
REDIS_URL=redis://redis:6379
DEFAULT_TIMEZONE=Asia/Tashkent
```

### 3. Nginx Reverse Proxy + SSL (HTTPS)
`/etc/nginx/sites-available/vocab-bot`:
```nginx
server {
    server_name bot.yourdomain.com;

    location /webhook/telegram {
        proxy_pass http://127.0.0.1:3000/webhook/telegram;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
    }
}
```
SSL sertifikat olish:
```bash
sudo ln -s /etc/nginx/sites-available/vocab-bot /etc/nginx/sites-enabled/
sudo certbot --nginx -d bot.yourdomain.com
sudo systemctl reload nginx
```

### 4. Docker Compose orqali ishga tushirish
```bash
docker compose up -d --build
```
Bot ishga tushganda avtomatik ravishda PostgreSQL jadvallarini yaratadi, boshlang'ich 105 ta so'zni bazaga yozadi va Telegram Webhook ni ulaydi.
