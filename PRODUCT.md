# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Electron masaüstü kabuğu içinde çalışan HTML/CSS/JS arayüz; Windows 10/11 hedefli. Çerçevesiz pencere, sistem tepsisi, sağ alt bildirim penceresi ve "Mini Görüntüleyici" her-zaman-üstte modu vardır.)

## Users

Bilinçli bireysel kullanıcı: kendi Windows bilgisayarının ağ trafiğini anlamak ve kontrol etmek isteyen ileri kullanıcı. Uygulamayı arka planda açık tutar, bir bildirim geldiğinde ya da "bilgisayarım şu an kiminle konuşuyor?" sorusu aklına geldiğinde ana pencereyi açar, kısa bir inceleme yapar ve gerekirse bir uygulamayı tek tıkla engeller.

## Product Purpose

DarkMirror, bilgisayardaki her uygulamanın ağ etkinliğini görünür kılar ve kullanıcının buna karar vermesini sağlar: canlı gelen/giden trafik grafiği, uygulama ve sunucu dökümü, 3B küre üzerinde ülke bağlantıları, Windows Güvenlik Duvarı üzerinden uygulama engelleme, veri kullanımı/kota, yerel ağ (LAN) cihaz taraması ve güvenlik uyarıları. Başarı: kullanıcı birkaç saniyede "ne oluyor, normal mi, ne yapmalıyım" sorularına cevap bulur.

## Positioning

Yerel çalışan, hesap/bulut gerektirmeyen, verisi kullanıcının diskinde (`%APPDATA%\DarkMirror\data\darkmirror.db`) kalan kişisel ağ aynası: bilgisayarın ağdaki yansımasını gösterir. Görselleştirme (canlı grafik + küre) ile tek tık eylem (engelle / izin ver / VirusTotal ile tara) aynı yerde.

## Operating Context

- Arka planda sürekli çalışır; sistem tepsisi ve sağ alt bildirim penceresi birincil temas noktasıdır.
- Ana pencere kısa, aralıklı oturumlarda açılır; Mini Görüntüleyici modunda ekranın köşesinde canlı grafik olarak durabilir. Kapat düğmesi pencereyi tepsiye gizler; çıkış menüden yapılır.
- Arayüz dili Türkçe.
- Gündüz ofis/ev ışığında da gece de kullanılır: açık ve koyu tema, Windows sistem ayarını izler; kullanıcı elle değiştirebilir.

## Capabilities and Constraints

- Sekmeler: GRAFİK (canlı grafik, zaman çizelgesi, 3B küre, uygulamalar/sunucular), GÜVENLİK DUVARI (DarkMirror kurallarını aç/kapat, Windows Defender Güvenlik Duvarı kuralı ile engelleme, VirusTotal özet sorgusu), KULLANIM (dönemler, arayüz toplamı, uygulamalara atanan TCP payı, kota, CSV), AĞ (ARP komşu tablosu, IEEE üretici adı, ad/not düzenleme, CSV), UYARILAR (kategori/önem filtreleri, okundu, sil).
- Ayrıntı pencereleri: uygulama bilgisi (SHA-256, imza, sunucular) ve sunucu bilgisi (ters DNS, ülke, uygulamalar).
- Masaüstü uygulaması (Electron); ağ portu açmaz. Motor `src/engine.mjs` (Node, `node:sqlite`), API `src/api.mjs` `app://` protokolüyle çalışır, canlı veri IPC ile gelir. Windows ölçümleri `native/dmprobe.cs` (TCP tablosu + bağlantı başına bayt, yönetici izniyle). Arayüz `public/` altında framework'süz HTML/CSS/ES modülü.
- Gelen ve giden trafik her ekranda iki sabit renkle ayrılır; bu ayrım ürünün temel okuma kodudur.
- Testler `tests/verify.mjs` ile motoru ve API'yi gerçek makinede doğrular; arayüz kimlikleri (`id`) korunmalıdır.

## Brand Commitments

- Ad: **DarkMirror**. Ton: sakin, dürüst, teknik ama korkutmayan; bireysel kullanıcıya hitap eder.
- Kimlik tamamen DarkMirror'a özgü olmalı; başka bir ürünün adı, ikonu veya varlığı kullanılmaz (kullanıcı kararı, 2026-10-21).
- Açık kaynak (MIT), GitHub üzerinden yayımlanır; kurulum GitHub Releases'taki Windows kurulum sihirbazıyla yapılır.
- Gösterilen her veri gerçek ölçümden gelir; ölçülemeyen değer "—" olarak gösterilir, tahminle doldurulmaz.
- Bildirim yalnızca tehlikeli veya bilinmeyen olaylarda gösterilir; bildirim sesi yoktur.

## Evidence on Hand

- Gerçek canlı telemetri (yerel makineden), gerçek LAN cihazları, gerçek uyarılar.
- Müşteri, referans, ödül, sertifika veya kıyaslama verisi yok; uydurulmamalı.

## Product Principles

1. Önce cevap, sonra ayrıntı: her ekran en üstte "şu an durum ne" sorusunu yanıtlar.
2. Her bulgunun yanında eylemi: engelle, izin ver, tara, dışa aktar.
3. Veri kullanıcınındır: yerel, şeffaf, açıklanabilir.
4. Alarm değil netlik: risk dili ölçülü; kırmızı yalnızca gerçek tehdit içindir.

## Accessibility & Inclusion

Uzun süre açık kalan bir izleme aracı: WCAG AA kontrast, renkle birlikte metin/ikon ile durum ayrımı (gelen/giden, izinli/engelli), klavye ile sekme gezintisi, `prefers-reduced-motion` desteği.
