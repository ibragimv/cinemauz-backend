# Cinema Backend

## O'rnatish

### 1. Kutubxonalarni o'rnatish
```bash
npm install
```

### 2. GramJS session olish (FAQAT BIR MARTA)
```bash
node src/setup.js
```
Chiqgan `TELEGRAM_SESSION=...` ni `.env` fayliga qo'shing.

### 3. Redis o'rnatish (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 4. Ishga tushirish

**Development:**
```bash
npm run dev
```

**Production (PM2):**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## API Endpointlar

| Method | URL | Tavsif |
|--------|-----|--------|
| GET | `/api/movies` | Barcha kinolar |
| GET | `/api/movies?genre=Action` | Janr bo'yicha |
| GET | `/api/movies?year=2024` | Yil bo'yicha |
| GET | `/api/movies?country=USA` | Davlat bo'yicha |
| GET | `/api/movies?is_premiere=true` | Premyeralar |
| GET | `/api/movies?sort=rating&order=desc` | Reyting bo'yicha |
| GET | `/api/movies/search?q=batman` | Qidiruv |
| GET | `/api/movies/filters` | Mavjud filterlar |
| GET | `/api/movies/:id` | Bitta kino |
| GET | `/stream/:id` | Video stream |
| GET | `/stream/:id/info` | Video ma'lumot |

---

## Bot Komandalar
Komandalar yo'q — faqat inline tugmalar!

Bot ga biror xabar yozing → Bosh menyu chiqadi.

---

## Fayl Tuzilmasi
```
backend/
├── .env
├── package.json
├── ecosystem.config.js
└── src/
    ├── app.js              # Asosiy fayl
    ├── setup.js            # Session setup (bir marta)
    ├── config/index.js     # Konfiguratsiya
    ├── telegram/
    │   ├── bot.js          # Bot API
    │   └── client.js       # GramJS
    ├── bot/
    │   ├── index.js        # Bot router
    │   ├── session.js      # Holat boshqaruvi
    │   ├── keyboards.js    # Inline tugmalar
    │   └── handlers/
    │       ├── start.js
    │       ├── upload.js
    │       ├── moviesList.js
    │       ├── deleteHandler.js
    │       ├── editHandler.js
    │       ├── searchHandler.js
    │       └── statsHandler.js
    ├── services/
    │   ├── movieService.js   # Kino logikasi
    │   ├── cacheService.js   # Redis
    │   └── streamService.js  # GramJS stream
    ├── routes/
    │   ├── movies.js
    │   └── stream.js
    └── middleware/
        └── rateLimit.js
```
