<p align="center">
  <img src="public/brand/app-icon.svg" width="96" height="96" alt="DarkMirror">
</p>

<h1 align="center">DarkMirror</h1>

<p align="center">
  Bilgisayarınızın ağdaki yansıması: hangi uygulama, hangi ülkedeki hangi sunucuyla, ne kadar konuşuyor.<br>
  Açık kaynak, tamamen yerel çalışan bir Windows ağ izleyici ve güvenlik duvarı arayüzü.
</p>

<p align="center">
  <a href="../../releases/latest"><b>İndir (Windows kurulum sihirbazı)</b></a> ·
  <a href="#kaynaktan-derleme">Kaynaktan derle</a> ·
  <a href="LICENSE">MIT lisansı</a>
</p>

---

## Neler yapar

- **Canlı trafik grafiği:** Bilgisayarın tüm ağ bağdaştırıcılarındaki gelen/giden hız, son 5 dakikadan 24 saate kadar.
- **Uygulama başına trafik:** Her TCP bağlantısının bayt sayacı Windows'tan okunur ve uygulamasına yazılır.
- **Dünya haritası:** Bağlanılan sunucuların IP kayıt ülkeleri, döndürülebilir 3B küre üzerinde.
- **Gerçek güvenlik duvarı kuralları:** "Engelle" dediğinizde Windows Defender Güvenlik Duvarı'nda `DarkMirror` grubunda gelen ve giden yönde engelleme kuralı oluşur. Kuralları `wf.msc` içinde de görebilirsiniz.
- **Dijital imza denetimi:** Her uygulamanın Authenticode imzası Windows ile doğrulanır; imzalayan adı gösterilir.
- **VirusTotal sorgusu (isteğe bağlı):** Kendi API anahtarınızla dosyanın yalnızca SHA-256 özeti sorgulanır, dosya gönderilmez.
- **Yerel ağ cihazları:** ARP komşu tablosu, IEEE kayıtlarından üretici adı, cihazlara ad ve not.
- **Kullanım ve kota:** Günlük, haftalık ve aylık veri kullanımı, aylık kota göstergesi, CSV dışa aktarma.
- **Açık ve koyu tema:** Windows ayarını izler, menüden değiştirilebilir.

## Verilere ne kadar güvenebilirim?

DarkMirror tahmin ya da örnek veri göstermez. Ölçemediği değeri "—" olarak gösterir.

| Veri | Kaynak | Not |
| --- | --- | --- |
| Toplam gelen/giden | Windows ağ bağdaştırıcısı sayaçları | Tüm protokolleri kapsar. |
| Uygulama ve sunucu başına bayt | TCP genişletilmiş istatistikleri (`GetPerTcpConnectionEStats`) | **Yönetici yetkisi gerekir.** Yalnızca TCP; UDP/QUIC trafiği toplamda görünür ama uygulamalara dağıtılmaz. |
| Bağlantı listesi, süreç ve dosya yolu | `GetExtendedTcpTable`, `QueryFullProcessImageName` | Korumalı sistem süreçlerinin yolu okunamayabilir. |
| İmza ve yayımcı | `Get-AuthenticodeSignature` | "İmzalı" yalnızca Windows imzayı geçerli bulduğunda yazılır. |
| Ülke | DB-IP "IP to Country Lite" (çevrimdışı) | IP adresinin **kayıtlı** olduğu ülkedir; içerik dağıtım ağlarında sunucunun fiziksel konumu farklı olabilir. |
| Sunucu adı | Ters DNS | Kaydı olmayan sunucular IP ile gösterilir. |
| Cihaz üreticisi | IEEE MA-L kayıt listesi | Rastgele (gizlilik) MAC kullanan cihazlarda üretici bilinemez. |
| Ağ geçidi ve DNS | `Get-NetIPConfiguration` | Etkin bağlantının gerçek değerleri. |

## Ne zaman bildirim gösterir?

DarkMirror sizi her yeni bağlantıda rahatsız etmez. Bildirim yalnızca şu durumlarda, sessiz olarak (ses çalmadan) gelir:

- İmzasız veya imzası geçersiz bir uygulama ağa bağlandığında
- Bir uygulamanın dosyası değiştiğinde ve yeni dosyanın imzası doğrulanamadığında
- Ağ geçidinin (modem/router) MAC adresi değiştiğinde (olası ARP yanıltma saldırısı)
- Sistemin DNS sunucuları değiştiğinde
- `hosts` dosyası değiştiğinde
- İnternetten bu bilgisayara Uzak Masaüstü (RDP) bağlantısı kurulduğunda
- VirusTotal bir dosyayı zararlı olarak işaretlediğinde

Yeni ağ cihazları gibi bilgi niteliğindeki olaylar yalnızca **Uyarılar** sekmesine yazılır. Bildirimleri tepsi menüsünden veya başlık çubuğundaki **Ertele** düğmesiyle durdurabilirsiniz.

## Gizlilik

- Hesap, bulut veya telemetri yoktur. Tüm geçmiş `%APPDATA%\DarkMirror\data\darkmirror.db` dosyasında, sizin bilgisayarınızda kalır.
- Uygulama hiçbir ağ portu açmaz. Arayüz motorla süreç içinde (`app://` protokolü ve IPC) konuşur.
- İnternete yalnızca iki durumda çıkılır: siz VirusTotal sorgusu yaptığınızda (dosya özeti) ve sunucu adları için ters DNS sorgularında (sisteminizin DNS sunucusu üzerinden).
- **Gizli mod** açıkken hiçbir geçmiş kaydedilmez.

## Kurulum

1. [Releases](../../releases/latest) sayfasından `DarkMirror-Setup-x.y.z.exe` dosyasını indirin.
2. Kurulumu çalıştırın. DarkMirror, uygulama başına trafiği ölçmek ve güvenlik duvarı kuralı yazmak için **yönetici olarak** çalışır; açılışta Windows izin ister.
3. Kurulum dosyası kod imzası taşımadığı için Windows SmartScreen "Bilinmeyen yayımcı" uyarısı gösterebilir. **Ek bilgi → Yine de çalıştır** ile devam edebilirsiniz. Dilerseniz kaynaktan kendiniz derleyebilirsiniz.

**Gereksinimler:** Windows 10 veya 11 (64 bit).

Kaldırınca DarkMirror'ın güvenlik duvarı kuralları kalır. Önce uygulama içinden **Tüm engelleri kaldır** demeniz veya `wf.msc` içinde `DarkMirror` grubunu silmeniz önerilir.

## Kaynaktan derleme

Gereksinimler: Windows 10/11, [Node.js](https://nodejs.org) 22.13 veya üzeri. C# derleyicisi Windows ile birlikte gelen .NET Framework 4.x içinden kullanılır.

```powershell
git clone https://github.com/ytcsec/darkmirror.git
cd darkmirror
npm install
npm start          # ölçüm aracını derler ve uygulamayı açar
npm test           # motoru ve API'yi bu bilgisayarda uçtan uca dener
npm run dist       # dist\DarkMirror-Setup-<sürüm>.exe kurulum sihirbazını üretir
```

Uygulama başına bayt ölçümünü geliştirme sırasında görmek için terminali yönetici olarak açın.

IP ülke veritabanını güncellemek için (DB-IP her ay yeniler):

```powershell
npm run build:data           # bu ayın verisi
npm run build:data 2026-10   # belirli bir ay
```

## Yeni sürüm yayımlama (bakımcılar için)

1. `package.json` içindeki `version` alanını artırın (ör. `1.0.1`).
2. Gerekirse IP veritabanını yenileyin: `npm run build:data`.
3. `npm test` ve `npm run dist` çalıştırın.
4. GitHub'da **Releases → Draft a new release** açın, `v1.0.1` etiketini oluşturun ve `dist\DarkMirror-Setup-1.0.1.exe` dosyasını ekleyin. İsterseniz açıklamaya dosyanın SHA-256 özetini yazın (`Get-FileHash dist\DarkMirror-Setup-1.0.1.exe`).

## Proje yapısı

```
electron/        Ana süreç (pencere, tepsi, app:// protokolü, IPC) ve preload köprüsü
src/engine.mjs   Ölçüm, geçmiş (SQLite), uyarı kuralları, yerel ağ, VirusTotal, güvenlik duvarı
src/api.mjs      Arayüzün çağırdığı süreç içi API (Request → Response)
src/windows.mjs  PowerShell/Windows entegrasyonları (imza, güvenlik duvarı, ağ yapılandırması)
src/lookup.mjs   Çevrimdışı IP→ülke, ülke merkezi ve MAC üretici sorguları
native/dmprobe.cs  TCP tablosu ve bağlantı başına bayt sayaçlarını okuyan küçük yardımcı
public/          Arayüz (HTML/CSS/JS, framework yok), marka varlıkları, yazı tipi
resources/data/  scripts/build-data.mjs ile üretilen çevrimdışı veri
scripts/         Veri ve yardımcı derleme betikleri
tests/           Uçtan uca doğrulama
```

## Katkı

Hata bildirimi ve önerileriniz için issue açabilirsiniz. Değişiklik önerirken `npm test` komutunun geçtiğinden emin olun. Ölçülemeyen hiçbir değerin tahminle doldurulmaması projenin temel kuralıdır.

## Lisans ve veri kaynakları

DarkMirror [MIT lisansı](LICENSE) ile dağıtılır.

- IP ülke verisi: [IP Geolocation by DB-IP](https://db-ip.com), CC BY 4.0
- Ülke merkezleri: Google DSPL canonical countries, Apache 2.0
- MAC üretici listesi: IEEE Registration Authority (MA-L)
- Kıyı şeritleri: Natural Earth (kamu malı), world-atlas paketi üzerinden
- Yazı tipi: Public Sans, SIL Open Font License 1.1

---

**English:** DarkMirror is an open-source, fully local network monitor for Windows. It shows live bandwidth, per-application TCP traffic (via TCP extended statistics, requires admin), connected countries on a 3D globe (offline DB-IP data), Authenticode signatures, real Windows Defender Firewall block rules, LAN devices, and quiet alerts only for risky events (unsigned apps, gateway MAC changes, DNS/hosts changes, inbound RDP). No accounts, no cloud, no open ports. Download the installer from Releases or build with `npm install && npm run dist`. UI language: Turkish.
