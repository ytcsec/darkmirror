---
name: DarkMirror
description: Kişisel ağ aynası; her bağlantı bir sınır geçişi, arayüz pasaport memurunun masası.
colors:
  paper: "#f3f4ef"
  paper-2: "#eceee7"
  sheet: "#fafbf7"
  hover: "#e5e8df"
  press: "#dce0d5"
  rule: "#cfd4c7"
  rule-soft: "#e0e3da"
  ink: "#14213d"
  ink-2: "#44506a"
  ink-3: "#5c6680"
  in: "#0e6c78"
  out: "#95570c"
  ok: "#2c6a39"
  threat: "#b3261e"
  on-threat: "#ffffff"
  caution: "#7a3f8c"
  foil: "#9c7a2a"
  focus: "#0e6c78"
typography:
  headline:
    fontFamily: "Public Sans, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Public Sans, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Public Sans, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  control:
    fontFamily: "Public Sans, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Public Sans, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
  data:
    fontFamily: "Cascadia Mono, Cascadia Code, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  data-lg:
    fontFamily: "Cascadia Mono, Cascadia Code, Consolas, monospace"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  mrz:
    fontFamily: "OCR-B, OCR B, Cascadia Mono, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.14em"
rounded:
  stamp: "3px"
  md: "4px"
  lg: "6px"
  pill: "9px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 13px"
    height: "30px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "30px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    size: "32px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "30px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    padding: "0 14px"
  tab-active:
    textColor: "{colors.ink}"
  stamp-allowed:
    backgroundColor: "transparent"
    textColor: "{colors.ok}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "0 7px"
    height: "22px"
  stamp-blocked:
    textColor: "{colors.ink}"
  stamp-caution:
    textColor: "{colors.caution}"
  stamp-threat:
    textColor: "{colors.threat}"
  stamp-neutral:
    textColor: "{colors.ink-3}"
  gate-toggle:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ok}"
    rounded: "{rounded.md}"
    size: "36px"
  gate-toggle-blocked:
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  modal:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    width: "640px"
---

# Design System: DarkMirror

## Overview

**Creative North Star: "Sınır Kapısı"**

Her ağ bağlantısı bir sınır geçişidir ve DarkMirror pasaport memurudur. Arayüz bir siber panel değil, resmi bir belge masasıdır: açık temada güvenlik kâğıdı üzerinde lacivert mürekkep, koyu temada lacivert pasaport kapağı üzerinde kâğıt rengi mürekkep. Parlama, neon ve ışıyan kenarlar yoktur; durum, basılı işaretlerle (damgalar, çizgiler, mürekkep renkleri) okunur.

Yoğunluk bir masaüstü izleme aracınınkidir: 13px gövde, 52px üst çubuk, 54-56px satırlar, tabular sayılar ve Cascadia Mono veri sütunları. Kâğıt katmanları (zemin, ikinci zemin, sayfa) ince 1px çizgilerle ayrılır; gölge yalnız masanın üstünde duran yüzen sayfalarda görülür. Belge dünyasının kendi cihazları (giyoş şeridi ve rozeti, MRZ satırı, vesikalık çerçevesi, giriş/çıkış damgaları) yalnız kimlik taşıdıkları yerlerde kullanılır.

Kategorinin koyu lacivert + parlayan camgöbeği "siber panel" düzeni reddedilir. Kırmızı alarm dili de reddedilir: kırmızı yalnız gerçek tehdittir; kullanıcının kendi engelleme kararı mürekkeple yazılır.

**Key Characteristics:**
- Kâğıt + mürekkep: düz, mat yüzeyler; derinlik çizgiyle ve ton katmanıyla.
- İki sabit mürekkep: gelen = petrol, giden = kehribar; her ekranda aynı.
- Durumlar damga çerçevesidir: 1.5px çizgi, büyük harf, dolgu yok, her zaman metin + renk.
- Veri mono ve tabular; etiketler 11px büyük harf alan adı.
- Hareket kısa ve damga gibi: 160ms basma, ease-out, azaltılmış hareket desteklenir.

## Colors

Kâğıt ve mürekkep paleti: nötr zeminler hafif yeşilimsi kırık beyaz, tek ana mürekkep lacivert; anlamlı renkler yalnız yön (gelen/giden) ve şiddet (dikkat/tehdit) taşır. Tüm değerler `:root` üzerindeki `--dm-*` özel özellikleridir; koyu tema aynı adları `prefers-color-scheme: dark` (`:root:not([data-theme="light"])`) ve `:root[data-theme="dark"]` altında yeniden tanımlar. Kanvas grafikleri ve küre renkleri `themeColors()` ile çizim anında bu değişkenlerden okur; JS içinde sabit renk yazılmaz.

### Primary
- **Lacivert Mürekkep** (`ink`; koyu temada kâğıt mürekkebi #ecede6): ana metin, birincil buton dolgusu (`--dm-primary` = ink), aktif sekme çizgisi, engellenmiş durum, okunmamış uyarı rozeti, kota dolgusu. Kullanıcının kararı ve sistemin sesi bu mürekkeple yazılır.

### Secondary
- **Petrol Giriş Damgası** (`in`; koyu #55c3cd): gelen trafik, her yerde: grafik eğrisi ve alanı, satır altı pay çubuğu, tablo sütunu, KPI, küre rotaları. Odak halkası (`focus`) aynı mürekkebi paylaşır; okunmamış nokta da petroldür.
- **Kehribar Çıkış Damgası** (`out`; koyu #e3a552): giden trafik, aynı yerlerde petrolün eşi; ayrıca duraklatılmış durum ve güvenlik duvarı sekmesindeki bekleyen rozet.

### Tertiary
- **Onay Yeşili** (`ok`; koyu #74c48a): izinli damga, açık geçit çubuğu, "koruma etkin" satırı, açık güvenlik duvarı anahtarı, çevrimiçi cihaz noktası.
- **Dikkat Moru** (`caution`; koyu #c9a0e0): önemli/uyarı şiddeti (damga, uyarı ikonu halkası, imzasız işareti). Tehdit olmayan ama bakılması gereken her şey.
- **Tehdit Kırmızısı** (`threat`; koyu #ff7666, üzerinde `on-threat`): yalnız gerçek tehdit: şüpheli bağlantı, ARP yanıltma, kritik/tehlike şiddeti, grafikteki güvenlik olayı işaretleri, kapalı koruma ("koruma kapalı", kapalı güvenlik duvarı), çıkış eyleminin üzerine gelme durumu.
- **Yaldız** (`foil`; koyu #c8a24a): yalnız marka işaretinin yansıma yarısı (`--dm-mark-reflect`). Koyu temada giyoş tonu (`--dm-guilloche`) yaldızdan türetilir; giyoş da yalnız marka alanlarında yaşar.

### Neutral
- **Güvenlik Kâğıdı** (`paper`; koyu #0e1526): uygulama zemini, alt araç çubukları, liste alanları.
- **İkinci Kâğıt** (`paper-2`; koyu #121b30): üst çubuk, tablo başlıkları, küre sahnesi, ağ kenar çubuğu, MRZ şeridi, engellenmiş tablo satırı, segment zemini.
- **Sayfa** (`sheet`; koyu #16213a): grafik sahnesi, kartlar, girişler, menü, modal, bildirim; zeminden bir ton açık, "masadaki kâğıt".
- **Üzerine Gelme / Basma** (`hover` #e5e8df, `press` #dce0d5; koyu #1c2945 / #223154): etkileşim tonları; renkli vurgu kullanılmaz.
- **Çizgi / Yumuşak Çizgi** (`rule`, `rule-soft`; koyu #2a3a5e / #1e2b49): bölüm sınırları ve kenarlıklar `rule`, satır ayraçları ve iç ayraçlar `rule-soft`.
- **İkincil / Üçüncül Mürekkep** (`ink-2`, `ink-3`; koyu #b2b9c9 / #8d96ab): yardımcı metin, alan etiketleri, eksen yazıları, nötr damga.

### Named Rules
**The Kırmızı Yalnız Tehdit Rule.** `threat` yalnız gerçek tehdit ve korumanın kapalı olduğu durumlar içindir. Engellenmiş bir uygulama kullanıcının kararıdır ve `ink` ile yazılır (damga, geçit, rozet). Tek istisna platformun kendisidir: pencere kapatma düğmesinin Windows kırmızısı (#c42b1c) bir işletim sistemi kuralıdır, paletin parçası değildir.

**The İki Mürekkep Rule.** Gelen her zaman `in`, giden her zaman `out`; grafik, tablo, satır çubuğu, KPI, ipucu, modal alanı ve küre aynı kodu kullanır. Bu iki renk başka bir anlam taşımaz ve yön bilgisi her zaman "gelen/giden" metniyle ya da ok ikonuyla birlikte gelir.

**The Yaldız Mühürdedir Rule.** `foil` yalnız marka işaretinde görünür (koyu temada giyoşun tonu olarak da). Arayüz öğeleri, durumlar ya da grafikler yaldız kullanmaz.

## Typography

**Display Font:** yok; en büyük metin 24px veridir.
**Body Font:** Public Sans (değişken, 100-900, `public/fonts/` altında kendi barındırılır, latin + latin-ext), yedek Segoe UI Variable Text, Segoe UI, system-ui
**Label/Mono Font:** Cascadia Mono (yedek Cascadia Code, Consolas); MRZ satırı OCR-B varsa onu, yoksa aynı mono yığını kullanır.

**Character:** Public Sans kamusal belge yazısıdır: sakin, açık, resmi. Cascadia Mono veriyi makine çıktısı gibi hizalar; ikisi birlikte "doldurulmuş form" okur. Gövde genelinde `font-feature-settings: "tnum" 1` açıktır, rakamlar her yerde tabulardır.

### Hierarchy
- **Headline** (700, 18px, 1.25, -0.015em): modal (pasaport sayfası) başlığı.
- **Title** (700, 14-15px, -0.01em): uyarı başlığı, cihaz adı (14.5px), menü başlığı, boş durum başlığı; marka wordmark 15px / 750 / -0.02em.
- **Body** (400, 13px, 1.4): satır başlıkları (600), açıklamalar (1.5 satır yüksekliği, en fazla 75ch), menü öğeleri.
- **Control** (600, 12.5px): butonlar, segmentler, girişler, yardımcı satırlar; kompakt yerlerde 12px.
- **Label** (700, 11px, 0.07-0.08em, büyük harf): alan adları (modal anahtar-değer, cihaz kartı `dt`), tablo sütun başlıkları, bölme başlıkları, KPI etiketleri, damgalar (750).
- **Data** (Cascadia Mono 600, 11-12.5px): hızlar, baytlar, IP, saat, SHA-256, ülke kodu, eksen yazıları (kanvasta 11px mono); KPI değerleri 24px / -0.02em, halka merkezi 15px.
- **MRZ** (mono, 12.5px, 0.14em harf aralığı, 1.6): pasaport sayfasının alt şeridi, `white-space: pre`.

### Named Rules
**The 11px Taban Rule.** Hiçbir metin 11px'in altına inmez; kanvas yazıları dahil. Küçük yardımcı metinler 11-11.5px'te durur.

**The Veri Mono'dadır Rule.** Ölçülen, kopyalanan ya da karşılaştırılan her değer (hız, bayt, IP, saat, hash, ülke kodu) mono ve tabulardır; adlar ve cümleler Public Sans'tadır.

**The Alan Etiketi Rule.** 11px büyük harf etiket yalnız bir değere ya da sütuna bağlı alan adıdır (pasaporttaki "DOSYA YOLU" gibi). Bir başlığın üstünde süs olarak duran bağımsız üst etiket kullanılmaz.

## Layout

Çerçevesiz Electron penceresi tam ekran bir sütundur: 52px üst çubuk (sol: menü + marka + hızlı modlar; orta: 5 sekme; sağ: mono canlı hızlar + pencere kontrolleri; `grid-template-columns: 1fr auto 1fr`), en az 52px alt araç çubuğu (`flex-wrap`), sonra görünüm. Grafik görünümünde sahne yüksekliğin %46'sı (en az 240px; küre %48, en az 270px), altında 36px zaman çizelgesi, kalan alanda iki eşit bölme (Uygulamalar | Sunucular). Güvenlik duvarı sabit düzenli bir tablodur (başlık 36px, satır 56px); kullanım bir kahraman şeridi (144px halka + üç KPI) ve üç sütun; ağ 280px kenar çubuğu + `minmax(290px, 1fr)` kart ızgarası; uyarılar tek sütun zaman çizelgesi.

Boşluk ritmi 4px tabanlıdır: 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24. Bölme kenar boşluğu 16px, modal 20px, kahraman şeridi 24px. Kontroller 26-32px, satırlar 54-56px yüksekliğindedir. Bölümler boşlukla değil 1px çizgiyle ayrılır.

Duyarlılık: ≤1240px'te üst çubuk `auto 1fr auto` olur, hızlı modlar, "koruma etkin" satırı ve mini görüntüleyici düğmesi gizlenir, sekme dolgusu 9px'e iner, canlı hızlar 11.5px'e küçülür, güvenlik duvarı tablosunun 3. sütunu (son görülme) düşer. ≤980px'te kullanım sütunları ikiye iner. Mini Görüntüleyici modu yalnız grafik sahnesini bırakır.

## Elevation & Depth

Sistem düzdür ve ton katmanlıdır: kâğıt (`paper`) < ikinci kâğıt (`paper-2`) < sayfa (`sheet`), aralarında 1px `rule`. Gölge yalnız zeminin üstünde yüzen kâğıtlarda görünür: menü, modal, bildirim kartı, grafik ipucu, küre ülke paneli. Koyu temada gölgeler siyaha döner ve koyulaşır. Küre kendi ışığını taşır (sol üst ana ışık, alt sağ terminatör, altında temas gölgesi); bu, kâğıt üstüne konmuş bir nesne metaforudur ve yalnız kürede kullanılır.

### Shadow Vocabulary
- **Yüzen kâğıt** (`box-shadow: var(--dm-shadow)` = `0 1px 2px rgba(20, 33, 61, 0.06), 0 6px 14px -6px rgba(20, 33, 61, 0.24)`): grafik ipucu, küre ülke paneli.
- **Üst kâğıt** (`box-shadow: var(--dm-shadow-lg)` = `0 2px 4px rgba(20, 33, 61, 0.08), 0 14px 22px -10px rgba(20, 33, 61, 0.36)`): açılır menü, modal, uygulama içi bildirim.
- **Vesikalık çerçevesi** (`box-shadow: inset 0 0 0 2px var(--dm-sheet), inset 0 0 0 3px var(--dm-rule-soft)`): uygulama/sunucu baş harf kutusunun çift çizgisi; derinlik değil, baskı.

### Named Rules
**The Masadaki Kâğıt Rule.** Yerinde duran yüzeylerin gölgesi yoktur; gölge yalnız yüzen bir kâğıdın (menü, modal, bildirim, ipucu, HUD) işaretidir. Parlama (glow) ve renkli gölge yoktur.

## Shapes

Köşeler belge gibi az yuvarlaktır: kontroller ve ikon düğmeleri 4px, kartlar/menü/modal/segment 6px, damgalar, etiketler, vesikalık çerçevesi ve ülke kodu kutusu 3px. Tam yuvarlak yalnız işlevsel nesnelerde: rozet ve anahtar (9px), durum noktaları ve uyarı ikonu halkası (daire). Kenarlıklar 1px; damga ve kod kutusu çerçeveleri 1.5px `currentColor`.

İkonlar tek bir 24px ızgaralı SVG sprite'tır (`index.html` içinde `<symbol id="i-*">`): dolgu yok, `stroke: currentColor`, 1.75 çizgi, yuvarlak uç ve birleşim; 16px (`.i`) ve 14px (`.i-sm`) boyutlarında, damga içinde 13px / 2.2 çizgi. Geçit ikonları (`i-gate-open` kalkık bariyer, `i-gate-closed` inik bariyer) 3px kol çizgisiyle sınır kapısını çizer. Marka işareti (`dm-mark`) 32px ızgarada yarım dolu ayna: sol yarı mürekkep, sağ yarı yaldız yansıma çizgileri.

## Components

### Buttons
Sakin ve basılı; renk değil kenar ve ton değişir.
- **Shape:** 4px köşe, 30px yükseklik (alert ve bildirim içinde 28px), 7px ikon aralığı.
- **Primary:** `ink` dolgu, `paper` metin, 0 13px dolgu, 600 / 12.5px. Ekran başına bir tane (ör. "Kural ekle", "Grafikte göster").
- **Hover / Focus:** birincil %90 opaklık, basınca 1px aşağı; ikincil (`sheet` + `rule` kenar) üzerine gelince `hover` zemin + `ink-3` kenar, basınca `press`; odakta 2px `focus` çizgi, 2px ofset. Devre dışı %55 opaklık.
- **Secondary:** sayfa rengi, 1px `rule` kenar, `ink` metin. "Engelle" ve "İzin ver" de ikincildir ve `ink` yazılır; kırmızıya boyanmaz. Etkin hal `ink` kenar, duraklatılmış hal `out` kenar + metin.
- **Icon:** 32px şeffaf kare, `ink-2`; üzerine gelince `hover` + `ink`.

### Chips
- **Style:** sekme rozetleri 18px yüksek, 9px yuvarlak, 11px / 700 tabular: nötr (`hover` zemin, `ink-2`), okunmamış uyarı (`ink` dolgu), bekleyen güvenlik duvarı (`out` %16 zemin, `out` metin). Uyarı meta etiketleri 3px köşe, 1px `rule`, mono 11.5px, `paper` zemin.
- **Segment:** `paper-2` zeminde 2px iç boşluklu grup; etkin segment `sheet` + `rule` kenar + çok ince gölge.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** `sheet`.
- **Shadow Strategy:** yerinde kartlar gölgesiz (bkz. Elevation & Depth); yalnız yüzenler gölgeli.
- **Border:** 1px `rule`; üzerine gelince `ink-3`.
- **Internal Padding:** 14px 16px; meta alanı `rule-soft` üst çizgiyle ayrılan iki sütunlu `dt/dd` ızgarası (11px büyük harf etiket + değer, mono değerler 11.5px).

### Inputs / Fields
- **Style:** `sheet` zemin, 1px `rule`, 4px köşe, 30px (form içinde 36px), 12.5px, `ink-3` yer tutucu.
- **Focus:** kenar `focus` (petrol) + `0 0 0 3px` %18 petrol halka.
- **Error / Disabled:** ayrı bir hata stili yoktur; form alanı etiketi 12.5px / 600 `ink-2`, ipucu 12px `ink-3`.

### Navigation
- **Style:** üst çubukta ortalanmış 5 metin sekmesi, 13px / 600 `ink-2`, 0 14px dolgu (≤1240px'te 9px). Etkin sekme 700 `ink` ve alt kenarda 2px `ink` çizgi; çizgi `scaleX` ile 0.28s ease-out açılır. Parlama ve dolgu yok. Açılır menü 284px, 6px köşe, üst kâğıt gölgesi, başlığında giyoş şeridi.

### Stamp Status Marks (Signature)
Durumlar damgadır: 22px yükseklik, 0 7px, 1.5px `currentColor` çerçeve, 3px köşe, dolgu yok, 11px / 750 / 0.07em büyük harf, isteğe bağlı 13px ikon (2.2 çizgi). Renkler: izinli `ok`, engelli `ink`, dikkat `caution`, tehdit `threat`, nötr `ink-3`. Engelleme ya da izin anında ilgili damga 160ms basılır (`dmStamp`: 1.18 ölçekten 1'e, 0.2 opaklıktan 1'e, `cubic-bezier(0.3, 0, 0.2, 1)`).

### Gate Toggle (Signature)
Engelle/izin geçişi sınır kapısı bariyeridir: 36px kare (satır üstünde 32px), `sheet` + 1px `rule`, 4px köşe. Açık: kalkık bariyer `ok`. Kapalı: inik bariyer, `ink` ikon ve `ink` kenar. Uygulama satırlarında üzerine gelince ya da engelliyken görünür.

### Passport Data Page (Signature)
Uygulama/sunucu ayrıntısı bir pasaport veri sayfasıdır: 640px (en fazla %92 genişlik) `sheet`, 6px köşe, üst kâğıt gölgesi; başlıkta 52×64px vesikalık çerçevesi + 18px başlık, başlığın alt kenarında 12px giyoş şeridi. Gövde iki sütunlu alan ızgarası (11px büyük harf alan adı + 600 değer, `rule-soft` ayraç); renkli değerler aynı kodu izler (`in`, `out`, `ok`, `caution`, `threat`). En altta `paper-2` zeminli MRZ şeridi uygulama verisinden üretilir (ad, yayımcı, hash, imza, geçit, gelen/giden KB, TR). Açılış 0.32s ease-out (10px yukarı + 0.985 ölçek), örtü `--dm-scrim`.

### Severity Code
Tek şiddet kodu her yüzeyde aynıdır (`severityStamp()`): bilgi = nötr, önemli/uyarı = dikkat moru, tehlike/kritik ve tehdit türleri (şüpheli bağlantı, ARP değişimi) = tehdit kırmızısı. Uyarı kartı ikon halkası, kategori damgası ve bildirim penceresi aynı eşlemeyi kullanır.

### Guilloche
Giyoş iki biçimde ve yalnız iki yerde vardır: modal ve açılır menü başlıklarının alt kenarında şerit (`guilloche-band.svg`, maske, 10-12px yükseklik) ve boş durumların 132px rozeti (`guilloche-rosette.svg`). Rengi `--dm-guilloche` (açıkta %22 mürekkep, koyuda %32 yaldız). Maske olarak uygulanır, böylece temayı izler.

### Engraved Globe
Dünya haritası gravür bir küredir: Natural Earth 110m kıyı çizgileri, sol üstten aydınlatılmış kâğıt küre, yatay tarama çizgili kara (mürekkep %6-10 dolgu, %16-20 tarama), kenara doğru solan 15°'lik graticule (ekvator daha koyu), camdan görünen soluk arka yüz, çift gravür çerçeve, altında eliptik temas gölgesi. Rotalar Türkiye'den çıkan büyük daire yaylarıdır: `in` mürekkebi, kalınlık ve opaklık hacimle; yay boyunca kehribar (`out`) kısa iz akar. Hedefler `sheet` dolgulu `ink` halka + çekirdek, etiketler mono 11px / 600 kısa öncü çizgili 3px köşeli kutu; ev konumu 11px mürekkep kare. Azaltılmış hareket tercihinde otomatik dönüş, iz ve nabız halkaları durur.

### Rows
Uygulama/sunucu satırı en az 54px: solda 32px vesikalık çerçevesi (mono baş harfler), 13px / 600 ad + 11.5px `ink-3` alt satır, sağda mono toplam + "gelen · giden" satırı; altında 2px iki mürekkepli pay çubuğu (petrol | kehribar).

## Do's and Don'ts

### Do:
- **Do** her rengi `--dm-*` değişkenlerinden al; kanvas çizimlerinde `themeColors()` ile çizim anında oku ki iki tema da doğru çizilsin.
- **Do** gelen için `in`, giden için `out` kullan ve yönü her zaman metinle ya da okla da söyle.
- **Do** durumları damga olarak bas: 1.5px `currentColor` çerçeve, büyük harf, dolgu yok, metin + renk birlikte.
- **Do** engellenmiş durumu, engelle düğmesini ve engelli geçidi `ink` ile yaz; şiddeti yalnız `severityStamp()` eşlemesiyle renklendir.
- **Do** ölçülen her değeri Cascadia Mono ve tabular yaz; metni 11px'in altına indirme.
- **Do** ikonları 24px ızgaralı sprite'tan, 1.75 çizgi, dolgusuz kullan; engelle/izin geçişi için geçit bariyeri ikonlarını kullan.
- **Do** hareketi kısa tut (menü 0.18s, görünüm 0.24s, modal 0.32s, damga 160ms), `cubic-bezier(0.16, 1, 0.3, 1)` ile çık ve `prefers-reduced-motion` altında animasyonu ve kürenin kendi hareketini durdur.

### Don't:
- **Don't** kırmızıyı tehdit ve kapalı koruma dışında kullanma; kullanıcının engelleme kararı kırmızı değildir.
- **Don't** parlama, neon, renkli gölge ya da koyu lacivert + parlayan camgöbeği "siber panel" görünümü ekleme.
- **Don't** yaldızı (`foil`) marka işareti dışında kullanma.
- **Don't** giyoşu modal/menü başlık şeridi ve boş durum rozeti dışına taşıma; arka plan dokusu ya da kart süsü yapma.
- **Don't** damgaları doldurma ya da yuvarlak hap rozete çevirme.
- **Don't** yerinde duran kartlara ve bölmelere gölge verme; ayrımı 1px çizgi ve ton katmanıyla yap.
- **Don't** başlıkların üstüne bir değere bağlı olmayan büyük harf üst etiket koyma.
