# General & Welcome
welcome-new = 👋 Assalomu alaykum, <b>{ $name }</b>!
    Ingliz tili lug'at boyligini oshirish botiga xush kelibsiz! 🇬🇧🇺🇿
    Keling, dastlab darajangiz va kunlik maqsadingizni belgilab olaylik.

welcome-back = 👋 Qaytganingizdan xursandmiz, <b>{ $name }</b>!
    📊 Daraja: <b>{ $level }</b> | 🎯 Kunlik maqsad: <b>{ $goal } ta so'z</b>
    🔥 Streak: <b>{ $streak } kun</b> | ⭐ XP: <b>{ $xp }</b> (Bosqich { $userLevel })
    Quyidagi menyudan kerakli bo'limni tanlang:

help-text = 📚 <b>Bot buyruqlari va imkoniyatlari:</b>
    /start — Asosiy menyu
    /learn — Yangi so'zlarni o'rganish va takrorlash (SM-2)
    /quiz — Test rejimlari (Variantli, Yozma, Tinglab topish)
    /games — Mini o'yinlar (Scramble, Hangman, Juftliklar, Tezkor raund)
    /stats — Shaxsiy statistika va qiyin so'zlar
    /top — Haftalik va umumiy peshqadamlar jadvali
    /invite — Do'stlarni taklif qilib +50 XP olish
    /settings — Daraja va kunlik maqsadni o'zgartirish

error-generic = ⚠️ Kutilmagan xatolik yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.
rate-limit = ⏳ Iltimos, tugmalarni juda tez bosmang. Biroz kuting!

# Onboarding
onboarding-choose-level = 🎓 <b>1-qadam:</b> Ingliz tili darajangizni tanlang:
onboarding-choose-goal = 🎯 <b>2-qadam:</b> Kuniga nechta so'z o'rganmoqchisiz?
onboarding-choose-reminder = ⏰ <b>3-qadam:</b> Kunlik eslatma soat nechada yuborilsin?
onboarding-complete = ✅ <b>Sozlamalar saqlandi!</b>
    🎓 Daraja: <b>{ $level }</b>
    🎯 Kunlik maqsad: <b>{ $goal } ta so'z</b>
    ⏰ Eslatma vaqti: <b>{ $hour }:00</b>
    Endi «📖 So'z o'rganish» tugmasini bosib boshlashingiz mumkin!

# Main Menu Buttons
btn-learn = 📖 So'z o'rganish
btn-quiz = 🧠 Testlar (Quiz)
btn-games = 🎮 Mini o'yinlar
btn-stats = 📊 Statistika
btn-leaderboard = 🏆 Reyting (/top)
btn-invite = 🎁 Do'stlarni chaqirish (+50 XP)
btn-settings = ⚙️ Sozlamalar
btn-back-main = 🏠 Asosiy menyu

# Learning & Flashcards (SRS)
learn-card = 📇 <b>Kartochka ({ $current } / { $total })</b> { $badge }
    
    🇬🇧 <b>{ $english }</b> { $ipa }
    🏷 <i>{ $pos } • #{ $topic } ({ $level })</i>
    
    🇺🇿 Tarjimasi: <tg-spoiler><b>{ $uzbek }</b></tg-spoiler>
    
    💬 <i>"{ $exampleEn }"</i>
    🇺🇿 <tg-spoiler><i>"{ $exampleUz }"</i></tg-spoiler>

btn-know = ✅ Bilaman
btn-later = 🤔 Keyinroq
btn-dont-know = ❌ Bilmayman
btn-listen-audio = 🔊 Talaffuz

learn-empty = 🎉 <b>Ajoyib!</b> Hozircha takrorlash uchun ham, yangi o'rganish uchun ham so'zlar qolmadi.
    Bilimingizni mustahkamlash uchun 🧠 <b>Testlar</b> yoki 🎮 <b>Mini o'yinlar</b> o'ynab ko'ring!

learn-session-done = 🏆 <b>O'quv sessiyasi yakunlandi!</b>
    ✅ Ko'rib chiqildi: <b>{ $total } ta so'z</b>
    ⭐ Qo'shilgan XP: <b>+{ $xp } XP</b>
    🔥 Joriy streak: <b>{ $streak } kun</b>

# Quiz Modes
quiz-menu-title = 🧠 <b>Test rejimini tanlang:</b>
    • <b>🇬🇧 ➔ 🇺🇿 Variantli test</b> — Inglizcha so'zning o'zbekcha tarjimasini toping
    • <b>🇺🇿 ➔ 🇬🇧 Variantli test</b> — O'zbekcha so'zning inglizcha tarjimasini toping
    • <b>✍️ Yozma test (Typing)</b> — Tarjimani klaviaturada yozing (kichik imlo xatolar kechiriladi)
    • <b>🎧 Tinglab topish (Listening)</b> — Audio/talaffuz orqali so'zni toping

btn-quiz-en-uz = 🇬🇧 ➔ 🇺🇿 Variantli
btn-quiz-uz-en = 🇺🇿 ➔ 🇬🇧 Variantli
btn-quiz-typing = ✍️ Yozma (Typing)
btn-quiz-listening = 🎧 Tinglab topish

quiz-mc-question = ❓ <b>Savol ({ $current } / { $total })</b>
    Quyidagi so'zning to'g'ri tarjimasini toping:
    
    👉 <b>{ $prompt }</b> <i>({ $pos })</i>

quiz-typing-question = ✍️ <b>Yozma savol ({ $current } / { $total })</b>
    Quyidagi o'zbekcha so'zning <b>inglizcha</b> tarjimasini yozib yuboring:
    
    🇺🇿 <b>{ $uzbek }</b> <i>({ $pos })</i>
    💡 Misol: <i>{ $hint }</i>

quiz-listening-question = 🎧 <b>Tinglab topish ({ $current } / { $total })</b>
    Talaffuz va ma'noga qarab to'g'ri inglizcha so'zni tanlang:
    
    🔊 Talaffuz: <b>{ $ipa }</b>
    💬 Gap: <i>"{ $maskedExample }"</i>

quiz-correct = ✅ <b>To'g'ri!</b> ({ $word } — { $translation }) +10 XP
quiz-correct-typo = ✅ <b>Qabul qilindi!</b> (Kichik harf xatosi bilan: <b>{ $expected }</b>) +8 XP
quiz-wrong = ❌ <b>Noto'g'ri!</b> To'g'ri javob: <b>{ $expected }</b>
quiz-finished = 🏁 <b>Test yakunlandi!</b>
    🎯 Natija: <b>{ $score } / { $total }</b> ({ $percent }%)
    ⭐ Qo'lga kiritildi: <b>+{ $xp } XP</b>

# Mini Games
games-menu-title = 🎮 <b>Mini o'yinlar bo'limi:</b>
    O'yin orqali so'zlarni yanada tezroq eslab qoling!
    • <b>🔤 Word Scramble</b> — Aralashgan harflardan so'z yasang
    • <b>🪢 Hangman (Dor o'yini)</b> — Harflarni topib yashirin so'zni oching
    • <b>🧩 Juftlikni top (Matching)</b> — Inglizcha va o'zbekcha juftliklarni moslang
    • <b>⚡ Tezkor raund (Speed Round)</b> — 60 soniyada eng ko'p to'g'ri javob bering

btn-game-scramble = 🔤 Word Scramble
btn-game-hangman = 🪢 Hangman
btn-game-matching = 🧩 Juftlikni top
btn-game-speed = ⚡ Tezkor 60s

# Stats & Leaderboard
stats-view = 📊 <b>Sizning natijalaringiz ({ $name }):</b>
    
    🎓 Daraja: <b>{ $level }</b> | 🏅 Bosqich: <b>{ $userLevel }</b>
    ⭐ Jami XP: <b>{ $xp }</b> (Haftalik: <b>{ $weeklyXp }</b>)
    🔥 Kunlik faollik (Streak): <b>{ $streak } kun</b>
    🎯 Kunlik maqsad: <b>{ $learnedToday } / { $dailyGoal }</b>
    👥 Taklif qilingan do'stlar: <b>{ $referralsCount } ta</b>
    
    📚 <b>So'zlar holati:</b>
    • Jami ko'rilgan: <b>{ $totalSeen } ta</b>
    • O'rganilmoqda: <b>{ $learning } ta</b>
    • Takrorlashda: <b>{ $review } ta</b>
    • To'liq o'zlashtirilgan: <b>{ $mastered } ta</b>
    • Hozir takrorlash kerak: <b>{ $due } ta</b>
    
    🎯 Aniqlik darajasi: <b>{ $accuracy }%</b> ({ $correct } ✅ / { $wrong } ❌)
    🕹 O'ynalgan test va o'yinlar: <b>{ $quizzesPlayed } marta</b>

leaderboard-title = 🏆 <b>Haftalik Eng Faol O'quvchilar (Top 10):</b>

# Reminders
daily-reminder = 🔔 <b>Kunlik eslatma!</b>
    Salom, <b>{ $name }</b>! Sizda hozir takrorlash vaqti kelgan <b>{ $dueCount } ta so'z</b> bor.
    🔥 { $streak } kunlik streakni yo'qotmaslik uchun hoziroq 5 daqiqa vaqt ajrating!

# Admin
admin-denied = ⛔ Sizda administrator huquqi yo'q.
admin-menu = 🛠 <b>Administrator paneli:</b>
    👥 Jami foydalanuvchilar: <b>{ $usersCount }</b>
    📚 Jami bazadagi so'zlar: <b>{ $wordsCount }</b>
