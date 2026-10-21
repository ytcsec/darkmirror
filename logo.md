# DarkMirror — Logo Brifi

Bu belge, DarkMirror logosunu tasarlayacak kişiye (veya bir görsel üretim aracına) verilecek brifin tamamıdır. Projenin ne olduğu, kime hitap ettiği, marka kimliğinin kuralları ve logodan teknik olarak ne beklendiği burada yazıyor. Uygulamada şu anda geçici bir işaret kullanılıyor (bkz. §6); bu brif onun yerine geçecek son logoyu ya da onun rafine edilmiş hâlini üretmek için yazıldı.

---

## 1. Proje tek cümlede

**DarkMirror, Windows bilgisayarınızın ağdaki yansımasını gösteren kişisel bir ağ izleme ve güvenlik duvarı uygulamasıdır: hangi uygulama, hangi ülkedeki hangi sunucuyla, ne kadar veri alışverişi yapıyor. Gerekirse tek tıkla engellersiniz.**

## 2. Ürün ne yapıyor?

DarkMirror, arka planda sürekli çalışan bir Electron masaüstü uygulamasıdır. Sistem tepsisinde durur, ekranın sağ alt köşesinde bildirim gösterir. Ana penceresinde beş bölüm vardır:

| Bölüm | Kullanıcıya ne sağlar |
| --- | --- |
| **Grafik** | Gelen ve giden trafiğin canlı grafiği, altında zaman çizelgesi. Uygulamalar ve sunucular listesi. Bağlanılan ülkeleri gösteren döndürülebilir 3B dünya küresi. |
| **Güvenlik Duvarı** | Her uygulama için "geçit": izin ver ya da engelle (Windows Güvenlik Duvarı / `netsh` üzerinden). Çalışma modları, profiller (Ev, Oyun, Kısıtlı…), VirusTotal ile dosya taraması. |
| **Kullanım** | Bugün / 7 gün / 30 gün veri kullanımı, gelen-giden oranı, internet (WAN) ve yerel ağ (LAN) ayrımı, aylık kota, CSV dışa aktarma. |
| **Ağ** | Yerel ağdaki cihazları tarar (ARP): IP, MAC, üretici, tür. Cihazlara ad ve not verilebilir. |
| **Uyarılar** | İlk kez ağa çıkan uygulama, yeni ağ cihazı, DNS değişikliği, ARP yanıltma şüphesi, şüpheli bağlantı gibi olayların zaman çizelgesi. |

Bir uygulamaya tıklandığında, o uygulamanın **"pasaport sayfası"** açılır: dosya yolu, dijital imza, SHA-256 özeti, VirusTotal sonucu, gelen/giden veri, bağlandığı sunucular ve en altta uygulamanın verisinden üretilmiş, pasaportlardaki gibi makine tarafından okunabilir bir kimlik satırı (MRZ).

**Teknik gerçekler** (logo bunlarla çelişmemeli):
- Tamamen yerel çalışır. Hesap, bulut veya abonelik yoktur; veri kullanıcının diskindeki `data/darkmirror.db` dosyasında kalır.
- Windows 10/11 içindir. Arayüz dili Türkçedir.
- Elimizde müşteri, ödül, sertifika veya kıyaslama verisi yok. Logo ve sunum materyali böyle iddialar ima etmemelidir.

## 3. Kime hitap ediyor?

**Bilinçli bireysel kullanıcı.** Kendi bilgisayarını tanımak ve kontrol etmek isteyen ileri düzey bir Windows kullanıcısı. Kurumsal bir SOC analisti değil, korkutulmak isteyen biri de değil. Uygulamayı arka planda açık tutar. Bir bildirim geldiğinde ya da aklına "bilgisayarım şu an kiminle konuşuyor?" sorusu takıldığında pencereyi açar, kısa bir göz atar, gerekirse bir uygulamayı engeller.

Logonun bu kişiye vermesi gereken his: **"Kontrol bende, burada dürüst bir ayna var."** "Tehlikedesin, hacker'lar her yerde" hissini vermemelidir.

## 4. İsim: "DarkMirror"

- **Mirror (ayna):** Uygulama, bilgisayarın ağdaki görünmeyen yansımasını gösterir. Normalde göremediğiniz trafiği görünür kılar.
- **Dark (karanlık):** Arka planda, sessizce, görünmeyen tarafta olup biteni gösterir. Kötülük veya karanlık web anlamında **değildir**.
- Logo, ismin "korkutucu" okumasına kaymamalıdır: kafatası, kapüşonlu hacker, yeşil matris yağmuru, kırık ayna veya şeytani göz kullanılmamalıdır.

## 5. Marka kimliği: "Sınır Kapısı"

Görsel dünyanın çıkış noktası şu fikir: **Her ağ bağlantısı bir sınır geçişidir, DarkMirror da pasaport memurudur.** Kimin, nereden, hangi imzayla geçtiğine bakar ve damgasını basar. Bu yüzden kimlik, pasaport veri sayfasının, güvenlik baskısının ve giriş/çıkış damgalarının diliyle konuşur. Ancak bu dil kostüme dönüşmez: sakin, resmî ve okunaklı kalır.

### 5.1 Kişilik
| Olduğu | Olmadığı |
| --- | --- |
| Sakin, resmî, güven veren | Alarmcı, korku satan |
| Dürüst, şeffaf, açıklayıcı | Gizemli, "elit hacker" |
| Hassas, ölçülü, belge gibi | Neon, parlayan, oyunsu "siber" estetik |
| Kişisel ve yerel | Kurumsal bulut, abonelik |

### 5.2 Renk paleti (uygulamada kullanılan gerçek değerler)

**Açık tema: güvenlik kâğıdı + lacivert mürekkep**
| Rol | Hex | Kullanım |
| --- | --- | --- |
| Kâğıt (zemin) | `#F3F4EF` | Ana zemin, hafif yeşilimsi kırık beyaz |
| Yaprak (yüzey) | `#FAFBF7` | Kartlar, pencereler |
| Mürekkep | `#14213D` | Metin, logo, birincil düğme |
| Yaldız | `#9C7A2A` | Yalnız logo yansıması ve marka anları |
| Gelen (giriş damgası) | `#0E6C78` | Petrol mavisi |
| Giden (çıkış damgası) | `#95570C` | Koyu kehribar |
| İzinli | `#2C6A39` | Yeşil damga |
| Tehdit | `#B3261E` | **Yalnız gerçek tehdit** |

**Koyu tema: lacivert pasaport kapağı + kâğıt rengi mürekkep**
| Rol | Hex |
| --- | --- |
| Kapak (zemin) | `#0E1526` |
| Yüzey | `#16213A` |
| Mürekkep | `#ECEDE6` |
| Yaldız | `#C8A24A` |
| Gelen / Giden | `#55C3CD` / `#E3A552` |

**Logo için ana renkler:** Lacivert `#14213D`, kâğıt beyazı `#F3F4EF`, yaldız `#C8A24A`. Logo tek renkte de (yalnız lacivert ya da yalnız beyaz) çalışmalıdır.

### 5.3 Yazı tipi
- **Public Sans** (açık lisanslı, OFL). Kamu kurumlarının belge kimliği için tasarlanmış bir grotesk; resmî ve dürüst bir ses. Arayüzün tamamında kullanılıyor. Wordmark için ağırlık 700–750, harf aralığı −0.02em. Türkçe karakterlerin tamamını destekler.
- **Cascadia Mono:** yalnız veri, sayı ve MRZ satırı için. Logoda kullanılmaz.
- Wordmark yazımı: **DarkMirror**. Tek kelime, iki büyük harf (D ve M), boşluksuz. "Dark Mirror", "DARKMIRROR" veya "Darkmirror" yazılmaz.

### 5.4 Görsel motifler
- **Giyoş (guilloche):** Banknot ve pasaportlardaki ince, iç içe geçmiş dalga desenleri. Uygulamada pencere başlıklarının altında ince bir şerit ve boş ekranlarda bir rozet olarak kullanılıyor (`public/brand/guilloche-band.svg`, `guilloche-rosette.svg`).
- **Damga:** Durum etiketleri, dolgusu olmayan ve 1.5 px mürekkep çerçeveli küçük büyük harflerdir (İZİNLİ / ENGELLİ).
- **Geçit bariyeri:** Güvenlik duvarı simgesi bir sınır kapısı bariyeridir. Kol kalkıksa izinli, inikse engelli.
- **MRZ satırı:** `A<DMRWPSCLOUDSVR<<WPS<SOFTWARE<PTE<LTD<<<<<<`

## 6. Mevcut geçici işaret ve mantığı

Dosyalar: `public/brand/mark.svg` (tek renk), `public/brand/app-icon.svg` (renkli uygulama ikonu), `public/icon.png` (256 px), `public/icon.ico` (16–256 px).

**Kurgu:** Bir ayna düzleminin (ortadaki dikey boşluk) iki yanında sırt sırta duran iki "D" harfi. Birlikte bir mercek ya da göz biçimi oluştururlar.
- **Sol D (gerçek):** Dolu, düz mürekkep. Bilgisayarın kendisi.
- **Sağ D (yansıma):** Yatay oyma çizgilerle (gravür / güvenlik baskısı taraması) doldurulmuş, yaldız renkli. Bilgisayarın ağdaki yansıması, yani DarkMirror'ın gösterdiği şey.
- **Ortadaki boşluk:** Ayna yüzeyi, aynı zamanda sınır çizgisi.
- 32 birimlik ızgarada, 4 birimlik modülle çizildi. Oyma çizgileri 4 birim arayla ve 2 birim kalınlıkta.

Bu işaret konsepti doğru taşıyor ama rafine edilmeye açık. Logo tasarımcısı bu fikri geliştirebilir ya da aynı ilkelere uyan yeni bir işaret önerebilir.

## 7. Logodan beklenenler

### 7.1 Taşıması gereken fikirler (öncelik sırasıyla)
1. **Yansıma / ayna:** gerçek ve yansıması, iki yarı, simetri.
2. **Sınır / geçit:** bir çizgi, bir eşik, kontrol noktası.
3. **Belge güvenilirliği:** gravür, giyoş ya da damga dili. Pasaport, banknot.
4. **D ve M harfleri:** isteğe bağlı. Kullanılacaksa soyut ve zarif olmalı.

### 7.2 Kesinlikle kaçınılacaklar
- **Başka bir ağ izleme ürününe benzerlik.** Logo, piyasadaki ağ izleme ve güvenlik duvarı uygulamalarının simgelerini, renklerini (camgöbeği/turkuaz parlayan çizgiler) veya formlarını hatırlatmamalıdır. Kimlik tamamen DarkMirror'a özgü olmalıdır.
- Kalkan + kilit + asma kilit klişesi, kafatası, kapüşonlu figür, matris yağmuru, devre kartı çizgileri.
- Neon parlama, iç ışıma, gradyan metin, cam efekti.
- Kırık ayna (kötü şans, kırılganlık çağrışımı yapar).
- Kırmızı ana renk (kırmızı arayüzde yalnız tehdit için ayrılmıştır).
- Dünya küresi + ağ çizgileri klişesi (her ağ ürününde var).

### 7.3 Teknik gereksinimler
| Kullanım | Boyut | Not |
| --- | --- | --- |
| Sistem tepsisi | **16×16**, 20×20, 24×24 | En zor test: 16 px'de okunur olmalı. Gerekirse sadeleştirilmiş küçük boy çizimi hazırlanmalı. |
| Pencere / görev çubuğu | 32, 40, 48 px | |
| Masaüstü kısayolu ve kurulum sihirbazı | 64, 128, **256** px | `icon.ico` içinde PNG olarak gömülüdür. |
| Uygulama içi başlık çubuğu | 24 px işaret + "DarkMirror" wordmark | Açık ve koyu zeminde. |
| Bildirim penceresi | 16 px işaret | |

**Teslim edilecek dosyalar:**
- `mark.svg`: tek renk, `currentColor` ile, 32×32 viewBox, saf vektör (metin kontur olarak).
- `app-icon.svg`: renkli uygulama ikonu (yuvarlatılmış kare zemin, köşe yarıçapı boyutun yaklaşık %22'si).
- `wordmark.svg` ve `lockup-horizontal.svg` (işaret + wordmark yan yana), açık ve koyu zemin sürümleriyle.
- Tek renk siyah ve tek renk beyaz sürümler.
- Küçük boy (16–24 px) için optik olarak düzeltilmiş ayrı çizim (oyma çizgileri bu boyda 2'ye ya da 3'e indirilebilir).

**Değiştirildiğinde yeniden üretilecekler:** `public/icon.png` ve `public/icon.ico`; kurulum paketi (`npm run dist`) ikonu bu dosyalardan alır.

### 7.4 Güvenli alan ve kullanım
- İşaretin çevresinde, işaret yüksekliğinin en az **%25'i** kadar boşluk bırakılmalı.
- Yatay kilit (lockup): işaret yüksekliği = wordmark büyük harf yüksekliğinin yaklaşık 1.6 katı. İşaret ile metin arasında işaret genişliğinin yaklaşık %35'i kadar boşluk.
- İzin verilen zeminler: kâğıt `#F3F4EF`, beyaz, lacivert `#14213D`, kapak `#0E1526`. Fotoğraf üzerine konmaz.

## 8. Görsel üretim aracı için örnek istem (prompt)

> A minimal, flat vector logo mark for "DarkMirror", a personal network monitor and firewall app. Two bold back-to-back letter "D" forms mirrored across a thin vertical gap that acts as a mirror plane and a border line. The left half is solid deep navy (#14213D). The right half is the reflection, filled with evenly spaced horizontal engraving lines like banknote or passport security printing, in muted gold (#C8A24A). Calm, official, trustworthy, like a passport emblem or a government document seal. Geometric, built on a strict grid, legible at 16 pixels. Off-white paper background (#F3F4EF). No gradients, no glow, no neon, no shield, no padlock, no globe, no skull, no cyan, no 3D. Centered, generous margin, 1:1.

Uygulama ikonu için ek:

> App icon version: the same mark centered on a rounded-square tile in deep navy (#14213D), left half in off-white (#F3F4EF), right half engraved lines in gold (#C8A24A). Flat, crisp edges, Windows 11 app icon style.

## 9. Kontrol listesi (teslimden önce)

- [ ] 16 px'de iki yarı ve ortadaki boşluk ayırt edilebiliyor mu?
- [ ] Tek renk (yalnız lacivert / yalnız beyaz) hâli çalışıyor mu?
- [ ] Açık (`#F3F4EF`) ve koyu (`#0E1526`) zeminde eşit güçte mi?
- [ ] Benzer ağ izleme uygulamalarının simgeleriyle yan yana konduğunda karışıyor mu? (Karışmamalı.)
- [ ] Kırmızı, neon, kalkan, kilit, küre içermiyor mu?
- [ ] "DarkMirror" yazımı doğru mu (tek kelime, D ve M büyük)?
- [ ] SVG'ler metin değil kontur içeriyor mu, `currentColor` destekli tek renk sürüm var mı?
