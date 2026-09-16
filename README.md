# Dava Takip — Görev · Dava · Dosya Takip PWA

Android cihazın ana ekranına kurulabilen, çevrimdışı çalışan, Android sistem bildirimi gönderen takip uygulaması.

## Özellikler

- **Görev takibi:** ad, uygulama/etiket, son tarih, durum, not
- **Dava takibi:** dosya no, mahkeme, dava türü, taraf, durum + birden çok **duruşma** ve **süre** (dilekçe, istinaf, bilirkişi itirazı...)
- **Dosya takibi:** dosya adı, yol, ilgili dava, tür, son tarih
- **Geri sayım ve uyarı modu:** süre yaklaştıkça renkli etiketler; geçen süreler kırmızı yanıp söner
- **Hatırlatma modu:** tam zamanında / 5 dk / 10 dk / 30 dk / 1 saat / 1 gün / 2 gün önce (her kayıt için seçilebilir) → Android bildirimi + zil + isteğe bağlı TTS
- **Tamamen çevrimdışı:** Service Worker cache + localStorage
- **Yedekleme:** JSON export/import

## Çalıştırma (lokal, Seçenek B)

```bash
node server.js        # http://localhost:8080
# telefondan Chrome'da aç: http://localhost:8080
# menü → "Ana ekrana ekle"
```

## GitHub Pages yayınlama (Seçenek A — önerilen)

1. GitHub'a giriş:
   ```bash
   gh auth login
   ```
2. Repo oluştur + yayınla:
   ```bash
   git init && git add . && git commit -m "Dava Takip PWA"
   gh repo create dava-takip --public --source . --push
   gh api -X POST repos/{YOUR_USERNAME}/dava-takip/pages \
     -f "source[branch]=main" -f "source[path]=/"
   ```
3. Kurulum:
   - Telefonda Chrome ile `https://YOUR_USERNAME.github.io/dava-takip/` aç
   - **Bildirim iznini kabul et** (ilk açılışta üstte "Bildirimler" butonu ile de isteyebilirsin)
   - Menü → **Ana ekrana ekle** → Kur
4. Artık uygulama ana ekranda; bildirimler duruşma ve sürelerden önce telefonuna düşer.

## Geliştirme

Simge düzenini değiştirmek istersen:

```bash
node scripts/gen-icons.js
```

Smoke testi (jsdom gerekir):

```bash
npm i --no-save jsdom && node test/smoke.mjs && rm -rf node_modules package-lock.json
```

## Veri

- Tüm veri tarayıcının `localStorage`'ında tutulur (cihazın kendisinde).
- Yedekle: Ayarlar → "Yedekle (.json)". Riskli işlemlerde telefon değişiminde yedeği geri yükleyebilirsin (`Geri yükle`).