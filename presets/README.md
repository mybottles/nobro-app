# nobro.app — programs

This folder is the program library. Every file here is a workout program a user can apply with one tap from the Programs menu.

[Türkçe ↓](#nobroapp--programlar)

---

## What's here

- **`index.json`** — the catalog. Lists every preset with `id`, `file`, `name`, `description`, and `coach`. The Programs modal fetches this once and renders the list without touching individual preset files.
- **`<id>.json`** — one program per file. Fetched only when a user actually applies that program. This is what keeps the library cheap: 200 presets cost the user 200 bytes (catalog row), not 200 fetches.
- **`default.json`** — the program new users see on first run. Treat it like any other preset; it has no special schema.

## File shape

Every preset is a JSON file with this shape:

```json
{
  "version": 1,
  "id": "your-stable-id",
  "name": "Display Name",
  "description": "One paragraph pitch — who this is for, what equipment is needed, what the week looks like.",
  "coach": { "name": "Your Name", "url": "https://your-site.example" },
  "days": {
    "1": [
      { "region": "Chest", "name": "Flat DB Press", "description": "Cue the lifter on form.", "set": 4, "reps": "10", "rest": 90 }
    ],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
    "7": []
  }
}
```

Field rules:

| field | type | required | notes |
|---|---|---|---|
| `version` | int | yes | Always `1`. |
| `id` | string | yes | Stable, kebab-case, unique across the catalog. Don't change after release — it's the storage key for "which preset is active." |
| `name` | string | yes | What appears in the list. Title Case. Keep it under ~40 chars. |
| `description` | string | yes | One short paragraph. Who is this for, what equipment, weekly volume. No marketing fluff. |
| `coach.name` | string | yes | Your name (or alias). Shown next to the program. |
| `coach.url` | string | optional | Your site / profile. Rendered with `rel="nofollow noopener"`. Omit if you don't want a link. |
| `days` | object | yes | Keys `"1"`–`"7"` (Mon–Sun). Each value is an array of exercises. Empty arrays for rest days are required, not optional. |
| `days.<n>[].region` | string | yes | Body region or focus tag (`"Chest"`, `"Quads"`, `"Obliques"`). Free-form. |
| `days.<n>[].name` | string | yes | Exercise name. Free-form (links to a YouTube search in the UI). |
| `days.<n>[].description` | string | yes | Form cue, one short line. |
| `days.<n>[].set` | int | yes | ≥ 1. |
| `days.<n>[].reps` | string | yes | Always a string, even for numbers — so `"10"`, `"Max"`, `"60s"`, `"30s"` all work. |
| `days.<n>[].rest` | int | yes | Rest seconds between sets. |

The runtime validates `days` strictly via `isValidProgramDays()` in `app.js`. Metadata fields are validated loosely — extras are ignored, missing optional fields are fine.

## How to contribute a program

1. **Fork the repo:** https://github.com/mybottles/nobro-app
2. **Pick an `id`** that's stable and descriptive: `dumbbell-push-pull-3day`, `kettlebell-fullbody-2day`, `prison-pushups-only`. Don't reuse an existing id; check `index.json`.
3. **Create `presets/<id>.json`** following the shape above. The bundled files in this folder are working references.
4. **Add an entry to `index.json`**:

   ```json
   {
     "id": "<id>",
     "file": "<id>.json",
     "name": "<same as in your file>",
     "description": "<same as in your file>",
     "coach": { "name": "<same>", "url": "<same>" }
   }
   ```

   The duplication is intentional: the index is the lightweight rendering source, the file is the full program. Both must agree on `name`, `description`, and `coach`.

5. **Run it locally.** Any static server works:

   ```bash
   python3 -m http.server 8000
   # open http://localhost:8000, tap the menu icon, apply your preset, do a session
   ```

6. **Open a PR.** Title: `add preset: <name>`. Body: who it's for, why you wrote it, anything testers should know.

## House rules

- **English only.** Exercise names, descriptions, regions — all English. The whole program library shares the same language so the JSON is portable across users; localization is for UI strings, not content.
- **Real programs only.** Run it yourself first. Don't submit something LLM-padded that you'd never actually do.
- **One submission, one program.** If you have three variants of a routine, that's three PRs (and three files). Each preset stands on its own.
- **Coach link is yours, but earn it.** It's `nofollow`, so it won't help your search ranking — but real users will see it and click. Treat it like an honest credit, not link spam. Personal site, gym site, project page: all fine. Affiliate landing pages: don't.
- **Sets aren't homework.** A preset can have 3 days, 5 days, 7 days. Empty days are valid (`[]`). Don't pad to fill all 7.
- **No trademarked program names.** "5/3/1", "Stronglifts", "PPL" the term is fine, but don't ship someone else's branded program verbatim. Inspiration is welcome, copy isn't.

## Updating an existing preset

Same flow — open a PR, edit the file, edit the matching index entry. Keep `id` stable so users who already applied your program don't get bumped off it after the next service-worker update. If you're making a breaking change (different focus, different days), publish it under a new `id`.

## Removing a preset

Open a PR, delete the file, remove the index entry. Users who already applied it keep their copy — `nobro_program_v1` is in their `localStorage`, the deletion just stops new users from picking it.

---

# nobro.app — programlar

Bu klasör program kütüphanesi. Buradaki her dosya, kullanıcının Programs (Programlar) menüsünden tek dokunuşla uygulayabileceği bir antrenman programı.

## Ne var burada

- **`index.json`** — katalog. Her preset'i `id`, `file`, `name`, `description`, `coach` alanlarıyla listeliyor. Programs modal'ı bu dosyayı bir kez fetch ediyor ve listeyi tek tek preset dosyalarına dokunmadan render ediyor.
- **`<id>.json`** — dosya başına bir program. Sadece kullanıcı o programı *uyguladığında* fetch ediliyor. Kütüphaneyi ucuza tutan şey bu: 200 preset kullanıcıya 200 byte (katalog satırı) maliyetinde, 200 fetch değil.
- **`default.json`** — yeni kullanıcının ilk açılışta gördüğü program. Diğerleri gibi normal bir preset; özel şeması yok.

## Dosya şekli

Her preset şu şekilde bir JSON:

```json
{
  "version": 1,
  "id": "kalici-id",
  "name": "Görünen ad",
  "description": "Tek paragraflık özet — kime hitap ediyor, hangi ekipman, haftalık akış.",
  "coach": { "name": "Adın", "url": "https://siten.example" },
  "days": {
    "1": [
      { "region": "Göğüs", "name": "Flat DB Press", "description": "Form ipucu.", "set": 4, "reps": "10", "rest": 90 }
    ],
    "2": [], "3": [], "4": [], "5": [], "6": [], "7": []
  }
}
```

Alan kuralları için yukarıdaki İngilizce tabloya bakın — şart ve tipler aynı.

## Nasıl katkı sağlanır

1. **Repo'yu fork'la:** https://github.com/mybottles/nobro-app
2. **Bir `id` seç** — sabit, kebab-case, eşsiz. Yayınlandıktan sonra değiştirme; "şu an aktif olan preset" anahtarı bu.
3. **`presets/<id>.json`** dosyanı yukarıdaki şemaya göre oluştur. Bu klasördeki hazır dosyalar çalışan örnekler.
4. **`index.json`** içine senin preset'inin metadata'sını ekle. İki yerde de aynı `name`, `description`, `coach` olmalı.
5. **Yerelde çalıştır** — `python3 -m http.server 8000`, tarayıcıda menüden uygula, bir gün boyunca bizzat dene.
6. **PR aç.** Başlık: `add preset: <ad>`. Açıklama: kime için, niye yazdın, denemekten önce bilinmesi gereken bir şey.

## Kurallar

- **İçerik İngilizce.** Egzersiz adları, açıklamalar, bölge etiketleri — tamamı İngilizce. Tüm program kütüphanesi aynı dili paylaşıyor ki JSON taşınabilsin; lokalizasyon UI string'leri için, içerik için değil.
- **Gerçek program.** Önce kendin yap. LLM dolgusu, "olabilir" programlar yollama.
- **Bir PR, bir program.** Üç varyantın varsa üç PR.
- **Coach linki senin hakkın, ama hak et.** `nofollow` olduğu için arama sıralamasına yardım etmez — ama gerçek kullanıcılar görüp tıklar. Onurlu bir kredi gibi davran, link spam'i gibi değil.
- **Markalı program adı kullanma.** "5/3/1", "Stronglifts" gibi başkasının markalı programını birebir paketleme. Esinlenmek tamam, kopyalamak değil.

## Mevcut preset'i güncelleme veya silme

Aynı akış — PR aç, dosyayı düzenle / sil, index'teki kaydı düzenle / sil. `id`'yi sabit tut. Kırıcı bir değişiklik yapacaksan yeni `id` ile yayınla.
