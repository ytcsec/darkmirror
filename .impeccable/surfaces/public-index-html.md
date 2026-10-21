---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/notification.html"]
---

# Surface brief — DarkMirror ana penceresi + bildirim penceresi

Scope: public/index.html, styles.css, app.js, notification.html (Electron masaüstü uygulaması, tüm sekmeler). Visitor mode: Operate.
Audience/job: bilinçli bireysel kullanıcı; kısa oturumlarda "bilgisayarım kiminle konuşuyor, normal mi, ne yapmalıyım" sorusunu yanıtlar, tek tıkla engeller/izin verir.
Constraints: tüm `id`'ler ve davranış korunur; açık + koyu tema (sistemi izler, elle değiştirilebilir); başka ürünlerin adı/ikonu kullanılmaz.

## Direction contract

THESIS: Her bağlantı bir sınır geçişidir; DarkMirror pasaport memurudur. Kategorinin koyu-lacivert + parlayan camgöbeği "siber panel" düzenini reddeder: parlama yok, neon yok, sakin resmi belge dili.

OWN-WORLD: Açık tema güvenlik kâğıdı (#F2F3EE civarı, hafif yeşilimsi kırık beyaz) üstünde lacivert mürekkep (#14213D); koyu tema lacivert pasaport kapağı (#0E1526) üstünde kâğıt rengi mürekkep, yaldız (#C8A24A) yalnız marka işaretinde. Gelen = petrol mavisi giriş damgası mürekkebi, giden = koyu kehribar çıkış damgası mürekkebi, kırmızı yalnız tehdit. Giyoş (guilloche) rozet/şerit yalnız marka alanlarında (üst çubuk markası, boş durumlar, pasaport sayfası). Durum etiketleri damga çerçevesi: 1.5px mürekkep çizgili, küçük büyük harf, dolgu yok. Sayılar tabular, veri Cascadia Mono. Yazı: Public Sans (kamusal/devlet belgesi kimliği), kendi barındırılır.

STORY: Kullanıcı açar, üst çubukta canlı gelen/giden hızını ve sekmeleri görür; grafikte giriş/çıkış mürekkepleriyle trafiği okur; bir uygulamaya tıklar, uygulamanın "pasaportu" (yayımcı, imza, SHA-256, MRZ satırı) açılır; tek tıkla engeller ya da izin verir.

FIRST VIEWPORT: 52px üst çubuk: solda menü + DarkMirror ayna işareti ve wordmark, ortada 5 sekme (aktif sekme alt kenarda 2px mürekkep çizgisi, parlama yok), sağda mono canlı hız göstergesi ve pencere kontrolleri. Altında araç çubuğu, sonra kâğıt zeminde canlı grafik (ince ızgara, giriş/çıkış mürekkep alanları), altta Uygulamalar | Sunucular tabloları. Birincil eylem: satır üstündeki Engelle/İzin damgası.

FORM: Sınır Kapısı (pasaport veri sayfası + giriş/çıkış damgaları); grounded listemde 6. sıra; seed key 6bdbd2fb. Raises: Ikeda → tabular sayı sütunları; centre-rail → durumlar basılı işaret, renk tek başına durum taşımaz; Crouwel → logo/ikonlar 4px modül ızgarası. İmza etkileşimi: uygulama ayrıntısı pasaport veri sayfası olarak açılır, alttaki MRZ satırı uygulama verisinden üretilir; engelleme anında "ENGELLENDİ" damgası 160ms basılır.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
