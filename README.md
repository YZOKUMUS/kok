# Kur’an Haritası (ayrı proje)

Hasene.V2’den bağımsız kök sözlük / ayet dizini projesi.

Kaynak referansı: [kuranharitasi.com](https://kuranharitasi.com)

## Yapı

```
KuranHaritasi/
  content/
    index.json          # kök listesi
    roots/{id}.json     # her kökün tam detayı + tüm ayet geçişleri
  web/                  # yerel görüntüleyici (genel bilgi + tüm ayetler)
  scripts/              # dump → JSON içe aktarma
  schema/               # JSON şema + TypeScript tipleri
  dumps/                # ham sayfa dump’ları (isteğe bağlı)
```

## Görüntüleyiciyi aç

JSON’ları `fetch` ile okuduğu için basit bir yerel sunucu gerekir:

```powershell
cd C:\Users\ziyao\Desktop\KuranHaritasi
python -m http.server 5177
```

Tarayıcı: http://localhost:5177/web/

## Yeni kök ekleme

Tüm kökleri siteden çekip `content/roots/` altına yazmak:

```powershell
python scripts\fetch_all_roots.py
```

Kimlik listesi `content/root-ids.json` dosyasındadır. Var olan dosyalar atlanır.

Tek sayfa dump’u için:

```powershell
python scripts\import_root_dump.py smw dumps\smw.txt
```

Dosya adı, Windows’ta büyük/küçük harf çakışmasın diye kodlanır: büyük harf `_` + küçük harf olur (`Hkm` → `_hkm.json`, `rHm` → `r_hm.json`). Görüntüleyici aynı kuralı kullanır.

## Durum

1818 kökün tamamı yüklü (`content/root-ids.json` ile `content/index.json` birebir). Her kökte sitedeki geçiş sayısı ile ayet listesi aynı uzunlukta.
