# Foton Medya — tanıtım sitesi

Eskişehir FOTON — Fotoğraf Organizasyonları Derneği için planlanan haber ve medya platformunun
**sunucusuz tanıtım (demo) sürümü**. Gerçek sitenin nasıl görüneceğini ve nasıl çalışacağını
derneğe, üyelere ve sponsorlara göstermek için hazırlandı.

- Haberler, yazarlar ve etkinlikler **örnektir**; yazar adları kurgusaldır.
- Formlar alanları doğrular ama **hiçbir bilgiyi kaydetmez ya da göndermez**.
- Tüm sayfalar `noindex`: örnek haberler arama motorlarında gerçek sanılmaz.
- **Çekim havası** bölümü canlıdır: Eskişehir'in 3 günlük tahmini Open-Meteo'dan gelir.

**Düz HTML + htmx.** Derleme adımı, Node.js, npm yok. Klasörü olduğu gibi sunucuya atınca çalışır.

---

## Yerelde çalıştırma

`fetch` ve htmx dosyadan (`file://`) açıldığında çalışmaz; bir web sunucusu gerekir:

```bash
cd fotonmedya
python3 -m http.server 8080
# http://localhost:8080
```

8080 portu doluysa başka bir port verin: `python3 -m http.server 8091`.

## Yayına alma (Cloudflare Pages)

Cloudflare Pages → *Create project* → *Direct upload* ile klasörü yükleyin (derleme komutu yok).
`_headers` dosyası önbellek, güvenlik başlıkları ve `X-Robots-Tag: noindex` ayarlarını içerir.
`404.html` bulunamayan adreslerde otomatik gösterilir.

---

## Klasör yapısı

```
index.html                 Ana sayfa
haberler/                  Tüm haberler, kategori süzgeci (?k=spor, ?tur=foto-haber)
haber/                     Haber / köşe yazısı detayı (?s=slug)
kose-yazilari/             Köşe yazarları ve son yazıları
kadro/                     Editörler, Foton Muhabirleri, köşe yazarları + yayın akışı
yazar/                     Kişi profili ve yazıları (?s=slug)
etkinlikler/               Etkinlik takvimi, tür süzgeci (?t=cocuk)
etkinlik/                  Etkinlik detayı + kayıt formu + takvime ekle (?s=slug)
atolyeler/  cocuk/         Fotoğraf atölyeleri, çocuk atölyeleri
etkinlik-talebi/           Talep türü seçimli form (?tur=atolye|duyuru|fotografci|ortak)
uye-ol/  bizimle-yaz/      Üyelik ve "Bizimle Yaz / Fotoğraf Gönder" (?tur=muhabir|kose|haber|fotograf)
galeri/                    Haftanın Karesi + foto galeri (lightbox, ?tema=mimari)
hakkimizda/  iletisim/     Kurumsal sayfalar, sponsorluk ve iş birliği (#is-birligi)
kunye/  yayin-ilkeleri/  kvkk-aydinlatma-metni/  gizlilik-politikasi/
404.html
data/                      Tüm içerik (aşağıya bakın)
partials/                  htmx ile yüklenen formlar ve üyelik çağrısı
assets/css/style.css       Renk tokenları, bileşenler, mobil uyum, hava animasyonları
assets/js/app.js           JSON okuma, listeler, detay sayfaları, formlar, .ics, paylaş, lightbox, hava durumu
assets/js/htmx.min.js      htmx 2.0.10
assets/fonts/              Inter (arayüz) + Source Serif 4 (başlıklar, Türkçe karakterli)
assets/img/                Logo, favicon, paylaşım görseli (og.jpg), ornek/ (geçici görseller)
kaynak/                    Logonun ve antetli kağıdın orijinalleri
```

### Ortak parçalar (header ve footer)

Header, mobil menü ve footer **her sayfada statik olarak** yer alır (derleme adımı olmadığı için).
HTML'de `ORTAK ÜST BÖLÜM` ve `ORTAK ALT BÖLÜM` yorumlarıyla işaretlidir. **Birini değiştirirseniz tüm
sayfalarda aynı şekilde değiştirin.** Kategori şeridi, mobil menü kategorileri, footer kategorileri ve
iletişim bilgileri ise sayfa açılırken `data/site.json`'dan yeniden yazılır; bunlar için HTML'e
dokunmanız gerekmez.

---

## İçerik nasıl düzenlenir?

Tüm içerik `data/` klasöründeki JSON dosyalarında. Düzenleyip kaydetmeniz yeterli; sayfalar açılışta
bu dosyaları okur. Kaydettikten sonra geçerliliği kontrol edin: `python3 -m json.tool data/haberler.json`.

| Dosya | İçerik |
|---|---|
| `site.json` | `demo` bayrağı, iletişim, sosyal medya (boş olanlar gizlenir), kategoriler ve renkleri, etkinlik türleri, roller, hava durumu ayarı |
| `haberler.json` | Haber, foto-haber ve köşe yazıları. `tur`: `haber` · `foto-haber` · `kose`. `manset`: 1 = büyük manşet, 2–5 küçük manşetler. `govde` blokları: `p`, `h2`, `alinti` (+`kaynak`), `gorsel` (+`aciklama`), `liste` |
| `kadro.json` | Kişiler. `rol`: `editor` · `muhabir` · `kose`. `koseAdi`, `alanlar` (kategori slug'ları), `renk` (baş harf rozeti), `egitmen: true` |
| `etkinlikler.json` | `tur`: `atolye` · `foto-gezi` · `sergi` · `yarisma` · `soylesi` · `cocuk`. `tarih`, `saat`, `bitisSaat`, `bitisTarih` (çok günlü), `kontenjan`/`kayitli`, `yas`, `egitmen` (kadro slug'ı) |
| `galeri.json` | Haftanın Karesi, geçmiş kareler, temalar, galeri fotoğrafları |
| `gorseller.json` | Her görselin alt metni, fotoğrafçısı ve kaynak bağlantısı (kredi satırları buradan üretilir) |

Bir görsele `assets/img/ornek/` altında üç sürüm karşılık gelir: `ad.jpg` (1600 px), `ad-k.jpg` (800 px,
kartlar) ve `dikey: true` olanlarda `ad-dikey.jpg` (900×1359, galeri). Yeni görsel eklerken bu adlandırmayı
kullanın ve `gorseller.json`'a alt metni ile krediyi yazın.

**Tarih notu:** Etkinlikler gerçek bugüne göre "yaklaşan" ya da "geçmiş" sayılır. Tanıtım ileri bir tarihte
yapılacaksa `site.json → demoBugun` alanına `"2026-10-16"` gibi bir tarih yazarak "bugünü" sabitleyin.

---

## Formlar (demo modu)

Formlar `partials/` klasöründen htmx ile yüklenir; her biri tek kaynaktır.

| Partial | Nerede |
|---|---|
| `form-etkinlik-talebi.html` | Etkinlik talebi: talep türüne göre alan grupları açılır |
| `form-kayit.html` | Etkinlik sayfası: çocuk etkinliğinde veli bilgileri, ayrı **fotoğraf yayın izni** (önceden işaretli değil) ve veli onayı; yarışmada fotoğraf bağlantıları ve telif onayı; dolu etkinlikte yedek liste |
| `form-uyelik.html` | Üye ol |
| `form-bizimle-yaz.html` | Muhabir / köşe yazarı başvurusu, haber ve fotoğraf gönderimi, FSEK telif onayı |
| `form-bulten.html` | Bülten aboneliği (açık rıza kutusu) |
| `uyelik-cta.html` | Birçok sayfadaki üyelik çağrısı bandı |

Gönderildiğinde alanlar doğrulanır (zorunlu alan, e-posta, Türkiye telefon numarası, sayı aralığı,
bağlantı biçimi). Geçerliyse form yerine "**Tanıtım sürümü: bilgileriniz kaydedilmedi**" paneli, derneğin
iletişim bilgileri ve gerçek sürümde iletilecek bilgilerin özeti gösterilir.

Form işaretleri: `data-goster="alan=deger1,deger2"` (o seçimde görünür), `data-en-az="1"` (onay kutusu
grubunda en az bir seçim), `data-onsecim-param/-alan` (URL'deki `?tur=` ile ön seçim).

---

## Çekim havası (canlı hava durumu)

Eskişehir için 3 günlük tahmin ve fotoğrafçılara öneri. Üç yerde görünür:

1. **Header'daki çip** (tüm sayfalar): anlık sıcaklık ve animasyonlu ikon; tıklayınca ana sayfadaki bölüme gider.
2. **Ana sayfa, manşetin hemen altı**: 3 gün kartı; animasyonlu ikonlar, gün ışığı çizelgesi (altın saat
   uçlarda turuncu, bugün için "şimdi" işareti), sabah/akşam altın saat ve mavi saat, "çekim ışığı"
   göstergesi, hava türüne göre öneri ve önerilen konular. Kartlar ekrana girince sırayla belirir;
   mobilde yatay kaydırılır.
3. **Haber detayının yan sütunu**: kompakt 3 günlük liste ve günün önerisi.

- Veri: [Open-Meteo](https://open-meteo.com/) (ücretsiz, API anahtarı gerektirmez, CC BY 4.0; kaynak bölümde gösterilir).
- Tahmin 30 dakika tarayıcıda (`localStorage`) saklanır; her sayfada yeniden istek atılmaz.
- Servise ulaşılamazsa çip ve yan kutu gizlenir, ana sayfada genel bir öneri gösterilir.
- Ayarlar `site.json → hava`: `aktif: false` tümünü kapatır; `yer`, `enlem`, `boylam` değiştirilebilir.
- Öneri metinleri ve ışık puanları `app.js` içindeki `HAVA_ONERI` nesnesindedir. Altın saat, gün doğumundan
  sonraki ve gün batımından önceki 60 dakika olarak, mavi saat ise gün batımından sonraki 30 dakika olarak
  **yaklaşık** hesaplanır.
- Hareket azaltma tercihi (`prefers-reduced-motion`) açık olan ziyaretçilerde animasyonlar durur.

---

## Değiştirilecek görseller

Tüm geçici görseller Unsplash Lisansı ile ücretsiz kullanılabilen fotoğraflardır ve sitede gerçek
fotoğrafçısına kredi verilir. Gerçek sürümde üyelerin fotoğraflarıyla değiştirilecek.

| Dosya | İçerik (alt metin) | Fotoğrafçı | Kaynak |
|---|---|---|---|
| `porsuk-kanal.jpg` | Porsuk Çayı kıyısında yürüyen insanlar, iki yanda apartmanlar | ekrem osmanoglu | [Unsplash](https://unsplash.com/photos/a-canal-with-buildings-along-it-xyyEpjHNe18) |
| `porsuk-nehir.jpg` | Ağaçlarla çevrili Porsuk Çayı ve kıyıdaki yürüyüş yolu | ekrem osmanoglu | [Unsplash](https://unsplash.com/photos/a-river-with-trees-and-buildings-along-it-yFgf5uY6B4s) |
| `kule-agaclar.jpg` | Çam ağaçlarının arasından yükselen bir minare | ekrem osmanoglu | [Unsplash](https://unsplash.com/photos/a-tall-tower-with-trees-around-it-p7Bl0fW0ERY) |
| `tugla-kule.jpg` | Kırmızı kiremit çatılı taş cami ve önündeki meydan | ekrem osmanoglu | [Unsplash](https://unsplash.com/photos/a-brick-building-with-a-tower-5xXHffiVUBI) |
| `sokak-yasam.jpg` | Dükkânların sıralandığı, sonunda minare görünen bir çarşı sokağı | ekrem osmanoglu | [Unsplash](https://unsplash.com/photos/a-street-with-buildings-and-people-EcWCtn1EtMg) |
| `masal-sato.jpg` (+dikey) | Mavi kuleli masal şatosunun cephesi | Hamza Virk | [Unsplash](https://unsplash.com/photos/white-and-blue-concrete-castle-under-white-sky-during-daytime-UcHuKqslk9M) |
| `sato-sonbahar.jpg` | Sonbahar renkli ağaçların arasında mavi kuleli şato | Yiğit Ali Atasoy | [Unsplash](https://unsplash.com/photos/blue-and-white-concrete-building-yyV9Ah0o2UA) |
| `sato-kuleler.jpg` (+dikey) | Bulutlu gökyüzü altında şatonun sivri mavi kuleleri | Yiğit Ali Atasoy | [Unsplash](https://unsplash.com/photos/blue-and-brown-concrete-building-IdJs__6PZTI) |
| `sazova-havadan.jpg` | Gün batımında park, göl ve şatonun havadan görünümü | Erdem GÖRAL | [Unsplash](https://unsplash.com/photos/green-trees-near-body-of-water-during-daytime-MILIgDnoVRs) |
| `kus.jpg` | Mavi gökyüzüne karşı dalda tünemiş küçük bir kuşun silueti | Omer Nezih Gerek | [Unsplash](https://unsplash.com/photos/a-small-bird-perched-on-a-tree-branch-xtewINm3Dmg) |
| `dag-manzara.jpg` (+dikey) | Ön planda flu sarı yapraklar, arkada ormanlık tepeler | Agshin Osmanov | [Unsplash](https://unsplash.com/photos/a-view-of-a-mountain-range-with-trees-in-the-foreground-DOn5IGl2dqA) |
| `kamera-el.jpg` | Ormanda bir elin üzerinde tutulan fotoğraf makinesi | Reinhart Julian | [Unsplash](https://images.unsplash.com/photo-1542038784456-1ea8e935640e) |
| `kamera-lens.jpg` | Masa üzerinde fotoğraf makinesi gövdesi ve objektif | William Thomas | [Unsplash](https://images.unsplash.com/photo-1502982720700-bfff97f2ecac) |
| `fotografci-siluet.jpg` (+dikey) | Fotoğraf makinesi tutan bir kişinin silueti | Michael Henry | [Unsplash](https://images.unsplash.com/photo-1497316730643-415fac54a2af) |
| `kamera-cekim.jpg` | Fotoğraf makinesiyle çekim yapan bir kişi | Ailbhe Flynn | [Unsplash](https://images.unsplash.com/photo-1513031300226-c8fb12de9ade) |
| `tripod-gece.jpg` (+dikey) | Yapraksız ağacın altında tripod üzerinde fotoğraf makinesi ve fotoğrafçı silueti | The Nigmatic | [Unsplash](https://images.unsplash.com/photo-1499417267106-45cebb7187c9) |
| `cocuk-kamera.jpg` | Elinde fotoğraf makinesi tutan gülümseyen çocuk | Eduardo Barrios | [Unsplash](https://images.unsplash.com/photo-1622702247961-f3619c5d6211) |
| `cocuk-kamera-2.jpg` (+dikey) | Sarmaşıklı duvarın önünde fotoğraf makinesiyle çekim yapan çocuk | Ines Iachelini | [Unsplash](https://images.unsplash.com/photo-1778160355482-d83f6abbbb95) |
| `iki-kiz-kamera.jpg` (+dikey) | Fotoğraf makinesiyle çekim yapan iki kız çocuğu, arkada yetişkinler | Alexander Mass | [Unsplash](https://images.unsplash.com/photo-1776267074150-74a42966b2ef) |
| `sergi-siyah-beyaz.jpg` | İplere asılmış siyah-beyaz fotoğraf baskıları | Brigitta Schneiter | [Unsplash](https://images.unsplash.com/photo-1523698120758-030a38a90d16) |
| `sergi-izleyici.jpg` | Duvardaki fotoğraflara bakan sergi ziyaretçileri | Markus Spiske | [Unsplash](https://images.unsplash.com/photo-1561490497-43bc900ac2d8) |
| `sergi-cerceve.jpg` | Bir salonun duvarında sıralanmış fotoğraf çerçeveleri | Eric Park | [Unsplash](https://images.unsplash.com/photo-1507643179773-3e975d7ac515) |
| `istiklal-tramvay.jpg` (+dikey) | Kalabalık bir caddede ilerleyen kırmızı nostaljik tramvay | Fatih Encan | [Unsplash](https://images.unsplash.com/photo-1622587853578-dd1bf9608d26) |
| `basketbol.jpg` | Basketbol potasının altında duran top | Markus Spiske | [Unsplash](https://images.unsplash.com/photo-1546519638-68e109498ffc) |
| `bisiklet.jpg` (+dikey) | Ağaçlı bir yolda bisiklet süren kadın | Mina Rad | [Unsplash](https://images.unsplash.com/photo-1729713991109-0b034bcdd94a) |
| `zanaatkar.jpg` | Atölyesinde el aletleriyle çalışan yaşlı bir usta | Hasan Mrad | [Unsplash](https://images.unsplash.com/photo-1778077128762-594e292467a2) |
| `comlek.jpg` | Çömlek çarkında kili şekillendiren eller | Yasin Onus | [Unsplash](https://images.unsplash.com/photo-1766499670904-edab815e8fe3) |
| `matbaa.jpg` | Tipo baskı makinesiyle çalışan bir kişi | Raymond Yeung | [Unsplash](https://images.unsplash.com/photo-1745845289797-913815100704) |
| `omm-cephe.jpg` | Mavi gökyüzüne karşı ahşap çıtalarla kaplı müze cephesi | Huzeyfe Turan | [Unsplash](https://images.unsplash.com/photo-1717618389173-c95ac3b3be0b) |
| `omm-ic.jpg` | Işıklığa doğru yükselen spiral ahşap iç mekân | aleyna nur demirci | [Unsplash](https://images.unsplash.com/photo-1790312034849-3e19e6a327d9) |
| `odunpazari-ev.jpg` (+dikey) | Beyaz cepheli, ahşap pencereli geleneksel konaklar | Arda Can Yıldız | [Unsplash](https://images.unsplash.com/photo-1730492291403-b4779c81b586) |
| `karli-yol.jpg` | Çıplak ağaçların arasında karla kaplı yürüyüş yolu | Murat Düzyurt | [Unsplash](https://images.unsplash.com/photo-1546180368-55cb1823da0f) |

Ayrıca: `assets/img/og.jpg` (sosyal medya paylaşım görseli, `sazova-havadan`'dan kırpıldı) ve
`assets/img/favicon.svg` (Φ simgesi) yer tutucudur.

---

## Teyit edilmesi gerekenler

Aşağıdakiler sitede metin olarak geçiyor; dernek tarafından doğrulanmalı ya da düzeltilmeli:

- **FIAP üyeliği** ve derneğin FIAP onaylı salonları (Hakkımızda, Üye Ol, üyelik çağrısı).
- **Üyelik avantajları** (yayın imkânı, indirimli atölyeler, ücretsiz foto-geziler, üye sergisi), **aidat**
  ve öğrenci koşulları (Üye Ol sayfasında sarı yer tutucular).
- **Çocuk atölyesi güvenceleri** (iki eğitmen, grup büyüklükleri, teslim kuralı, sağlık bilgisinin silinmesi).
- **Atölye kontenjanları ve süreleri** (Atölyeler sayfası) ve etkinlik ücret bilgileri.
- Hakkımızda'daki dernek bilgileri (kuruluş yılı, üye sayısı vb. yer tutucu).

## Yayına geçmeden önce (gerçek sürüm)

- **Künye**: sorumlu yazı işleri müdürü, yayın sahibi, yer sağlayıcı ve web adresi doldurulmalı.
  5187 sayılı Basın Kanunu'nun internet haber sitelerine ilişkin yükümlülükleri **bir hukukçuya teyit ettirilmeli**.
- **KVKK aydınlatma metni** ve **gizlilik politikası** hukukçu tarafından gözden geçirilmeli.
- Tüm sayfalardaki `<meta name="robots" content="noindex, nofollow">` ve `_headers`'taki `X-Robots-Tag`
  kaldırılmalı; `sitemap.xml` eklenip `robots.txt`'ye yazılmalı.
- `site.json → demo: false` yapılmalı ve formlar sunucuya bağlanmalı. Demo şeridi, "Örnek içerik"
  rozetleri ve örnek notları kaldırılmalı.
- Örnek haber, kadro ve etkinlikler gerçekleriyle; geçici görseller üyelerin fotoğraflarıyla değiştirilmeli.

---

## Sonraki faz

Gerçek platform için **Django + htmx** (fotoup projesindeki yığınla aynı):

- Roller: editör, muhabir, köşe yazarı, üye
- Taslak → editör onayı → yayın akışı ve düzeltme notları
- Etkinlik kaydı, kontenjan, yedek liste ve gerekirse ödeme
- Bülten gönderimi (çift onaylı abonelik)
- Üye paneli, fotoğraf yükleme ve kredi yönetimi
- Künye ve sorumlu müdür yükümlülükleri, Google Haberler uyumu

Demodaki URL yapısı (`/haber/?s=…`, `/etkinlik/?s=…`) ve `partials/` klasörü, Django'daki view ve
partial şablonlarına doğrudan taşınabilecek şekilde tasarlandı. Formlardaki `name` alanları model
alanları için başlangıç noktası olarak kullanılabilir.
