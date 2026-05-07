# nobro.app

[English](README.md) · [Türkçe](README.tr.md)

> **no thinking. just lift.**
> no noise. no ego. no nonsense.

Düşünmek istemeyenler için bir dambıl programı. Aç, sıradaki seti yap, kapat. Uygulamanın tamamı bu.

**Canlı:** https://nobro.app

---

## Bu nedir

Statik, kurulabilir bir PWA antrenman takipçisi. Tek ekran sıradaki seti gösteriyor — egzersiz adı, set sayısı, tekrar hedefi, mola sayacı. Geri kalan her şey modallarda.

Bilinçli olarak küçük: ağda toplam ~57 KB. Build adımı yok, framework yok, `node_modules` yok, backend yok, üyelik yok, takip yok, reklam yok. Sadece statik dosyalar olarak servis edilen HTML, CSS ve vanilla JS.

## Özellikler

- **Üyelik yok.** E-posta yok, "Google ile devam et" yok. Aç, kullan.
- **Kurulum yok.** Bir PWA — iPhone'da: Paylaş → Ana Ekrana Ekle; Android'de: menü → Yükle. Sonrasında native bir uygulama gibi davranıyor: kendi simgesi, tam ekran, üst tarayıcı çubuğu yok.
- **Çevrimdışı çalışır.** İlk açılışta service worker shell'i önbelleğe alıyor. Salonun WiFi'si ölse de uygulaman ölmez.
- **Özelleştirilebilir program.** Hazır gelen 6 günlük dambıl bölünmesi sadece başlangıç noktası — Ayarlar'dan her gün için egzersiz ekle, sil, sırala, set/tekrar/mola süresini değiştir.
- **Program kütüphanesi.** Topluluk tarafından eklenen büyüyen bir program kataloğu (Dambıl 6 gün, Vücut ağırlığı 3 gün, Üst/Alt 4 gün, …). Menü simgesine bas, birini seç, kaldır. Katkı veren koçlar isim + nofollow link kredisi alıyor.
- **Dışa / içe aktar.** Programını JSON olarak yedekle veya başka bir cihaza taşı.
- **Mola sayacı.** Mola bittiği an telefon titrer ve ses çıkar.
- **Wake Lock.** Set sırasında ekran kararmaz.
- **Günlük sıfırlama.** Bugünün ilerlemesi sadece bugünündür; gece yarısı temiz başlangıç.
- **11 dil**, tarayıcı diline göre otomatik: English, Türkçe, 中文, हिन्दी, Español, Français, العربية (RTL), বাংলা, Русский, Português, Bahasa Indonesia.
- **Hep ücretsiz.** [bulutpress](https://bulut.press) sponsorluğunda — premium yok, ek satış yok, "ücretsiz deneme süresi" yok.

## Kullan

1. Telefonda [nobro.app](https://nobro.app) adresine git.
2. **iPhone:** Paylaş → Ana Ekrana Ekle.
   **Android:** tarayıcı menüsü → Yükle / Ana ekrana ekle.
3. Ana ekrandaki simgeden aç. İstersen programı düzenle (sağ üstte dişli simgesi).
4. Salona git, ekrana bak, seti yap, kapat.

Hepsi bu. 5. adım yok.

## Yerelde çalıştır

```bash
git clone https://github.com/mybottles/nobro-app
cd nobro-app
python3 -m http.server 8000
# tarayıcıda http://localhost:8000 aç
```

Herhangi bir statik HTTP sunucusu işe yarar. Build edilecek bir şey yok.

## Nasıl yapıldı (kısıtlar)

- **Build adımı yok.** `index.html` doğrudan `app.css` ve `app.js`'i çağırıyor.
- **Framework yok.** Vanilla JS, i18n çalışma zamanı ve program editörü dahil ~750 satır.
- **Backend yok.** GitHub Pages üzerinde statik dosyalar. Durum iki `localStorage` anahtarında (bugünün ilerlemesi + kullanıcının özelleştirdiği program).
- **Takip yok.** Sıfır analytics, sıfır telemetri. Açılışta tek bir dış istek (locale JSON dosyası). Geliştirici araçlarını aç ve bak.
- **Service worker.** Sürümlü cache, shell için cache-first, içerik için (locale'ler + varsayılan program JSON'u) network-first — yani güncellemeler cache bump'sız akıyor.

Tam mimari [CLAUDE.md](CLAUDE.md)'de belgelendi.

## Programı özelleştirme

Antrenman programı, uygulamanın Ayarlar sayfasında (veya kendi JSON'unu içe aktararak) tamamen düzenleyebileceğin bir JSON dosyasıdır. Format:

```json
{
  "version": 1,
  "name": "Programım",
  "description": "İsteğe bağlı tek satırlık özet.",
  "coach": { "name": "İsteğe bağlı", "url": "https://opsiyonel" },
  "days": {
    "1": [
      { "region": "Chest", "name": "Flat DB Press", "description": "...", "set": 4, "reps": "10", "rest": 90 }
    ],
    "2": [], "3": [], "4": [], "5": [], "6": [], "7": []
  }
}
```

`reps` bir string — `"Max"`, `"60s"` veya sayısal değer tutabilsin diye. Üst seviye metadata (`name`, `description`, `coach`) her yerde isteğe bağlı — varsa uygulama gösterir, yoksa görmezden gelir.

## Programını paylaşmak (katkı sağlamak)

Programs (Programlar) menüsü topluluk tarafından besleniyor. Kendi programını eklemek için repo'yu fork'la ve şu iki dosyayı içeren bir PR aç:

1. **`presets/<senin-id>.json`** — `name`, `description`, `coach: { name, url }` ve `days` alanlarını dolu bir program. [presets/](presets/) klasöründeki hazır dosyalar canlı örnekler.
2. **[`presets/index.json`](presets/index.json)** içine bir kayıt — aynı `id`, dosya adı, ve aynı name/description/coach (her preset'i tek tek fetch'lemeden listeyi göstermek için index hafif bir kataloğa benziyor; ikisini senkron tutmak gerek).

Coach linkleri otomatik olarak `rel="nofollow noopener"` alıyor — koçun kendi reklamı, SEO ağırlığı taşımıyor; ama programını kullanan herkes adını görüp sitene tıklayabiliyor. Adım adım kontrol listesi: [`presets/README.md`](presets/README.md).

Eşik düşük: kendin de yapacağın gerçek bir program yaz, dürüst metadata doldur, PR aç.

## Çeviri

Her dil [`locales/{kod}.json`](locales/) altında, aynı şekille: `meta`, `ui`, `duration`, `days_short`. İngilizce (`en`) kanonik fallback — bir dilde eksik anahtar olursa önce `en`'e, sonra düz anahtar metnine düşülür.

Yeni bir dil eklemek istersen: `en.json`'la aynı şekilde bir JSON dosyası bırak, kodu `app.js` içindeki `SUPPORTED_LOCALES`'e ekle, `sw.js` içindeki `CACHE`'i bump'la, PR aç.

Marka cümleleri — `no thinking. just lift.` ve `no noise. no ego. no nonsense.` — her dilde İngilizce kalıyor. Bunlar marka, çeviri değil.

## Sponsor ve geliştirici

- Sponsor: [bulutpress](https://bulut.press) — Türkiye merkezli hosting / yayıncılık.
- Geliştirici: [Murat Uysal](https://muratuysal.com).
- Katkı, çeviri düzeltmesi, hata bildirimi her zaman bekleniyor — issue ya da PR aç.

## Lisans

[MIT](LICENSE) — fork'la, kendi sürümünü çıkar, atıf zorunlu değil (ama hoş olur).
