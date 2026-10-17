/* ==========================================================================
   Foton Medya — site davranışları
   Tüm içerik data/*.json dosyalarından okunur ve sayfaya basılır:
     site.json         iletişim, kategoriler, etkinlik türleri, demo bayrağı
     gorseller.json    her görselin alt metni ve fotoğrafçı kredisi
     kadro.json        editörler, Foton Muhabirleri, köşe yazarları
     haberler.json     haber, foto-haber ve köşe yazıları
     etkinlikler.json  atölye, foto-gezi, sergi, yarışma, söyleşi, çocuk
     galeri.json       Haftanın Karesi ve foto galeri
   Formlar partials/ klasöründen htmx ile gelir. Tanıtım sürümünde
   (site.json → demo: true) formlar yalnızca doğrulanır; hiçbir şey gönderilmez.
   ========================================================================== */
(function () {
  'use strict';

  var TZ = 'Europe/Istanbul';
  // Sitenin kökü bu dosyanın adresinden bulunur (<kök>/assets/js/app.js). Böylece site hem bir alan
  // adının kökünde (/) hem de GitHub Pages gibi bir alt klasörde (/fotonmedya/) değişiklik yapmadan çalışır.
  var KOK = (function () {
    var s = document.currentScript || document.querySelector('script[src*="assets/js/app.js"]');
    return s ? new URL('../../', s.src).pathname : '/';
  })();
  var VERI_KOK = KOK + 'data/';
  var GORSEL_KOK = KOK + 'assets/img/ornek/';
  var D = {};            // yüklenen JSON'lar: D.site, D.gorseller, D.kadro, D.haberler…
  var istekler = {};

  // site.json okunamazsa formların demo panelinde yine doğru iletişim görünsün
  var YEDEK_ILETISIM = {
    eposta: 'eskisehir@foton.com.tr',
    telefon1: '+905349748761',
    telefon1Goster: '0 (534) 974 87 61'
  };

  /* ---------------------------------------------------------- yardımcılar */

  function $(sel, kok) { return (kok || document).querySelector(sel); }
  function $$(sel, kok) { return Array.prototype.slice.call((kok || document).querySelectorAll(sel)); }

  /** "iletisim.eposta" gibi noktalı yolu nesneden okur. */
  function al(nesne, yol) {
    return yol.split('.').reduce(function (o, k) {
      return (o && o[k] !== undefined && o[k] !== null) ? o[k] : null;
    }, nesne);
  }

  /** Küçük DOM üretici: el('span', {class: 'x'}, ['metin', düğüm, [iç içe dizi]]) */
  function el(etiket, ozellik, cocuklar) {
    var d = document.createElement(etiket);
    Object.keys(ozellik || {}).forEach(function (k) {
      var v = ozellik[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'text') d.textContent = v;
      else d.setAttribute(k, v === true ? '' : v);
    });
    ekle(d, cocuklar);
    return d;
  }
  function ekle(d, cocuklar) {
    (cocuklar || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) ekle(d, c);
      else d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return d;
  }
  function doldur(d, cocuklar) {
    if (!d) return d;
    while (d.firstChild) d.removeChild(d.firstChild);
    return ekle(d, cocuklar);
  }

  /** Sayfadaki SVG sprite'tan ikon: ikon('takvim') → <svg class="ikon"><use href="#i-takvim"></svg> */
  function ikon(ad, sinif) {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'ikon' + (sinif ? ' ' + sinif : ''));
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#i-' + ad);
    s.appendChild(u);
    return s;
  }

  function param(ad) { return new URLSearchParams(location.search).get(ad); }
  function paramYaz(ad, deger) {
    var q = new URLSearchParams(location.search);
    if (deger) q.set(ad, deger); else q.delete(ad);
    var s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }
  function trBuyuk(s) { return String(s).toLocaleUpperCase('tr-TR'); }
  function bosDurum(metin) { return el('p', { class: 'bos-durum', text: metin }); }

  /* ---------------------------------------------------------- veri */

  function veri(ad) {
    if (!istekler[ad]) {
      istekler[ad] = fetch(VERI_KOK + ad + '.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(ad + '.json → ' + r.status)); })
        .then(function (j) { D[ad] = j; return j; });
    }
    return istekler[ad];
  }

  function bul(liste, slug) {
    return (liste || []).filter(function (x) { return x.slug === slug; })[0] || null;
  }
  function kisi(slug) { return bul(al(D, 'kadro.kisiler'), slug); }
  function kategori(slug) { return bul(al(D, 'site.kategoriler'), slug) || { slug: slug, ad: slug, renk: '' }; }
  function etkinlikTuru(slug) { return bul(al(D, 'site.etkinlikTurleri'), slug) || { slug: slug, ad: slug, renk: '' }; }
  function yazi(slug) { return bul(al(D, 'haberler.yazilar'), slug); }
  function etkinlik(slug) { return bul(al(D, 'etkinlikler.etkinlikler'), slug); }

  /** En yeni yazı en üstte. */
  function yazilar() {
    return (al(D, 'haberler.yazilar') || []).slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : -1; });
  }
  /** En yakın etkinlik en üstte. */
  function etkinlikler() {
    return (al(D, 'etkinlikler.etkinlikler') || []).slice().sort(function (a, b) {
      return (a.tarih + a.saat) < (b.tarih + b.saat) ? -1 : 1;
    });
  }

  var url = {
    sayfa: function (yol) { return KOK + (yol || ''); },
    haber: function (s) { return KOK + 'haber/?s=' + s; },
    yazar: function (s) { return KOK + 'yazar/?s=' + s; },
    etkinlik: function (s) { return KOK + 'etkinlik/?s=' + s; },
    kategori: function (s) { return KOK + 'haberler/?k=' + s; },
    tur: function (s) { return KOK + 'etkinlikler/?t=' + s; }
  };

  /* ---------------------------------------------------------- tarih */

  /** "2026-10-24" + "10:00" ya da "2026-10-16T09:00" → Date (Türkiye saati, UTC+3) */
  function tarihAl(gun, saat) {
    if (String(gun).indexOf('T') > -1) { var b = gun.split('T'); gun = b[0]; saat = b[1]; }
    return new Date(gun + 'T' + (saat || '00:00') + ':00+03:00');
  }
  function bicim(d, secenek) {
    return new Intl.DateTimeFormat('tr-TR', Object.assign({ timeZone: TZ }, secenek)).format(d);
  }
  function tarihMetni(d) { return bicim(d, { day: 'numeric', month: 'long', year: 'numeric' }); }
  function gunMetni(d) { return bicim(d, { day: 'numeric', month: 'long', weekday: 'long' }); }
  function saatMetni(d) { return bicim(d, { hour: '2-digit', minute: '2-digit' }); }

  /** Tanıtım sunumu ileri bir tarihte yapılacaksa site.json → demoBugun ile "bugün" sabitlenebilir. */
  function bugun() {
    var sabit = al(D, 'site.demoBugun');
    return sabit ? tarihAl(sabit, '12:00') : new Date();
  }
  function etkinlikBitis(e) { return tarihAl(e.bitisTarih || e.tarih, e.bitisSaat || e.saat || '23:59'); }
  function gectiMi(e) { return etkinlikBitis(e) < bugun(); }
  function doluMu(e) { return !!e.kontenjan && e.kayitli >= e.kontenjan; }

  function etkinlikZamani(e) {
    var bas = tarihAl(e.tarih, e.saat);
    if (e.bitisTarih) return tarihMetni(bas) + ' – ' + tarihMetni(tarihAl(e.bitisTarih, '12:00'));
    if (!e.bitisSaat) return gunMetni(bas) + ' · son saat ' + e.saat;
    return gunMetni(bas) + ' · ' + e.saat + '–' + e.bitisSaat;
  }

  function okumaSuresi(y) {
    var metin = [y.spot].concat((y.govde || []).map(function (b) {
      return b.p || b.h2 || b.alinti || (b.liste ? b.liste.join(' ') : '');
    })).join(' ');
    return Math.max(1, Math.round(metin.split(/\s+/).length / 200)) + ' dk okuma';
  }

  /* ---------------------------------------------------------- görseller */

  function gorselBilgi(k) { return (D.gorseller && D.gorseller[k]) || {}; }

  /**
   * boy: 'k' (800px kart), 'b' (1600px) ya da 'dikey' (900×1359, yalnızca dikey: true olanlarda)
   * ek: { sizes, oncelik, alt }
   */
  function resim(k, boy, ek) {
    ek = ek || {};
    var g = gorselBilgi(k);
    var dikey = boy === 'dikey' && g.dikey;
    var o = dikey ? { src: k + '-dikey.jpg', w: 900, h: 1359 }
      : boy === 'k' ? { src: k + '-k.jpg', w: 800, h: 533 }
      : { src: k + '.jpg', w: 1600, h: 1067 };
    var srcset = dikey ? null : GORSEL_KOK + k + '-k.jpg 800w, ' + GORSEL_KOK + k + '.jpg 1600w';
    return el('img', {
      src: GORSEL_KOK + o.src,
      srcset: srcset,
      sizes: srcset ? (ek.sizes || '(max-width: 640px) 100vw, (max-width: 960px) 50vw, 400px') : null,
      width: o.w, height: o.h,
      alt: ek.alt !== undefined ? ek.alt : (g.alt || ''),
      loading: ek.oncelik ? 'eager' : 'lazy',
      fetchpriority: ek.oncelik ? 'high' : null,
      decoding: 'async'
    });
  }

  /** "Fotoğraf: Ad Soyad / Unsplash" kredi satırı */
  function krediEl(k) {
    var g = gorselBilgi(k);
    if (!g.foto) return null;
    return el('span', { class: 'kredi' }, [
      ikon('kamera'),
      el('span', {}, [
        'Fotoğraf: ' + g.foto + ' / ',
        g.url ? el('a', { href: g.url, target: '_blank', rel: 'noopener', text: g.kaynak || 'kaynak' }) : (g.kaynak || '')
      ])
    ]);
  }

  /* ---------------------------------------------------------- küçük bileşenler */

  function basHarf(ad) {
    var p = String(ad).trim().split(/\s+/);
    return trBuyuk(p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : ''));
  }

  /** Gerçek kişilerin yüzü kullanılmaz; profillerde baş harf rozeti gösterilir. */
  function avatar(k, sinif, link) {
    if (!k) return null;
    var o = { class: 'avatar' + (sinif ? ' ' + sinif : ''), style: '--renk:' + k.renk, text: basHarf(k.ad) };
    if (link) {
      o.href = url.yazar(k.slug);
      o['aria-label'] = k.ad + ' profili';
      return el('a', o);
    }
    o['aria-hidden'] = 'true';
    return el('span', o);
  }

  function etiketEl(katSlug, link) {
    var k = kategori(katSlug);
    return el(link === false ? 'span' : 'a', {
      class: 'etiket', style: k.renk ? '--renk:' + k.renk : null,
      href: link === false ? null : url.kategori(k.slug), text: k.ad
    });
  }
  function turEtiketi(turSlug) {
    var t = etkinlikTuru(turSlug);
    return el('span', { class: 'etiket', style: t.renk ? '--renk:' + t.renk : null, text: t.ad });
  }
  function ornekRozeti(metin) {
    return al(D, 'site.demo') === false ? null : el('span', { class: 'rozet rozet--ornek', text: metin || 'Örnek içerik' });
  }

  /* ---------------------------------------------------------- kartlar */

  function haberKart(y, secenek) {
    secenek = secenek || {};
    if (y.tur === 'kose' || !y.gorsel) return koseKart(y);
    var yz = kisi(y.yazar);
    var yatay = secenek.yatay;
    return el('article', { class: 'kart' + (yatay ? ' kart--yatay' : '') }, [
      el('a', { class: 'kart-gorsel', href: url.haber(y.slug), tabindex: '-1' }, [
        resim(y.gorsel, 'k', { sizes: yatay ? '116px' : secenek.sizes }),
        yatay ? null : ornekRozeti('Örnek'),
        !yatay && y.tur === 'foto-haber'
          ? el('span', { class: 'foto-isareti' }, [ikon('kamera'), y.galeri ? y.galeri.length + ' kare' : 'Foto-haber'])
          : null
      ]),
      el('div', { class: 'kart-govde' }, [
        etiketEl(y.kategori),
        el('h3', { class: 'kart-baslik' }, [el('a', { href: url.haber(y.slug), text: y.baslik })]),
        yatay || secenek.spot === false ? null : el('p', { class: 'kart-spot', text: y.spot }),
        el('div', { class: 'kart-meta' }, [
          yz && !yatay ? el('a', { href: url.yazar(yz.slug), text: yz.ad }) : null,
          el('time', { class: yz && !yatay ? 'nokta' : null, datetime: y.tarih, text: tarihMetni(tarihAl(y.tarih)) })
        ])
      ])
    ]);
  }

  /** Köşe yazısı kartı: görsel yerine yazarın baş harf rozeti ve köşe adı. */
  function koseKart(y) {
    var yz = kisi(y.yazar) || { ad: '', renk: '' };
    return el('article', { class: 'yazar-kart' }, [
      el('div', { class: 'yazar-kart-ust' }, [
        avatar(yz),
        el('div', {}, [
          el('div', { class: 'yazar-kart-ad', text: yz.ad }),
          el('div', { class: 'yazar-kart-kose', text: yz.koseAdi || 'Köşe yazısı' })
        ])
      ]),
      el('h3', { class: 'yazar-kart-baslik' }, [el('a', { href: url.haber(y.slug), text: y.baslik })]),
      el('time', { datetime: y.tarih, text: tarihMetni(tarihAl(y.tarih)) })
    ]);
  }

  function kontenjanEl(e) {
    if (!e.kontenjan) return null;
    var kalan = Math.max(0, e.kontenjan - (e.kayitli || 0));
    var oran = Math.min(100, Math.round((e.kayitli || 0) / e.kontenjan * 100));
    var sinif = kalan === 0 ? ' kontenjan--dolu' : kalan <= 3 ? ' kontenjan--az' : '';
    var metin = kalan === 0 ? 'Kontenjan doldu · yedek liste açık' : (e.kayitli || 0) + '/' + e.kontenjan + ' kayıt · ' + kalan + ' yer kaldı';
    return el('div', { class: 'kontenjan' + sinif }, [
      el('span', { text: metin }),
      el('div', { class: 'kontenjan-cubuk', role: 'presentation' }, [el('span', { style: 'width:' + oran + '%' })])
    ]);
  }

  function etkinlikKart(e) {
    var bas = tarihAl(e.tarih, e.saat);
    var gecmis = gectiMi(e);
    var egitmen = kisi(e.egitmen);
    var ay = trBuyuk(bicim(bas, { month: 'short' })).replace('.', '');
    return el('article', { class: 'etkinlik-kart' + (gecmis ? ' etkinlik-kart--gecmis' : '') }, [
      el('div', { class: 'kart-gorsel' }, [resim(e.gorsel, 'k')]),
      el('div', { class: 'tarih-blok', 'aria-hidden': 'true' }, [
        el('strong', { text: bicim(bas, { day: 'numeric' }) }),
        el('span', { text: ay })
      ]),
      el('div', { class: 'etkinlik-govde' }, [
        el('div', { class: 'etiket-satir' }, [
          turEtiketi(e.tur),
          e.yas ? el('span', { class: 'rozet rozet--renk', style: '--renk:' + etkinlikTuru('cocuk').renk, text: e.yas }) : null,
          gecmis ? el('span', { class: 'rozet', text: 'Tamamlandı' }) : null
        ]),
        el('h3', {}, [el('a', { href: url.etkinlik(e.slug), text: e.baslik })]),
        el('ul', { class: 'etkinlik-bilgi' }, [
          el('li', {}, [ikon('takvim'), el('span', { text: etkinlikZamani(e) })]),
          el('li', {}, [ikon('konum'), el('span', { text: e.yer })]),
          egitmen ? el('li', {}, [ikon('kisi'), el('span', { text: egitmen.ad })]) : null
        ]),
        el('div', { class: 'etkinlik-alt' }, [
          gecmis ? null : kontenjanEl(e),
          e.ucret ? el('span', { class: 'kontenjan', text: e.ucret }) : null
        ])
      ])
    ]);
  }

  function etkinlikMini(e) {
    return el('article', { class: 'kart kart--yatay' }, [
      el('a', { class: 'kart-gorsel', href: url.etkinlik(e.slug), tabindex: '-1' }, [resim(e.gorsel, 'k', { sizes: '116px' })]),
      el('div', { class: 'kart-govde' }, [
        turEtiketi(e.tur),
        el('h3', { class: 'kart-baslik' }, [el('a', { href: url.etkinlik(e.slug), text: e.baslik })]),
        el('div', { class: 'kart-meta' }, [el('span', { text: tarihMetni(tarihAl(e.tarih, e.saat)) + ' · ' + e.saat })])
      ])
    ]);
  }

  function kisiKart(k) {
    var rol = al(D, 'site.roller.' + k.rol + '.ad');
    return el('article', { class: 'kisi-kart' }, [
      avatar(k, 'avatar--b'),
      el('h3', {}, [el('a', { href: url.yazar(k.slug), text: k.ad })]),
      el('div', { class: 'unvan', text: k.koseAdi ? k.unvan + ' · ' + k.koseAdi : (k.unvan || rol) }),
      el('p', { text: k.bio }),
      el('div', { class: 'kisi-alanlar' }, (k.alanlar || []).map(function (a) {
        var kat = kategori(a);
        return el('span', { class: 'rozet rozet--renk', style: '--renk:' + kat.renk, text: kat.ad });
      }).concat(k.egitmen ? [el('span', { class: 'rozet', text: 'Eğitmen' })] : []))
    ]);
  }

  /* ---------------------------------------------------------- paylaş */

  function paylasEl(baslik) {
    var adres = location.href;
    var ea = encodeURIComponent(adres);
    var kopya = el('button', { type: 'button', 'aria-label': 'Bağlantıyı kopyala', title: 'Bağlantıyı kopyala' }, [ikon('link')]);
    kopya.addEventListener('click', function () {
      kopyala(adres).then(function () { ipucu(kopya, 'Bağlantı kopyalandı'); }, function () { ipucu(kopya, 'Kopyalanamadı'); });
    });
    var dugmeler = [
      el('a', { href: 'https://wa.me/?text=' + encodeURIComponent(baslik + ' ' + adres), target: '_blank', rel: 'noopener', 'aria-label': 'WhatsApp’ta paylaş', title: 'WhatsApp' }, [ikon('whatsapp')]),
      el('a', { href: 'https://x.com/intent/post?text=' + encodeURIComponent(baslik) + '&url=' + ea, target: '_blank', rel: 'noopener', 'aria-label': 'X’te paylaş', title: 'X' }, [ikon('x', 'ikon-dolu')]),
      el('a', { href: 'https://www.facebook.com/sharer/sharer.php?u=' + ea, target: '_blank', rel: 'noopener', 'aria-label': 'Facebook’ta paylaş', title: 'Facebook' }, [ikon('facebook')]),
      kopya
    ];
    if (navigator.share) {
      var yerel = el('button', { type: 'button', 'aria-label': 'Paylaş', title: 'Paylaş' }, [ikon('paylas')]);
      yerel.addEventListener('click', function () { navigator.share({ title: baslik, url: adres }).catch(function () {}); });
      dugmeler.push(yerel);
    }
    return el('div', { class: 'paylas', role: 'group', 'aria-label': 'Paylaş' }, dugmeler);
  }

  function kopyala(metin) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(metin);
    return new Promise(function (coz, reddet) {
      var t = el('textarea', { style: 'position:fixed;opacity:0', readonly: true });
      t.value = metin;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy') ? coz() : reddet(); } catch (e) { reddet(e); }
      t.remove();
    });
  }

  function ipucu(dugme, metin) {
    var eski = $('.paylas-bilgi', dugme);
    if (eski) eski.remove();
    var b = el('span', { class: 'paylas-bilgi', role: 'status', text: metin });
    dugme.appendChild(b);
    setTimeout(function () { b.remove(); }, 1800);
  }

  /* ---------------------------------------------------------- takvime ekle (.ics) */

  function icsZaman(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsGun(gun) { return gun.replace(/-/g, ''); }
  function icsSonrakiGun(gun) {
    var d = new Date(gun + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  function icsKac(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }
  /** RFC 5545: satırlar 75 baytı geçmez; devam satırı boşlukla başlar. */
  function icsKatla(satir) {
    var enc = new TextEncoder(), parca = '', bayt = 0, cikti = [];
    Array.from(satir).forEach(function (h) {
      var b = enc.encode(h).length;
      if (bayt + b > 74) { cikti.push(parca); parca = ' '; bayt = 1; }
      parca += h; bayt += b;
    });
    cikti.push(parca);
    return cikti.join('\r\n');
  }

  function icsUret(e) {
    var zaman;
    if (e.bitisTarih) {
      // Birden çok gün süren etkinlik (sergi): tüm gün
      zaman = ['DTSTART;VALUE=DATE:' + icsGun(e.tarih), 'DTEND;VALUE=DATE:' + icsSonrakiGun(e.bitisTarih)];
    } else if (!e.bitisSaat) {
      // Son katılım tarihi (yarışma): o gün, tüm gün
      zaman = ['DTSTART;VALUE=DATE:' + icsGun(e.tarih), 'DTEND;VALUE=DATE:' + icsSonrakiGun(e.tarih)];
    } else {
      zaman = ['DTSTART:' + icsZaman(tarihAl(e.tarih, e.saat)), 'DTEND:' + icsZaman(tarihAl(e.tarih, e.bitisSaat))];
    }
    var adres = location.origin + url.etkinlik(e.slug);
    var satirlar = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Foton Medya//Etkinlikler//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + e.slug + '@fotonmedya',
      'DTSTAMP:' + icsZaman(new Date())
    ].concat(zaman, [
      'SUMMARY:' + icsKac(e.baslik),
      'DESCRIPTION:' + icsKac(e.ozet + '\n\n' + adres + (al(D, 'site.demo') === false ? '' : '\n(Tanıtım sürümü — örnek etkinlik)')),
      'LOCATION:' + icsKac([e.yer, e.adres].filter(Boolean).join(', ')),
      'URL:' + adres,
      'END:VEVENT', 'END:VCALENDAR'
    ]);
    return satirlar.map(icsKatla).join('\r\n') + '\r\n';
  }

  function icsIndir(e) {
    var blob = new Blob([icsUret(e)], { type: 'text/calendar;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: e.slug + '.ics' });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------------------------------------------------------- ışık kutusu (lightbox) */

  var IK = null;

  function isikKutusu() {
    if (IK) return IK;
    var d = el('dialog', { class: 'isik-kutusu', 'aria-label': 'Fotoğraf görüntüleyici' });
    var fig = el('figure', {}, [el('img', { alt: '' }), el('figcaption')]);
    var kapat = el('button', { type: 'button', class: 'ik-dugme ik-kapat', 'aria-label': 'Kapat' }, [ikon('kapat')]);
    var onceki = el('button', { type: 'button', class: 'ik-dugme ik-onceki', 'aria-label': 'Önceki fotoğraf' }, [ikon('sol')]);
    var sonraki = el('button', { type: 'button', class: 'ik-dugme ik-sonraki', 'aria-label': 'Sonraki fotoğraf' }, [ikon('sag')]);
    ekle(d, [fig, kapat, onceki, sonraki]);
    document.body.appendChild(d);
    IK = { d: d, fig: fig, onceki: onceki, sonraki: sonraki, liste: [], i: 0, donus: null };

    kapat.addEventListener('click', function () { d.close(); });
    onceki.addEventListener('click', function () { ikGit(-1); });
    sonraki.addEventListener('click', function () { ikGit(1); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') ikGit(-1);
      if (e.key === 'ArrowRight') ikGit(1);
    });
    d.addEventListener('close', function () {
      document.documentElement.style.overflow = '';
      if (IK.donus) IK.donus.focus();
    });
    return IK;
  }

  function ikGit(adim) {
    if (IK.liste.length < 2) return;
    IK.i = (IK.i + adim + IK.liste.length) % IK.liste.length;
    ikGoster();
  }

  function ikGoster() {
    var o = IK.liste[IK.i];
    var g = gorselBilgi(o.gorsel);
    var img = resim(o.gorsel, g.dikey ? 'dikey' : 'b', { oncelik: true, sizes: '92vw' });
    IK.fig.replaceChild(img, $('img', IK.fig));
    doldur($('figcaption', IK.fig), [
      o.baslik ? el('strong', { text: o.baslik }) : null,
      krediEl(o.gorsel),
      IK.liste.length > 1 ? el('span', { text: (IK.i + 1) + ' / ' + IK.liste.length }) : null
    ]);
    IK.onceki.hidden = IK.sonraki.hidden = IK.liste.length < 2;
  }

  /** liste: [{gorsel, baslik}], i: açılacak sıra, donus: kapanınca odaklanacak düğme */
  function isikKutusuAc(liste, i, donus) {
    isikKutusu();
    IK.liste = liste;
    IK.i = i || 0;
    IK.donus = donus || null;
    ikGoster();
    document.documentElement.style.overflow = 'hidden';
    if (typeof IK.d.showModal === 'function') IK.d.showModal(); else IK.d.setAttribute('open', '');
  }

  function buyutDugmesi(sinif, liste, i, icerik) {
    var o = liste[i];
    var b = el('button', { type: 'button', class: sinif || null, 'aria-label': 'Fotoğrafı büyüt' + (o.baslik ? ': ' + o.baslik : '') }, icerik);
    b.addEventListener('click', function () { isikKutusuAc(liste, i, b); });
    return b;
  }

  /* ---------------------------------------------------------- ortak parçalar */

  /**
   * Sayfalar göreli yol kullanır (../assets/…). Partial'lar ise hem ana sayfaya hem alt sayfalara
   * eklendiği için bağlantılarını "/" ile yazar; bunlar burada sitenin köküne bağlanır
   * (kök /fotonmedya/ ise /uye-ol/ → /fotonmedya/uye-ol/).
   */
  function kokYollari(kok) {
    if (KOK === '/' || !kok || !kok.querySelectorAll) return;
    var secici = '[href^="/"], [src^="/"]';
    var ogeler = $$(secici, kok);
    if (kok.matches && kok.matches(secici)) ogeler.push(kok);
    ogeler.forEach(function (n) {
      ['href', 'src'].forEach(function (a) {
        var v = n.getAttribute(a);
        if (v && v.charAt(1) !== '/' && v.indexOf(KOK) !== 0) n.setAttribute(a, KOK + v.slice(1));
      });
    });
  }

  function tarihleriYaz() {
    $$('[data-bugun]').forEach(function (n) {
      n.textContent = bicim(new Date(), { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    });
    $$('[data-yil]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
  }

  /** İletişim bilgileri: HTML'deki değerler yedektir, site.json'dakiler uygulanır. */
  function iletisimUygula(kok) {
    if (!D.site) return;
    var i = D.site.iletisim || {};
    $$('[data-site]', kok).forEach(function (n) {
      var v = al(D.site, n.getAttribute('data-site'));
      if (v) n.textContent = v;
    });
    $$('[data-eposta]', kok).forEach(function (n) {
      if (!i.eposta) return;
      n.setAttribute('href', 'mailto:' + i.eposta);
      if (n.hasAttribute('data-metin')) n.textContent = i.eposta;
    });
    $$('[data-tel]', kok).forEach(function (n) {
      var no = n.getAttribute('data-tel') || '1';
      if (!i['telefon' + no]) return;
      n.setAttribute('href', 'tel:' + i['telefon' + no]);
      if (n.hasAttribute('data-metin')) n.textContent = i['telefon' + no + 'Goster'];
    });
    $$('[data-harita]', kok).forEach(function (n) { if (i.haritaUrl) n.setAttribute('href', i.haritaUrl); });
    // Sosyal medya: boşsa gizlenir; hiçbiri yoksa kutu da gizlenir
    $$('[data-sosyal]', kok).forEach(function (n) {
      var adres = al(D.site, 'sosyal.' + n.getAttribute('data-sosyal'));
      if (adres) { n.setAttribute('href', adres); n.hidden = false; } else n.hidden = true;
    });
    $$('[data-sosyal-kutu]', kok).forEach(function (k) {
      k.hidden = !$$('[data-sosyal]', k).some(function (n) { return !n.hidden; });
    });
  }

  /** Kategori şeridi, mobil menü ve footer kategorileri site.json'dan üretilir. */
  function kategorileriCiz() {
    var kats = al(D, 'site.kategoriler') || [];
    var aktif = aktifKategori();
    doldur($('[data-kategori-serit]'), kats.map(function (k) {
      return el('a', { href: url.kategori(k.slug), style: '--renk:' + k.renk, 'data-kat': k.slug, 'aria-current': k.slug === aktif ? 'page' : null, text: k.ad });
    }));
    doldur($('[data-mobil-kategoriler]'), kats.map(function (k) {
      return el('a', { href: url.kategori(k.slug), text: k.ad });
    }));
    doldur($('[data-alt-kategoriler]'), kats.map(function (k) {
      return el('li', {}, [el('a', { href: url.kategori(k.slug), text: k.ad })]);
    }));
  }
  function aktifKategori() {
    var s = document.body.getAttribute('data-sayfa');
    if (s === 'haberler') return param('k');
    if (s === 'haber') { var y = yazi(param('s')); return y && y.tur !== 'kose' ? y.kategori : null; }
    return null;
  }
  function seritAktifYap(slug) {
    $$('[data-kategori-serit] a').forEach(function (a) {
      if (a.getAttribute('data-kat') === slug) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function mobilMenu() {
    var dugme = $('.menu-dugme');
    var menu = $('#mobil-menu');
    if (!dugme || !menu) return;
    function ac() {
      menu.classList.add('acik');
      dugme.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
      var k = $('[data-menu-kapat]', menu);
      if (k) k.focus();
    }
    function kapat() {
      if (!menu.classList.contains('acik')) return;
      menu.classList.remove('acik');
      dugme.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
      dugme.focus();
    }
    dugme.addEventListener('click', ac);
    menu.addEventListener('click', function (e) {
      if (e.target.closest('[data-menu-kapat]') || e.target.classList.contains('mobil-menu-perde') || e.target.closest('a')) kapat();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') kapat(); });
  }

  /* ---------------------------------------------------------- bildirime dayalı listeler */

  /**
   * <div data-haber-listesi data-tur="haber,foto-haber" data-kategori="spor" data-yazar="slug"
   *      data-adet="6" data-haric="slug" data-haric-manset data-gorunum="yatay" data-bos="…">
   */
  function haberListesi(kap) {
    var turler = (kap.getAttribute('data-tur') || 'haber,foto-haber').split(',');
    var kat = kap.getAttribute('data-kategori');
    var yazar = kap.getAttribute('data-yazar');
    var haric = (kap.getAttribute('data-haric') || '').split(',');
    var adet = parseInt(kap.getAttribute('data-adet'), 10) || 999;
    var liste = yazilar().filter(function (y) {
      return turler.indexOf(y.tur) > -1 && (!kat || y.kategori === kat) && (!yazar || y.yazar === yazar) &&
        haric.indexOf(y.slug) === -1 && !(kap.hasAttribute('data-haric-manset') && y.manset);
    }).slice(0, adet);
    var yatay = kap.getAttribute('data-gorunum') === 'yatay';
    doldur(kap, liste.length
      ? liste.map(function (y) { return haberKart(y, { yatay: yatay }); })
      : [bosDurum(kap.getAttribute('data-bos') || 'Henüz yazı yok.')]);
  }

  /** <div data-etkinlik-listesi data-tur="atolye,cocuk" data-zaman="yaklasan|gecmis|hepsi" data-adet="3" data-gorunum="mini"> */
  function etkinlikListesi(kap) {
    var tur = kap.getAttribute('data-tur');
    var turler = tur ? tur.split(',') : null;
    var zaman = kap.getAttribute('data-zaman') || 'yaklasan';
    var adet = parseInt(kap.getAttribute('data-adet'), 10) || 999;
    var liste = etkinlikler().filter(function (e) {
      var g = gectiMi(e);
      return (!turler || turler.indexOf(e.tur) > -1) && (zaman === 'hepsi' || (zaman === 'gecmis' ? g : !g));
    });
    if (zaman === 'gecmis') liste.reverse();
    liste = liste.slice(0, adet);
    var mini = kap.getAttribute('data-gorunum') === 'mini';
    doldur(kap, liste.length
      ? liste.map(mini ? etkinlikMini : etkinlikKart)
      : [bosDurum(kap.getAttribute('data-bos') || 'Şu anda planlanmış etkinlik yok. Yeni etkinlikler için bültene abone olun.')]);
  }

  /** <div data-kisi-listesi data-rol="kose" data-egitmen> */
  function kisiListesi(kap) {
    var rol = kap.getAttribute('data-rol');
    var liste = (al(D, 'kadro.kisiler') || []).filter(function (k) {
      return (!rol || k.rol === rol) && (!kap.hasAttribute('data-egitmen') || k.egitmen);
    });
    doldur(kap, liste.map(kisiKart));
  }

  /** Ana sayfadaki köşe yazarları şeridi: her yazarın en son yazısı. */
  function koseSeridi(kap) {
    var son = yazilar().filter(function (y) { return y.tur === 'kose'; });
    var kartlar = (al(D, 'kadro.kisiler') || []).filter(function (k) { return k.rol === 'kose'; }).map(function (k) {
      var y = son.filter(function (x) { return x.yazar === k.slug; })[0];
      return y ? koseKart(y) : null;
    });
    doldur(kap, kartlar);
  }

  function listeleriCiz(kok) {
    if (D.haberler) $$('[data-haber-listesi]', kok).forEach(haberListesi);
    if (D.haberler) $$('[data-kose-serit]', kok).forEach(koseSeridi);
    if (D.etkinlikler) $$('[data-etkinlik-listesi]', kok).forEach(etkinlikListesi);
    if (D.kadro) $$('[data-kisi-listesi]', kok).forEach(kisiListesi);
    if (D.galeri) $$('[data-hk]', kok).forEach(haftaninKaresi);
  }

  /* ---------------------------------------------------------- haftanın karesi */

  function haftaninKaresi(kap) {
    var hk = al(D, 'galeri.haftaninKaresi');
    if (!hk) return;
    var gecmis = al(D, 'galeri.gecmisKareler') || [];
    var liste = [{ gorsel: hk.gorsel, baslik: hk.baslik + ' · ' + hk.hafta }].concat(gecmis.map(function (g) {
      return { gorsel: g.gorsel, baslik: g.baslik + ' · ' + g.hafta };
    }));
    doldur(kap, [
      el('div', { class: 'hk' }, [
        el('figure', {}, [
          buyutDugmesi('hk-gorsel', liste, 0, [resim(hk.gorsel, 'b', { sizes: '(max-width: 960px) 100vw, 760px' })])
        ]),
        el('div', { class: 'hk-metin' }, [
          el('span', { class: 'ust-yazi', text: 'Haftanın Karesi' }),
          el('div', { class: 'hk-hafta', text: hk.hafta }),
          el('h2', { text: hk.baslik }),
          el('p', { text: hk.not }),
          krediEl(hk.gorsel),
          gecmis.length ? el('div', { class: 'hk-gecmis' }, gecmis.map(function (g, i) {
            return buyutDugmesi(null, liste, i + 1, [resim(g.gorsel, 'k', { sizes: '120px' }), el('span', { text: g.hafta })]);
          })) : null
        ])
      ])
    ]);
  }

  /* ==========================================================================
     SAYFALAR
     ========================================================================== */

  function anaSayfa() {
    var kap = $('[data-manset]');
    if (!kap) return;
    var m = yazilar().filter(function (y) { return y.manset; }).sort(function (a, b) { return a.manset - b.manset; });
    var b = m[0];
    if (!b) return;
    var yz = kisi(b.yazar);
    doldur(kap, [
      el('article', { class: 'manset-buyuk' }, [
        resim(b.gorsel, 'b', { oncelik: true, sizes: '(max-width: 960px) 100vw, 740px' }),
        el('div', { class: 'manset-icerik' }, [
          el('div', { class: 'etiket-satir' }, [etiketEl(b.kategori, false), ornekRozeti()]),
          el('h2', {}, [el('a', { href: url.haber(b.slug), text: b.baslik })]),
          el('p', { text: b.spot }),
          el('div', { class: 'kart-meta' }, [
            yz ? el('a', { href: url.yazar(yz.slug), text: yz.ad }) : null,
            el('time', { class: 'nokta', datetime: b.tarih, text: tarihMetni(tarihAl(b.tarih)) })
          ])
        ])
      ]),
      el('div', { class: 'manset-kucukler' }, m.slice(1, 5).map(function (y) {
        return haberKart(y, { spot: false, sizes: '(max-width: 640px) 112px, (max-width: 960px) 50vw, 240px' });
      }))
    ]);
  }

  /* ---------------------------------------------------------- haberler (?k=kategori, ?tur=foto-haber) */

  function haberlerSayfasi() {
    var filtre = $('[data-haber-filtre]');
    var izgara = $('[data-haber-izgara]');
    var dahaKap = $('[data-yukle-daha]');
    if (!izgara) return;
    var ADIM = 9;
    var gosterilen = ADIM;
    var secili = param('tur') === 'foto-haber' ? 'foto-haber' : (param('k') || '');
    var giris = $('[data-sayfa-giris]');
    var varsayilanGiris = giris ? giris.textContent : '';

    var secenekler = [{ slug: '', ad: 'Tümü' }, { slug: 'foto-haber', ad: 'Foto-haber' }].concat(al(D, 'site.kategoriler') || []);
    doldur(filtre, secenekler.map(function (s) {
      var b = el('button', { type: 'button', 'data-renk': s.renk ? '' : null, style: s.renk ? '--renk:' + s.renk : null, text: s.ad });
      b.addEventListener('click', function () { sec(s.slug); });
      b._slug = s.slug;
      return b;
    }));

    function sec(slug) {
      secili = slug;
      gosterilen = ADIM;
      paramYaz('k', slug && slug !== 'foto-haber' ? slug : null);
      paramYaz('tur', slug === 'foto-haber' ? 'foto-haber' : null);
      seritAktifYap(slug);
      ciz();
    }

    // Header'daki kategori şeridi bu sayfada yeniden yükleme yapmadan filtreler
    $$('[data-kategori-serit] a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        sec(a.getAttribute('data-kat'));
        izgara.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    function ciz() {
      $$('button', filtre).forEach(function (b) { b.setAttribute('aria-pressed', b._slug === secili ? 'true' : 'false'); });
      var liste = yazilar().filter(function (y) {
        if (y.tur === 'kose') return false;
        if (secili === 'foto-haber') return y.tur === 'foto-haber';
        return !secili || y.kategori === secili;
      });
      var ad = secili === 'foto-haber' ? 'Foto-haber' : secili ? kategori(secili).ad : '';
      var h1 = $('[data-sayfa-baslik]');
      if (h1) h1.textContent = ad ? ad + (secili === 'foto-haber' ? ' dizileri' : ' haberleri') : 'Haberler';
      if (giris) giris.textContent = ad ? liste.length + ' yazı listeleniyor.' : varsayilanGiris;
      document.title = (ad ? ad + ' — ' : 'Haberler — ') + 'Foton Medya';
      doldur(izgara, liste.length
        ? liste.slice(0, gosterilen).map(function (y) { return haberKart(y); })
        : [bosDurum('Bu kategoride henüz haber yok. Bu konuda yazmak ister misiniz? “Bizimle Yaz” sayfasına göz atın.')]);
      doldur(dahaKap, liste.length > gosterilen ? [(function () {
        var b = el('button', { type: 'button', class: 'btn btn--cizgi', text: 'Daha fazla göster (' + (liste.length - gosterilen) + ')' });
        b.addEventListener('click', function () { gosterilen += ADIM; ciz(); });
        return b;
      })()] : []);
    }
    ciz();
  }

  /* ---------------------------------------------------------- haber detay (?s=slug) */

  function govdeBlok(b) {
    if (b.p) return el('p', { text: b.p });
    if (b.h2) return el('h2', { text: b.h2 });
    if (b.alinti) return el('blockquote', {}, [el('p', { text: b.alinti }), b.kaynak ? el('cite', { text: '— ' + b.kaynak }) : null]);
    if (b.liste) return el('ul', {}, b.liste.map(function (li) { return el('li', { text: li }); }));
    if (b.gorsel) return el('figure', {}, [resim(b.gorsel, 'b', { sizes: '(max-width: 760px) 100vw, 720px' }), el('figcaption', {}, [b.aciklama || '', krediEl(b.gorsel)])]);
    return null;
  }

  function bulunamadi(kap, baslik, link, linkMetin) {
    doldur(kap, [el('div', { class: 'bulunamadi' }, [
      el('h1', { text: baslik }),
      el('p', { class: 'giris', style: 'margin-inline:auto', text: 'Bağlantı hatalı olabilir ya da içerik kaldırılmış olabilir.' }),
      el('p', {}, [el('a', { class: 'btn btn--birincil', href: link, text: linkMetin })])
    ])]);
  }

  function haberSayfasi() {
    var kap = $('[data-makale]');
    if (!kap) return;
    var y = yazi(param('s'));
    if (!y) {
      $$('[data-makale-yan], [data-makale-alt]').forEach(function (n) { n.hidden = true; });
      bulunamadi(kap, 'Yazı bulunamadı', url.sayfa('haberler/'), 'Tüm haberler');
      return;
    }
    var kose = y.tur === 'kose';
    var yz = kisi(y.yazar) || { ad: '', slug: '', renk: '' };
    var kat = kategori(y.kategori);
    document.title = y.baslik + ' — Foton Medya';
    var aciklama = $('meta[name="description"]');
    if (aciklama) aciklama.setAttribute('content', y.spot);

    var galeri = (y.galeri || []).map(function (g) { return { gorsel: g, baslik: y.baslik }; });

    doldur(kap, [
      el('nav', { class: 'kirintilar', 'aria-label': 'Konum' }, [
        el('a', { href: url.sayfa(), text: 'Ana sayfa' }), el('span', { 'aria-hidden': 'true', text: '›' }),
        kose ? el('a', { href: url.sayfa('kose-yazilari/'), text: 'Köşe Yazıları' }) : el('a', { href: url.sayfa('haberler/'), text: 'Haberler' }),
        el('span', { 'aria-hidden': 'true', text: '›' }),
        el('a', { href: url.kategori(kat.slug), text: kat.ad })
      ]),
      el('header', { class: 'makale-bas' }, [
        el('div', { class: 'etiket-satir' }, [
          etiketEl(y.kategori),
          y.tur !== 'haber' ? el('span', { class: 'rozet', text: al(D, 'site.haberTurleri.' + y.tur) || y.tur }) : null,
          ornekRozeti()
        ]),
        kose ? el('div', { class: 'kose-bas' }, [
          avatar(yz, 'avatar--b', true),
          el('div', {}, [
            el('a', { href: url.yazar(yz.slug), class: 'kose-yazar', text: yz.ad }),
            el('div', { class: 'kose-adi', text: yz.koseAdi || 'Köşe yazısı' })
          ])
        ]) : null,
        el('h1', { text: y.baslik }),
        el('p', { class: 'makale-spot', text: y.spot }),
        el('div', { class: 'makale-kunye' }, [
          el('div', { class: 'makale-yazar' }, [
            avatar(yz, null, true),
            el('div', {}, [el('a', { href: url.yazar(yz.slug), text: yz.ad }), el('small', { text: yz.unvan || '' })])
          ]),
          el('div', { class: 'makale-tarih' }, [
            el('time', { datetime: y.tarih, text: tarihMetni(tarihAl(y.tarih)) + ', ' + saatMetni(tarihAl(y.tarih)) }),
            el('span', { text: okumaSuresi(y) })
          ]),
          paylasEl(y.baslik)
        ])
      ]),
      y.gorsel ? el('figure', { class: 'makale-gorsel' }, [
        resim(y.gorsel, 'b', { oncelik: true, sizes: '(max-width: 960px) 100vw, 860px' }),
        el('figcaption', {}, [y.gorselAciklama || '', krediEl(y.gorsel)])
      ]) : null,
      galeri.length > 1 ? el('div', { class: 'foto-dizi', role: 'group', 'aria-label': 'Foto-haber karesi' }, galeri.map(function (g, i) {
        return buyutDugmesi(null, galeri, i, [resim(g.gorsel, 'k', { sizes: '(max-width: 640px) 33vw, 280px' })]);
      })) : null,
      el('div', { class: 'ornek-not', role: 'note' }, [
        ikon('bilgi'),
        el('span', {}, kose
          ? ['Bu köşe yazısı Foton Medya tanıtım sürümü için hazırlanmış ', el('strong', { text: 'örnek içeriktir' }), '. Yazar adı kurgusaldır. Köşe yazıları yazarlarının kişisel görüşünü yansıtır.']
          : ['Bu yazı Foton Medya tanıtım sürümü için hazırlanmış ', el('strong', { text: 'örnek içeriktir' }), '. Yazar adı kurgusaldır; fotoğraflar Unsplash’ten geçici olarak kullanılmış ve fotoğrafçısına kredi verilmiştir.'])
      ]),
      el('div', { class: 'makale-govde' + (kose ? ' makale-ilk' : '') }, (y.govde || []).map(govdeBlok)),
      y.etiketler && y.etiketler.length ? el('div', { class: 'makale-etiketler', 'aria-label': 'Etiketler' }, y.etiketler.map(function (t) { return el('span', { text: '#' + t }); })) : null,
      el('aside', { class: 'yazar-kutu', 'aria-label': 'Yazar hakkında' }, [
        avatar(yz, 'avatar--b', true),
        el('div', {}, [
          el('h3', {}, [el('a', { href: url.yazar(yz.slug), text: yz.ad })]),
          el('div', { class: 'yazar-kart-kose', text: yz.koseAdi ? yz.unvan + ' · ' + yz.koseAdi : yz.unvan }),
          el('p', { text: yz.bio }),
          el('a', { class: 'link-ok', href: url.yazar(yz.slug) }, ['Tüm yazıları', ikon('ok')])
        ])
      ])
    ]);

    // Yan sütun ve alt bölüm: aynı türden son yazılar / ilgili yazılar
    var yan = $('[data-yan-son]');
    if (yan) {
      yan.setAttribute('data-tur', kose ? 'kose' : 'haber,foto-haber');
      yan.setAttribute('data-haric', y.slug);
      yan.setAttribute('data-gorunum', 'yatay');
      haberListesi(yan);
      var yanBaslik = $('[data-yan-son-baslik]');
      if (yanBaslik && kose) yanBaslik.textContent = 'Diğer köşe yazıları';
    }
    var ilgili = $('[data-ilgili]');
    if (ilgili) {
      var ayni = yazilar().filter(function (x) { return x.slug !== y.slug && x.tur !== 'kose' && x.kategori === y.kategori; });
      var diger = yazilar().filter(function (x) { return x.slug !== y.slug && x.tur !== 'kose' && x.kategori !== y.kategori; });
      doldur(ilgili, ayni.concat(diger).slice(0, 3).map(function (x) { return haberKart(x); }));
    }
  }

  /* ---------------------------------------------------------- köşe yazıları */

  function koseSayfasi() {
    var kap = $('[data-kose-yazarlari]');
    if (!kap) return;
    var hepsi = yazilar().filter(function (y) { return y.tur === 'kose'; });
    doldur(kap, (al(D, 'kadro.kisiler') || []).filter(function (k) { return k.rol === 'kose'; }).map(function (k) {
      var onun = hepsi.filter(function (y) { return y.yazar === k.slug; });
      var son = onun[0];
      return el('article', { class: 'kose-satir' }, [
        avatar(k, 'avatar--b', true),
        el('div', { class: 'kose-satir-govde' }, [
          el('div', { class: 'kose-satir-ust' }, [
            el('a', { class: 'kose-satir-ad', href: url.yazar(k.slug), text: k.ad }),
            el('span', { class: 'kose-adi', text: k.koseAdi || '' })
          ]),
          son ? el('h3', {}, [el('a', { href: url.haber(son.slug), text: son.baslik })]) : el('p', { text: 'Henüz yazısı yok.' }),
          son ? el('p', { class: 'kart-spot', text: son.spot }) : null,
          son ? el('div', { class: 'kart-meta' }, [el('time', { datetime: son.tarih, text: tarihMetni(tarihAl(son.tarih)) })]) : null,
          onun.length > 1 ? el('ul', { class: 'kose-diger', 'aria-label': 'Önceki yazıları' }, onun.slice(1, 3).map(function (y) {
            return el('li', {}, [el('a', { href: url.haber(y.slug), text: y.baslik })]);
          })) : null
        ])
      ]);
    }));
  }

  /* ---------------------------------------------------------- yazar profili (?s=slug) */

  function yazarSayfasi() {
    var kap = $('[data-profil]');
    if (!kap) return;
    var k = kisi(param('s'));
    if (!k) {
      $$('[data-profil-alt]').forEach(function (n) { n.hidden = true; });
      bulunamadi(kap, 'Kişi bulunamadı', url.sayfa('kadro/'), 'Kadromuz');
      return;
    }
    document.title = k.ad + ' — Foton Medya';
    var rol = al(D, 'site.roller.' + k.rol + '.ad');
    doldur(kap, [
      el('nav', { class: 'kirintilar', 'aria-label': 'Konum' }, [
        el('a', { href: url.sayfa(), text: 'Ana sayfa' }), el('span', { 'aria-hidden': 'true', text: '›' }),
        el('a', { href: url.sayfa('kadro/'), text: 'Kadromuz' })
      ]),
      el('div', { class: 'profil-bas' }, [
        avatar(k, 'avatar--xb'),
        el('div', {}, [
          el('div', { class: 'etiket-satir' }, [el('span', { class: 'rozet', text: rol || '' }), k.egitmen ? el('span', { class: 'rozet', text: 'Eğitmen' }) : null, ornekRozeti('Kurgusal kişi')]),
          el('h1', { text: k.ad }),
          el('div', { class: 'unvan', text: k.koseAdi ? k.unvan + ' · “' + k.koseAdi + '”' : k.unvan }),
          el('p', { class: 'giris', style: 'margin-top:12px', text: k.bio }),
          el('div', { class: 'kisi-alanlar', style: 'margin-top:14px' }, (k.alanlar || []).map(function (a) {
            var kat = kategori(a);
            return el('a', { class: 'rozet', href: url.kategori(kat.slug), text: kat.ad });
          }))
        ])
      ])
    ]);
    var yazilarKap = $('[data-yazar-yazilari]');
    if (yazilarKap) {
      yazilarKap.setAttribute('data-yazar', k.slug);
      yazilarKap.setAttribute('data-tur', 'haber,foto-haber,kose');
      haberListesi(yazilarKap);
    }
    var etkKap = $('[data-yazar-etkinlikleri]');
    if (etkKap) {
      var liste = etkinlikler().filter(function (e) { return e.egitmen === k.slug && !gectiMi(e); });
      var bolum = etkKap.closest('section');
      if (bolum) bolum.hidden = !liste.length;
      doldur(etkKap, liste.map(etkinlikKart));
    }
  }

  /* ---------------------------------------------------------- etkinlikler (?t=tur) */

  function etkinliklerSayfasi() {
    var filtre = $('[data-etkinlik-filtre]');
    var yaklasan = $('[data-etkinlik-yaklasan]');
    var gecmis = $('[data-etkinlik-gecmis]');
    if (!yaklasan) return;
    var secili = param('t') || '';
    var secenekler = [{ slug: '', ad: 'Tümü' }].concat(al(D, 'site.etkinlikTurleri') || []);
    doldur(filtre, secenekler.map(function (s) {
      var b = el('button', { type: 'button', 'data-renk': s.renk ? '' : null, style: s.renk ? '--renk:' + s.renk : null, text: s.ad });
      b._slug = s.slug;
      b.addEventListener('click', function () { secili = s.slug; paramYaz('t', s.slug); ciz(); });
      return b;
    }));
    function ciz() {
      $$('button', filtre).forEach(function (b) { b.setAttribute('aria-pressed', b._slug === secili ? 'true' : 'false'); });
      [yaklasan, gecmis].forEach(function (k) {
        if (!k) return;
        if (secili) k.setAttribute('data-tur', secili); else k.removeAttribute('data-tur');
        etkinlikListesi(k);
      });
      var gecmisBolum = gecmis && gecmis.closest('section');
      if (gecmisBolum) gecmisBolum.hidden = !!$('.bos-durum', gecmis);
      document.title = (secili ? etkinlikTuru(secili).ad + ' — ' : 'Etkinlikler — ') + 'Foton Medya';
    }
    ciz();
  }

  /* ---------------------------------------------------------- etkinlik detay (?s=slug) */

  function etkinlikSayfasi() {
    var bas = $('[data-etkinlik-bas]');
    var detay = $('[data-etkinlik-detay]');
    var yan = $('[data-etkinlik-yan]');
    if (!bas) return;
    var e = etkinlik(param('s'));
    if (!e) {
      $$('[data-etkinlik-alt]').forEach(function (n) { n.hidden = true; });
      bas.classList.remove('sayfa-bas--koyu', 'sayfa-bas--gorsel');
      bulunamadi($('.kap', bas), 'Etkinlik bulunamadı', url.sayfa('etkinlikler/'), 'Tüm etkinlikler');
      return;
    }
    document.title = e.baslik + ' — Foton Medya';
    var tur = etkinlikTuru(e.tur);
    var gecmis = gectiMi(e);
    var dolu = doluMu(e);
    var egitmen = kisi(e.egitmen);
    var kayitVar = !gecmis && e.tur !== 'sergi';
    var cocuk = e.tur === 'cocuk';

    function icsDugmesi(sinif) {
      var b = el('button', { type: 'button', class: 'btn ' + sinif }, [ikon('takvim'), 'Takvime ekle']);
      b.addEventListener('click', function () { icsIndir(e); });
      return b;
    }
    var kayitMetni = e.tur === 'yarisma' ? 'Yarışmaya katıl' : dolu ? 'Yedek listeye yazıl' : 'Kayıt ol';

    var eskiImg = $('img', bas);
    if (eskiImg) eskiImg.remove();
    bas.insertBefore(resim(e.gorsel, 'b', { oncelik: true, sizes: '100vw', alt: gorselBilgi(e.gorsel).alt }), bas.firstChild);
    doldur($('.kap', bas), [
      el('nav', { class: 'kirintilar', 'aria-label': 'Konum' }, [
        el('a', { href: url.sayfa(), text: 'Ana sayfa' }), el('span', { 'aria-hidden': 'true', text: '›' }),
        el('a', { href: url.sayfa('etkinlikler/'), text: 'Etkinlikler' }), el('span', { 'aria-hidden': 'true', text: '›' }),
        el('a', { href: url.tur(tur.slug), text: tur.ad })
      ]),
      el('div', { class: 'etiket-satir', style: 'margin-bottom:12px' }, [
        el('span', { class: 'rozet', text: tur.ad }),
        e.yas ? el('span', { class: 'rozet', text: e.yas }) : null,
        gecmis ? el('span', { class: 'rozet', text: 'Tamamlandı' }) : dolu ? el('span', { class: 'rozet rozet--dolu', text: 'Kontenjan doldu' }) : null,
        ornekRozeti('Örnek etkinlik')
      ]),
      el('h1', { text: e.baslik }),
      el('p', { class: 'giris', text: e.ozet }),
      el('div', { class: 'sayfa-bas-eylem' }, [
        kayitVar ? el('a', { class: 'btn ' + (cocuk ? 'btn--cocuk' : 'btn--vurgu'), href: '#kayit' }, [ikon('kalem'), kayitMetni]) : null,
        gecmis ? null : icsDugmesi('btn--ters')
      ])
    ]);

    doldur(detay, [
      el('h2', { text: 'Etkinlik hakkında' }),
      (e.aciklama || []).map(function (p) { return el('p', { text: p }); }),
      e.program && e.program.length ? [el('h3', { text: e.tur === 'yarisma' ? 'Takvim' : 'Program' }), el('ul', {}, e.program.map(function (p) { return el('li', { text: p }); }))] : null,
      e.getir && e.getir.length ? [el('h3', { text: 'Yanınızda getirin' }), el('ul', {}, e.getir.map(function (p) { return el('li', { text: p }); }))] : null,
      cocuk ? el('div', { class: 'bilgi-kutu', style: 'margin-top:24px' }, [
        ikon('kalkan'),
        el('div', {}, [
          el('p', {}, [el('strong', { text: 'Çocuk atölyelerinde güvence' })]),
          el('ul', { style: 'margin:0;padding-left:1.1em' }, [
            el('li', { text: 'Küçük gruplar; her grupta en az iki yetişkin eğitmen bulunur.' }),
            el('li', { text: 'Kayıt veli tarafından yapılır, veli onayı alınır.' }),
            el('li', { text: 'Çocuğun fotoğrafının yayımlanması ayrı bir izne bağlıdır; izin verilmezse yüzü tanınacak şekilde yayımlanmaz.' }),
            el('li', { text: 'Ekipman atölye tarafından sağlanır; veliler etkinlik boyunca binada bekleyebilir.' })
          ]),
          el('p', { style: 'margin-top:10px' }, [el('a', { href: url.sayfa('cocuk/#guvenceler'), text: 'Tüm güvenceler ve veli bilgilendirmesi' })])
        ])
      ]) : null,
      egitmen ? el('aside', { class: 'yazar-kutu', style: 'margin-top:28px', 'aria-label': 'Eğitmen' }, [
        avatar(egitmen, 'avatar--b', true),
        el('div', {}, [
          el('span', { class: 'ust-yazi', text: 'Eğitmen' }),
          el('h3', {}, [el('a', { href: url.yazar(egitmen.slug), text: egitmen.ad })]),
          el('p', { text: egitmen.bio })
        ])
      ]) : null,
      el('div', { class: 'etiket-satir', style: 'margin-top:24px' }, [el('span', { class: 'alan-etiket', text: 'Paylaş:' }), paylasEl(e.baslik)])
    ]);

    doldur(yan, [
      el('div', { class: 'yan-kutu' }, [
        el('h3', { text: 'Etkinlik bilgileri' }),
        el('ul', { class: 'etkinlik-bilgi etkinlik-bilgi--genis' }, [
          el('li', {}, [ikon('takvim'), el('span', { text: etkinlikZamani(e) })]),
          e.sure ? el('li', {}, [ikon('saat'), el('span', { text: e.sure })]) : null,
          el('li', {}, [ikon('konum'), el('span', {}, [e.yer, e.adres && e.adres !== e.yer ? [el('br'), el('small', { text: e.adres })] : null])]),
          e.seviye ? el('li', {}, [ikon('yildiz'), el('span', { text: 'Seviye: ' + e.seviye })]) : null,
          e.yas ? el('li', {}, [ikon('gulus'), el('span', { text: 'Yaş grubu: ' + e.yas })]) : null,
          egitmen ? el('li', {}, [ikon('kisi'), el('span', {}, ['Eğitmen: ', el('a', { href: url.yazar(egitmen.slug), text: egitmen.ad })])]) : null,
          e.ucret ? el('li', {}, [ikon('etiket'), el('span', { text: e.ucret })]) : null
        ]),
        gecmis ? null : kontenjanEl(e),
        el('div', { class: 'yan-eylem' }, [
          kayitVar ? el('a', { class: 'btn btn--blok ' + (cocuk ? 'btn--cocuk' : 'btn--birincil'), href: '#kayit', text: kayitMetni }) : null,
          gecmis ? el('p', { class: 'ipucu', text: 'Bu etkinlik tamamlandı. Benzer etkinliklerden haberdar olmak için bültene abone olun.' }) : icsDugmesi('btn--cizgi btn--blok'),
          e.tur === 'sergi' && !gecmis ? el('p', { class: 'ipucu', text: 'Sergi ziyareti için kayıt gerekmez.' }) : null
        ])
      ]),
      el('div', { class: 'yan-kutu' }, [
        el('h3', { text: 'Kurumunuz için' }),
        el('p', { style: 'font-size:.92rem;color:var(--metin-2)', text: 'Bu etkinliğin benzerini okulunuz, kurumunuz ya da firmanız için düzenleyebiliriz.' }),
        el('a', { class: 'link-ok', href: url.sayfa('etkinlik-talebi/?tur=atolye') }, ['Etkinlik talebi gönder', ikon('ok')])
      ])
    ]);

    var kayit = $('[data-kayit]');
    if (kayit) kayit.hidden = !kayitVar;
    var benzer = $('[data-benzer]');
    if (benzer) {
      var liste = etkinlikler().filter(function (x) { return x.slug !== e.slug && !gectiMi(x); });
      liste.sort(function (a, b) { return (a.tur === e.tur ? 0 : 1) - (b.tur === e.tur ? 0 : 1); });
      doldur(benzer, liste.slice(0, 3).map(etkinlikKart));
    }
  }

  /* ---------------------------------------------------------- galeri */

  function galeriSayfasi() {
    var filtre = $('[data-galeri-filtre]');
    var izgara = $('[data-galeri]');
    if (!izgara) return;
    var secili = param('tema') || '';
    var temalar = [{ slug: '', ad: 'Tümü' }].concat(al(D, 'galeri.temalar') || []);
    doldur(filtre, temalar.map(function (t) {
      var b = el('button', { type: 'button', text: t.ad });
      b._slug = t.slug;
      b.addEventListener('click', function () { secili = t.slug; paramYaz('tema', t.slug); ciz(); });
      return b;
    }));
    function ciz() {
      $$('button', filtre).forEach(function (b) { b.setAttribute('aria-pressed', b._slug === secili ? 'true' : 'false'); });
      var liste = (al(D, 'galeri.fotograflar') || []).filter(function (f) { return !secili || f.tema === secili; });
      var lk = liste.map(function (f) { return { gorsel: f.gorsel, baslik: f.baslik }; });
      doldur(izgara, liste.length ? liste.map(function (f, i) {
        var g = gorselBilgi(f.gorsel);
        return el('figure', { class: 'galeri-oge' }, [
          buyutDugmesi(null, lk, i, [resim(f.gorsel, g.dikey ? 'dikey' : 'k', { sizes: '(max-width: 640px) 100vw, 400px' })]),
          el('figcaption', {}, [el('strong', { text: f.baslik }), 'Fotoğraf: ' + (g.foto || '')])
        ]);
      }) : [bosDurum('Bu temada fotoğraf yok.')]);
    }
    ciz();
  }

  /* ==========================================================================
     ÇEKİM HAVASI — 3 günlük tahmin ve fotoğrafçılar için öneri
     Veri: Open-Meteo (ücretsiz, API anahtarı gerektirmez; CC BY 4.0, kaynak gösterilir).
     Sonuç 30 dakika tarayıcıda saklanır; header çipi her sayfada yeniden istek atmaz.
       [data-hava-cip]                    header'daki küçük çip
       [data-hava]                        3 günlük kartlar (ana sayfa)
       [data-hava][data-gorunum=kompakt]  yan sütun listesi
     ========================================================================== */

  var HAVA_ANAHTAR = 'foton-hava-v1';
  var HAVA_SURE = 30 * 60 * 1000;
  var havaIstegi = null;

  function havaVerisi(h) {
    if (havaIstegi) return havaIstegi;
    try {
      var kayit = JSON.parse(localStorage.getItem(HAVA_ANAHTAR) || 'null');
      if (kayit && kayit.enlem === h.enlem && Date.now() - kayit.zaman < HAVA_SURE) return (havaIstegi = Promise.resolve(kayit.veri));
    } catch (e) { /* depolama kapalıysa her seferinde istenir */ }
    var adres = 'https://api.open-meteo.com/v1/forecast?latitude=' + h.enlem + '&longitude=' + h.boylam +
      '&current=temperature_2m,weather_code,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,cloud_cover_mean,wind_speed_10m_max,sunrise,sunset' +
      '&timezone=Europe%2FIstanbul&forecast_days=3';
    havaIstegi = fetch(adres)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('Open-Meteo ' + r.status)); })
      .then(function (v) {
        if (!v.daily || !v.daily.time) throw new Error('Open-Meteo: beklenmeyen yanıt');
        try { localStorage.setItem(HAVA_ANAHTAR, JSON.stringify({ zaman: Date.now(), enlem: h.enlem, veri: v })); } catch (e) { /* yok say */ }
        return v;
      });
    return havaIstegi;
  }

  /** WMO hava kodu → tür + Türkçe ad */
  function havaTuru(kod) {
    if (kod === 0) return { tur: 'acik', ad: 'Açık' };
    if (kod === 1) return { tur: 'az', ad: 'Az bulutlu' };
    if (kod === 2) return { tur: 'parcali', ad: 'Parçalı bulutlu' };
    if (kod === 3) return { tur: 'kapali', ad: 'Kapalı' };
    if (kod === 45 || kod === 48) return { tur: 'sis', ad: 'Sisli' };
    if (kod >= 51 && kod <= 57) return { tur: 'yagmur', ad: 'Çisenti' };
    if (kod >= 61 && kod <= 67) return { tur: 'yagmur', ad: kod === 61 ? 'Hafif yağmur' : kod >= 65 ? 'Kuvvetli yağmur' : 'Yağmurlu' };
    if (kod >= 71 && kod <= 77) return { tur: 'kar', ad: 'Karlı' };
    if (kod >= 80 && kod <= 82) return { tur: 'yagmur', ad: 'Sağanak yağış' };
    if (kod === 85 || kod === 86) return { tur: 'kar', ad: 'Kar sağanağı' };
    if (kod >= 95) return { tur: 'firtina', ad: 'Gök gürültülü fırtına' };
    return { tur: 'kapali', ad: 'Bulutlu' };
  }

  /** Hava türüne göre ışık puanı (0–100) ve fotoğrafçılara öneriler (gün sırasına göre dönüşümlü). */
  var HAVA_ONERI = {
    acik: { isik: 72, etiket: 'Altın saatte çok iyi', konular: ['Siluet', 'Gün batımı', 'Mimari'], ipuclari: [
      'Öğle ışığı sert gölgeler yapar; asıl fırsat altın saatte. Sazova Parkı’nda şato kulelerinin siluetini gün batımına karşı deneyin.',
      'Açık gökyüzü gece için de iyi haber: mavi saatte Porsuk köprülerindeki ışıkları tripodla uzun pozlamayla çekin.',
      'Sert ışıkta gölgeleri konu edinin. Odunpazarı’nda ahşap cumbaların duvarlara düşen gölgeleri grafik kareler verir.'
    ] },
    az: { isik: 86, etiket: 'Çok iyi', konular: ['Manzara', 'Gün batımı', 'Şehir'], ipuclari: [
      'Birkaç bulut gökyüzüne derinlik katar. Gün batımında bulutların renklenmesini bekleyin; Porsuk kıyısı geniş açı için ideal.',
      'Bulut gölgelerinin şehirde gezindiği anları yakalayın. Yüksek bir noktadan şehre bakan kareler için iyi bir gün.',
      'Bulutlar güneşi zaman zaman örtecek; portre çekerken ışığın yumuşadığı o anları kollayın.'
    ] },
    parcali: { isik: 90, etiket: 'Dramatik gökyüzü', konular: ['Dramatik gökyüzü', 'Manzara', 'Sokak'], ipuclari: [
      'Parçalı bulutlar en dramatik gökyüzünü verir. Ufku kadrajın alt üçte birine koyun, gökyüzüne yer açın.',
      'Bulutların arasından sızan ışık hüzmelerini kollayın; Kentpark’ın açık alanları bunun için uygun.',
      'Değişken ışıkta pozlamayı sık kontrol edin. Gökyüzü patlıyorsa −0,7 EV telafi deneyin.'
    ] },
    kapali: { isik: 60, etiket: 'Yumuşak ışık', konular: ['Portre', 'Doku', 'Sokak'], ipuclari: [
      'Kapalı hava dev bir softbox gibidir: gölgesiz, yumuşak ışık. Portre için ideal; gri gökyüzünü kadrajdan çıkarın.',
      'Renkler kapalı havada daha doygun görünür. Odunpazarı’nın renkli cepheleri ve kapı detayları için iyi bir gün.',
      'Düz ışık dokuları öne çıkarır: ahşap, taş, eski duvarlar. Siyah-beyaz çekimi de deneyin.'
    ] },
    sis: { isik: 80, etiket: 'Atmosferik', konular: ['Minimalizm', 'Siluet', 'Atmosfer'], ipuclari: [
      'Sis kadrajı kendiliğinden sadeleştirir. Porsuk kıyısında ağaç ve köprü siluetleriyle minimalist kareler deneyin.',
      'Sisli sahnelerde makine pozlamayı kısar; +0,7 ile +1 EV telafi ile sisi beyaz tutun.',
      'Katmanlar arayın: önde net bir konu, arkada sisin içinde kaybolan siluetler derinlik verir.'
    ] },
    yagmur: { isik: 45, etiket: 'Yansıma fırsatı', konular: ['Yansıma', 'Sokak', 'Gece ışıkları'], ipuclari: [
      'Islak kaldırımlar ışıkları ikiye katlar. Yağmur dinince Adalar’da su birikintisi yansımaları için alçak bir açı deneyin.',
      'Şemsiyeler, buğulu camlar, yağmurluklu yayalar… Yağmur sokak fotoğrafına hikâye katar. Makinenizi poşetle koruyun.',
      'Akşam yağmurunda vitrin ve tramvay ışıkları ıslak zeminde parlar; yarım saniyelik pozlamada hareket izleri deneyin.'
    ] },
    kar: { isik: 75, etiket: 'Sakin ve parlak', konular: ['Kar', 'Minimalizm', 'Doku'], ipuclari: [
      'Kar ışık ölçeri yanıltır: pozlamayı +1 ile +2 EV artırın ki kar gri değil beyaz çıksın.',
      'Odunpazarı çatıları ve Kentpark ağaçları karda grafik birer konu. Yedek bataryayı iç cebinizde taşıyın.',
      'Yağan karı dondurmak için hızlı, iz bırakması için 1/30 sn civarı yavaş enstantane deneyin.'
    ] },
    firtina: { isik: 25, etiket: 'Önce güvenlik', konular: ['İç mekân', 'Fırtına sonrası'], ipuclari: [
      'Açık alanlardan ve ağaç altlarından uzak durun. Fırtına sonrası gökyüzü çoğu zaman en etkileyici renkleri verir.',
      'Bugün iç mekân günü: pencere ışığıyla natürmort ya da portre çalışın.',
      'Fırtına geçince bulutların dağılışını izleyin; gün batımıyla birleşirse dramatik kareler çıkar.'
    ] }
  };

  function isinlarSvg() {
    var s = '';
    for (var a = 0; a < 360; a += 45) {
      var r = a * Math.PI / 180, c = Math.cos(r), n = Math.sin(r);
      s += '<line x1="' + (32 + 15 * c).toFixed(1) + '" y1="' + (32 + 15 * n).toFixed(1) + '" x2="' + (32 + 20 * c).toFixed(1) + '" y2="' + (32 + 20 * n).toFixed(1) + '"/>';
    }
    return s;
  }
  var SVG = {
    gunes: '<g class="hv-gunes"><g class="hv-isinlar">' + isinlarSvg() + '</g><circle cx="32" cy="32" r="10"/></g>',
    ay: '<path class="hv-ay" d="M38 12a17 17 0 1 0 15 25A14 14 0 0 1 38 12z"/>',
    bulut: '<g class="hv-bulut"><path class="hv-bulut-sekil" d="M18 50a9 9 0 0 1-1.2-17.9A13 13 0 0 1 42 29a10.5 10.5 0 0 1 4 21z"/></g>',
    bulutArka: '<g class="hv-bulut hv-bulut--arka"><path class="hv-bulut-arka" d="M30 38a7 7 0 0 1-.9-13.9A10 10 0 0 1 48 22a8 8 0 0 1 3 16z"/></g>'
  };
  function damlalar(sinif, sekil) {
    return [[24, 0], [33, 0.37], [42, 0.74]].map(function (d) {
      return sekil === 'tane'
        ? '<circle class="' + sinif + '" cx="' + d[0] + '" cy="49" r="2.4" style="animation-delay:' + d[1] + 's"/>'
        : '<line class="' + sinif + '" x1="' + d[0] + '" y1="47" x2="' + (d[0] - 2) + '" y2="53" style="animation-delay:' + d[1] + 's"/>';
    }).join('');
  }

  /** Animasyonlu hava ikonu (SVG). İçerik sabit metinden üretilir; dış veri içermez. */
  function havaIkonu(tur, gece, sinif) {
    var gok = gece ? SVG.ay : SVG.gunes;
    var yukari = function (s) { return '<g transform="translate(0 -8)">' + s + '</g>'; };
    var icerik = {
      acik: gok,
      az: '<g transform="translate(-6 -8) scale(.85)">' + gok + '</g><g transform="translate(14 12) scale(.72)">' + SVG.bulut + '</g>',
      parcali: '<g transform="translate(-6 -8) scale(.85)">' + gok + '</g>' + SVG.bulut,
      kapali: SVG.bulutArka + SVG.bulut,
      sis: '<g transform="translate(0 -12)" opacity=".8">' + SVG.bulut + '</g>' +
        '<line class="hv-sis-cizgi" x1="14" y1="46" x2="50" y2="46"/><line class="hv-sis-cizgi" x1="20" y1="53" x2="46" y2="53" style="animation-delay:-1.3s"/><line class="hv-sis-cizgi" x1="12" y1="60" x2="40" y2="60" style="animation-delay:-2.6s"/>',
      yagmur: yukari(SVG.bulutArka + SVG.bulut) + damlalar('hv-damla'),
      kar: yukari(SVG.bulut) + damlalar('hv-tane', 'tane'),
      firtina: yukari(SVG.bulutArka + SVG.bulut) + '<path class="hv-simsek" d="M34 41l-7 11h6l-3 9 10-13h-6l4-7z"/>'
    }[tur] || SVG.bulut;
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 64 64');
    s.setAttribute('class', 'hv-ikon hv-ikon--' + tur + (sinif ? ' ' + sinif : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = icerik;
    return s;
  }

  function dkEkle(d, dakika) { return new Date(d.getTime() + dakika * 60000); }
  function araMetni(a, b) { return saatMetni(a) + '–' + saatMetni(b); }

  function havaGunu(v, i) {
    var g = v.daily;
    var t = havaTuru(g.weather_code[i]);
    var o = HAVA_ONERI[t.tur];
    var ruzgar = Math.round(g.wind_speed_10m_max[i] || 0);
    return {
      i: i, t: t, o: o, ruzgar: ruzgar,
      ad: i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : bicim(tarihAl(g.time[i], '12:00'), { weekday: 'long' }),
      tarih: bicim(tarihAl(g.time[i], '12:00'), { day: 'numeric', month: 'long' }),
      max: Math.round(g.temperature_2m_max[i]), min: Math.round(g.temperature_2m_min[i]),
      yagis: g.precipitation_probability_max ? g.precipitation_probability_max[i] : null,
      bulut: g.cloud_cover_mean ? g.cloud_cover_mean[i] : null,
      dogus: tarihAl(g.sunrise[i]), batis: tarihAl(g.sunset[i]),
      isik: Math.max(10, Math.min(100, o.isik - (ruzgar > 30 ? 10 : 0))),
      ipucu: o.ipuclari[i % o.ipuclari.length] + (ruzgar > 30 ? ' Rüzgâr kuvvetli; uzun pozlamada tripodu sabitleyin.' : '')
    };
  }

  function havaKarti(v, i) {
    var h = havaGunu(v, i);
    var gunUzunluk = (h.batis - h.dogus) / 60000;
    var altin = Math.min(25, 60 / gunUzunluk * 100).toFixed(1) + '%';
    var simdi = new Date();
    var simdiKonum = i === 0 && simdi > h.dogus && simdi < h.batis ? ((simdi - h.dogus) / (h.batis - h.dogus) * 100).toFixed(1) + '%' : null;
    return el('article', { class: 'hava-gun' + (i === 0 ? ' hava-gun--bugun' : ''), style: '--sira:' + i }, [
      el('header', { class: 'hava-gun-bas' }, [
        el('div', {}, [el('h3', { text: h.ad }), el('span', { text: h.tarih })]),
        havaIkonu(h.t.tur, false)
      ]),
      el('div', { class: 'hava-derece' }, [
        el('strong', { text: h.max + '°' }),
        el('span', { text: h.min + '°', 'aria-label': 'en düşük ' + h.min + ' derece' }),
        el('em', { text: h.t.ad })
      ]),
      el('ul', { class: 'hava-olcum', 'aria-label': 'Ölçümler' }, [
        h.yagis !== null ? el('li', {}, [ikon('damla'), '%' + h.yagis + ' yağış']) : null,
        el('li', {}, [ikon('ruzgar'), h.ruzgar + ' km/s']),
        h.bulut !== null ? el('li', {}, [ikon('bulut'), '%' + h.bulut + ' bulut']) : null
      ]),
      el('div', { class: 'hava-cizelge', style: '--altin:' + altin }, [
        el('div', { class: 'hava-cizelge-cubuk', role: 'img', 'aria-label': 'Gün ışığı ' + araMetni(h.dogus, h.batis) + '; uçlardaki turuncu bölümler altın saat' }, [
          simdiKonum ? el('span', { class: 'hava-simdi', style: '--konum:' + simdiKonum, title: 'Şimdi ' + saatMetni(simdi) }) : null
        ]),
        el('div', { class: 'hava-cizelge-saat' }, [
          el('span', {}, [ikon('dogus'), saatMetni(h.dogus)]),
          el('span', {}, [ikon('batis'), saatMetni(h.batis)])
        ])
      ]),
      el('dl', { class: 'hava-saatler' }, [
        el('div', {}, [el('dt', { text: 'Sabah altın saat' }), el('dd', { text: araMetni(h.dogus, dkEkle(h.dogus, 60)) })]),
        el('div', {}, [el('dt', { text: 'Akşam altın saat' }), el('dd', { text: araMetni(dkEkle(h.batis, -60), h.batis) })]),
        el('div', {}, [el('dt', { text: 'Mavi saat' }), el('dd', { text: araMetni(h.batis, dkEkle(h.batis, 30)) })])
      ]),
      el('div', { class: 'hava-isik' }, [
        el('div', { class: 'hava-isik-ust' }, [el('span', { text: 'Çekim ışığı' }), el('strong', { text: h.o.etiket })]),
        el('div', { class: 'hava-isik-cubuk', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(h.isik), 'aria-label': 'Çekim ışığı puanı' }, [
          el('span', { style: '--deger:' + h.isik + '%' })
        ])
      ]),
      el('p', { class: 'hava-oneri' }, [ikon('kamera'), el('span', { text: h.ipucu })]),
      el('div', { class: 'hava-konular', 'aria-label': 'Önerilen konular' }, h.o.konular.map(function (k) { return el('span', { class: 'rozet', text: k }); }))
    ]);
  }

  function havaKompakt(v) {
    var gunler = v.daily.time.map(function (x, i) { return havaGunu(v, i); });
    return [
      el('ul', { class: 'hava-kompakt' }, gunler.map(function (h) {
        return el('li', {}, [
          havaIkonu(h.t.tur, false),
          el('div', {}, [el('strong', { text: h.ad }), el('small', { text: h.t.ad })]),
          el('span', { class: 'hava-kompakt-derece' }, [h.max + '°', el('small', { text: ' / ' + h.min + '°' })])
        ]);
      })),
      el('p', { class: 'hava-oneri' }, [ikon('kamera'), el('span', { text: 'Akşam altın saat ' + araMetni(dkEkle(gunler[0].batis, -60), gunler[0].batis) + '. ' + gunler[0].ipucu })])
    ];
  }

  function havaCip(v, yer) {
    var c = v.current || {};
    if (c.temperature_2m === undefined) return;
    var t = havaTuru(c.weather_code);
    $$('[data-hava-cip]').forEach(function (a) {
      doldur(a, [
        havaIkonu(t.tur, c.is_day === 0, 'hv-ikon--mini'),
        el('strong', { text: Math.round(c.temperature_2m) + '°' }),
        el('span', { text: yer }),
        el('span', { class: 'hava-cip-ek', text: '· Çekim havası' })
      ]);
      a.setAttribute('title', yer + ': ' + t.ad + ' — 3 günlük tahmin ve çekim önerileri');
      a.setAttribute('aria-label', yer + ' ' + Math.round(c.temperature_2m) + ' derece, ' + t.ad + '. Çekim havası ve öneriler');
      a.hidden = false;
    });
  }

  /** Bölüm ekrana girince kartlar sırayla belirir, göstergeler dolar. */
  function havaAnimasyonu(kap) {
    kap.classList.add('hava--animasyon');
    if (!('IntersectionObserver' in window)) { kap.classList.add('hava--gorunur'); return; }
    var g = new IntersectionObserver(function (girdiler) {
      girdiler.forEach(function (x) {
        if (x.isIntersecting) { kap.classList.add('hava--gorunur'); g.disconnect(); }
      });
    }, { threshold: 0.15 });
    g.observe(kap);
  }

  function havaBaslat() {
    var tamlar = $$('[data-hava]');
    if (!tamlar.length && !$('[data-hava-cip]')) return;
    var h = al(D, 'site.hava') || {};
    if (h.aktif === false) {
      $$('[data-hava-bolum], [data-hava-kutu]').forEach(function (n) { n.hidden = true; });
      return;
    }
    var yer = h.yer || 'Eskişehir';
    havaVerisi({ enlem: h.enlem || 39.7767, boylam: h.boylam || 30.5206 })
      .then(function (v) {
        havaCip(v, yer);
        $$('[data-hava-guncel]').forEach(function (n) {
          n.textContent = 'Güncelleme ' + saatMetni(tarihAl(v.current ? v.current.time : v.daily.time[0])) + ' · ';
        });
        tamlar.forEach(function (kap) {
          if (kap.getAttribute('data-gorunum') === 'kompakt') { doldur(kap, havaKompakt(v)); return; }
          doldur(kap, v.daily.time.slice(0, 3).map(function (x, i) { return havaKarti(v, i); }));
          havaAnimasyonu(kap);
        });
      })
      .catch(function (hata) {
        console.warn('[Foton Medya] Hava durumu alınamadı:', hata);
        $$('[data-hava-kutu]').forEach(function (n) { n.hidden = true; });
        tamlar.forEach(function (kap) {
          doldur(kap, [el('div', { class: 'hava-hata' }, [
            havaIkonu('parcali', false),
            el('div', {}, [
              el('strong', { text: 'Hava durumu şu anda alınamadı.' }),
              el('p', { text: 'Yine de bir öneri: Gün batımından önceki son bir saat, hangi havada olursa olsun ışığın en yumuşak olduğu zamandır. Makinenizi yanınıza alın.' })
            ])
          ])]);
        });
      });
  }

  /* ---------------------------------------------------------- formda ön seçim düğmeleri */

  /**
   * <button data-sec="talep_turu:atolye" data-hedef="#talep-formu"> → formdaki seçeneği işaretler ve forma kaydırır.
   * Form henüz yüklenmediyse seçim URL'ye (?tur=) yazılır, form gelince oradan uygulanır.
   */
  function secimDugmeleri() {
    $$('[data-sec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-sec').split(':');
        var form = $('form[data-onsecim-alan="' + p[0] + '"]');
        paramYaz(form ? form.getAttribute('data-onsecim-param') : 'tur', p[1]);
        var r = form && $('input[name="' + p[0] + '"][value="' + p[1] + '"]', form);
        if (r) {
          // Demo sonucu gösteriliyorsa önce form yeniden açılır
          var yenile = form.hidden && $('[data-form-yenile]', form.parentNode);
          if (yenile) yenile.click();
          r.checked = true;
          r.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var hedef = $(b.getAttribute('data-hedef') || 'form');
        if (hedef) hedef.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ==========================================================================
     FORMLAR (demo modu)
     partials/*.html htmx ile gelir. Alanlar doğrulanır; geçerliyse form gizlenir
     ve "bilgiler kaydedilmedi" paneliyle birlikte gönderilecek bilgilerin özeti
     gösterilir. Gerçek sürümde bu noktada form sunucuya gönderilecek (hx-post).
       data-goster="alan=deger1,deger2"  → o seçim yapılınca görünür
       data-en-az="1"                    → onay kutusu grubunda en az bir seçim
       data-onsecim-param / -alan        → URL'deki ?tur= ile ön seçim
     ========================================================================== */

  var EPOSTA_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** Türkiye numarasını 10 haneye indirger: 5321234567. Geçersizse null. */
  function telefonNormalize(ham) {
    var r = String(ham || '').replace(/\D/g, '');
    if (r.indexOf('90') === 0 && r.length === 12) r = r.slice(2);
    if (r.indexOf('0') === 0 && r.length === 11) r = r.slice(1);
    return /^[2-5]\d{9}$/.test(r) ? r : null;
  }
  function telefonBicimle(on) {
    return '0' + on.slice(0, 3) + ' ' + on.slice(3, 6) + ' ' + on.slice(6, 8) + ' ' + on.slice(8);
  }

  function gorunur(n) { return !n.disabled && !n.closest('[hidden]'); }
  function adla(form, ad) { return $$('[name="' + ad + '"]', form); }

  function alanDogrula(inp, form) {
    if (!gorunur(inp)) return '';
    var v = (inp.value || '').trim();
    if (inp.type === 'radio') {
      if (!adla(form, inp.name).some(function (r) { return r.required; })) return '';
      return adla(form, inp.name).some(function (r) { return r.checked; }) ? '' : (inp.getAttribute('data-hata') || 'Lütfen bir seçim yapın.');
    }
    if (inp.type === 'checkbox') {
      var grup = inp.closest('[data-en-az]');
      if (grup) {
        var en = parseInt(grup.getAttribute('data-en-az'), 10) || 1;
        return $$('input[type="checkbox"]:checked', grup).length >= en ? '' : (grup.getAttribute('data-hata') || 'En az bir seçenek işaretleyin.');
      }
      return inp.required && !inp.checked ? (inp.getAttribute('data-hata') || 'Devam etmek için bu kutuyu işaretleyin.') : '';
    }
    if (inp.required && !v) return inp.getAttribute('data-hata') || 'Bu alan zorunlu.';
    if (!v) return '';
    if (inp.type === 'email' && !EPOSTA_RE.test(v)) return 'Geçerli bir e-posta adresi yazın.';
    if (inp.type === 'tel' && !telefonNormalize(v)) return 'Numarayı 05XX XXX XX XX biçiminde yazın.';
    if (inp.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return 'Bağlantı http:// ya da https:// ile başlamalı.';
    if (inp.type === 'number') {
      var s = Number(v);
      var min = inp.getAttribute('min'), max = inp.getAttribute('max');
      if (isNaN(s) || (min !== null && s < +min) || (max !== null && s > +max)) {
        return min !== null && max !== null ? min + ' ile ' + max + ' arasında bir sayı yazın.' : 'Geçerli bir sayı yazın.';
      }
    }
    if (inp.type === 'date' && inp.getAttribute('min') && v < inp.getAttribute('min')) return 'Bugünden sonraki bir tarih seçin.';
    if (inp.minLength > 0 && v.length < inp.minLength) return 'En az ' + inp.minLength + ' karakter yazın.';
    return '';
  }

  function hataYaz(inp, mesaj) {
    var kap = inp.closest('.alan');
    if (kap) {
      var h = $('.alan-hata', kap);
      if (!h) { h = el('span', { class: 'alan-hata', 'aria-live': 'polite' }); kap.appendChild(h); }
      h.textContent = mesaj || '';
    }
    var hedef = inp;
    if (inp.type === 'radio' || inp.type === 'checkbox') hedef = inp.closest('.secimler') || inp.closest('.onay') || inp;
    if (mesaj) hedef.setAttribute('aria-invalid', 'true'); else hedef.removeAttribute('aria-invalid');
  }

  function grupAnahtari(inp) {
    if (inp.type === 'radio') return 'r:' + inp.name;
    if (inp.type === 'checkbox' && inp.closest('[data-en-az]')) return 'c:' + inp.name;
    return null;
  }

  function formDogrula(form) {
    var ilk = null, gorulen = {};
    Array.prototype.forEach.call(form.elements, function (inp) {
      if (!inp.name || /^(submit|button|hidden|reset)$/.test(inp.type)) return;
      var a = grupAnahtari(inp);
      if (a) { if (gorulen[a]) return; gorulen[a] = true; }
      var m = alanDogrula(inp, form);
      hataYaz(inp, m);
      if (m && !ilk) ilk = inp;
    });
    if (ilk) {
      ilk.focus({ preventScroll: true });
      ilk.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !ilk;
  }

  function kosullariUygula(form) {
    $$('[data-goster]', form).forEach(function (n) {
      var b = n.getAttribute('data-goster').split('=');
      var degerler = (b[1] || '').split(',');
      var secili = adla(form, b[0]).filter(function (i) {
        return (i.type === 'radio' || i.type === 'checkbox') ? i.checked : !!i.value;
      }).map(function (i) { return i.value; });
      n.hidden = !secili.some(function (v) { return degerler.indexOf(v) > -1; });
    });
  }

  function onsecimUygula(form) {
    var p = form.getAttribute('data-onsecim-param');
    var a = form.getAttribute('data-onsecim-alan');
    var v = p && a ? param(p) : null;
    if (!v) return;
    var i = $('[name="' + a + '"][value="' + v.replace(/[^a-z0-9-]/gi, '') + '"]', form);
    if (i) i.checked = true;
  }

  function etiketMetni(n) {
    if (!n) return '';
    var c = n.cloneNode(true);
    $$('.zorunlu, .ipucu', c).forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function secimMetni(i) {
    var s = i.nextElementSibling;
    if (!s) return i.value;
    var c = s.cloneNode(true);
    $$('small', c).forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }

  /** Görünür alanlardan [etiket, değer] satırları. */
  function ozetSatirlari(form) {
    var satirlar = [], gorulen = {};
    Array.prototype.forEach.call(form.elements, function (inp) {
      if (!inp.name || gorulen[inp.name] || /^(submit|button|reset)$/.test(inp.type)) return;
      if (inp.type === 'hidden') {
        if (inp.getAttribute('data-ozet') && inp.value) satirlar.push([inp.getAttribute('data-ozet'), inp.value]);
        return;
      }
      if (!gorunur(inp)) return;
      gorulen[inp.name] = true;
      var kap = inp.closest('.alan');
      var etiket, deger;
      if (inp.type === 'radio' || inp.type === 'checkbox') {
        var secili = adla(form, inp.name).filter(function (i) { return i.checked && gorunur(i); });
        if (inp.closest('.onay')) {
          etiket = inp.getAttribute('data-ozet') || 'Onay';
          deger = secili.length ? 'Onaylandı' : '';
        } else {
          etiket = etiketMetni(kap && $('legend, .alan-etiket', kap));
          deger = secili.map(secimMetni).join(', ');
        }
      } else {
        var lbl = inp.id ? $('label[for="' + inp.id + '"]', form) : null;
        etiket = etiketMetni(lbl || (kap && $('label', kap)));
        deger = inp.tagName === 'SELECT' ? (inp.value ? inp.options[inp.selectedIndex].text : '') : inp.value.trim();
        if (inp.type === 'tel' && telefonNormalize(deger)) deger = telefonBicimle(telefonNormalize(deger));
        if (inp.type === 'date' && deger) deger = tarihMetni(tarihAl(deger, '12:00'));
      }
      if (deger) satirlar.push([etiket || inp.name, deger]);
    });
    return satirlar;
  }

  function sonucGoster(form) {
    var i = al(D, 'site.iletisim') || YEDEK_ILETISIM;
    var kisa = form.hasAttribute('data-kisa');
    var satirlar = kisa ? [] : ozetSatirlari(form);
    var panel = el('div', { class: 'demo-sonuc', tabindex: '-1', role: 'status' }, [
      el('div', { class: 'demo-sonuc-bas' }, [
        el('span', { class: 'ikon-daire' }, [ikon('onay')]),
        el('div', {}, [
          el('h3', { text: form.getAttribute('data-basari-baslik') || 'Form eksiksiz dolduruldu' }),
          el('p', { text: form.getAttribute('data-basari-metin') || 'Gerçek sürümde bu bilgiler derneğe iletilecek ve size en kısa sürede dönüş yapılacak.' })
        ])
      ]),
      el('div', { class: 'demo-uyari' }, [
        el('strong', { text: 'Tanıtım sürümü: ' }),
        'bilgileriniz kaydedilmedi ve hiçbir yere gönderilmedi. Başvuru için ',
        el('a', { href: 'mailto:' + i.eposta, text: i.eposta }), ' / ',
        el('a', { href: 'tel:' + i.telefon1, text: i.telefon1Goster }),
        ' üzerinden derneğe ulaşabilirsiniz.'
      ]),
      satirlar.length ? el('table', { class: 'ozet-tablo' }, [
        el('caption', { text: 'Gerçek sürümde iletilecek bilgiler' }),
        el('tbody', {}, satirlar.map(function (s) { return el('tr', {}, [el('th', { scope: 'row', text: s[0] }), el('td', { text: s[1] })]); }))
      ]) : null,
      el('div', {}, [el('button', { type: 'button', class: 'btn btn--cizgi btn--kucuk', 'data-form-yenile': '' }, [ikon('yenile'), 'Formu yeniden doldur'])])
    ]);
    form.hidden = true;
    form.parentNode.insertBefore(panel, form.nextSibling);
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('[data-form-yenile]', panel).addEventListener('click', function () {
      form.reset();
      $$('[aria-invalid]', form).forEach(function (n) { n.removeAttribute('aria-invalid'); });
      $$('.alan-hata', form).forEach(function (n) { n.textContent = ''; });
      panel.remove();
      form.hidden = false;
      onsecimUygula(form);
      kosullariUygula(form);
      kayitBaglami(form);
      var ilk = $('input:not([type="hidden"]), select, textarea', form);
      if (ilk) ilk.focus();
    });
  }

  function formKur(form) {
    if (form.hasAttribute('data-hazir')) return;
    form.setAttribute('data-hazir', '');
    form.setAttribute('novalidate', '');

    // Tarih alanlarında geçmiş gün seçilemesin
    var bugunIso = bicim(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' }).split('.').reverse().join('-');
    $$('input[type="date"][data-ileri]', form).forEach(function (d) { d.setAttribute('min', bugunIso); });

    onsecimUygula(form);
    kosullariUygula(form);
    kayitBaglami(form);

    function degisti(e) {
      var t = e.target;
      if (!t.name) return;
      kosullariUygula(form);
      // Hata gösterilmiş alan düzeltildikçe mesaj kalkar
      var kap = t.closest('.alan');
      var hata = kap && $('.alan-hata', kap);
      if (hata && hata.textContent) hataYaz(t, alanDogrula(t, form));
    }
    form.addEventListener('input', degisti);
    form.addEventListener('change', degisti);

    $$('input[type="tel"]', form).forEach(function (t) {
      t.addEventListener('blur', function () {
        var n = telefonNormalize(t.value);
        if (n) t.value = telefonBicimle(n);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!formDogrula(form)) return;
      // Gerçek sürümde (site.json → demo: false) burada form sunucuya gönderilecek.
      sonucGoster(form);
    });
  }

  /** Etkinlik kayıt formu: seçili etkinliğe göre veli / yarışma alanları açılır. */
  function kayitBaglami(form) {
    if (!form.hasAttribute('data-kayit-formu') || !D.etkinlikler) return;
    var e = etkinlik(param('s'));
    if (!e) return;
    var dolu = doluMu(e);
    doldur($('[data-secili-etkinlik]', form), [
      ikon('takvim'),
      el('div', {}, [el('strong', { text: e.baslik }), el('span', { text: etkinlikZamani(e) + ' · ' + e.yer })])
    ]);
    var gizli = $('[name="etkinlik"]', form);
    if (gizli) gizli.value = e.baslik;
    $$('[data-etkinlik-turu]', form).forEach(function (n) {
      n.hidden = n.getAttribute('data-etkinlik-turu').split(',').indexOf(e.tur) === -1;
    });
    $$('[data-etkinlik-turu-haric]', form).forEach(function (n) {
      n.hidden = n.getAttribute('data-etkinlik-turu-haric').split(',').indexOf(e.tur) > -1;
    });
    $$('[data-etiket-cocuk]', form).forEach(function (n) {
      if (!n.hasAttribute('data-etiket-normal')) n.setAttribute('data-etiket-normal', n.firstChild.textContent);
      n.firstChild.textContent = e.tur === 'cocuk' ? n.getAttribute('data-etiket-cocuk') : n.getAttribute('data-etiket-normal');
    });
    var dolNot = $('[data-dolu-not]', form);
    if (dolNot) dolNot.hidden = !dolu;
    var gonder = $('[type="submit"]', form);
    if (gonder) {
      gonder.textContent = e.tur === 'yarisma' ? 'Katılımı tamamla' : dolu ? 'Yedek listeye yazıl' : 'Kaydı tamamla';
      gonder.className = 'btn ' + (e.tur === 'cocuk' ? 'btn--cocuk' : 'btn--birincil');
    }
    form.setAttribute('data-basari-baslik', e.tur === 'yarisma' ? 'Katılım formunuz eksiksiz' : dolu ? 'Yedek liste talebiniz eksiksiz' : 'Kayıt formunuz eksiksiz');
  }

  function formlariKur(kok) {
    $$('form[data-form]', kok).forEach(formKur);
    if (kok && kok.matches && kok.matches('form[data-form]')) formKur(kok);
  }

  /** htmx ile sonradan gelen içerik: iletişim bilgisi + formlar + listeler */
  function yeniIcerik(kok) {
    kokYollari(kok);
    iletisimUygula(kok);
    formlariKur(kok);
    listeleriCiz(kok);
  }

  /* ---------------------------------------------------------- başlat */

  var SAYFALAR = {
    ana: anaSayfa,
    haberler: haberlerSayfasi,
    haber: haberSayfasi,
    kose: koseSayfasi,
    yazar: yazarSayfasi,
    etkinlikler: etkinliklerSayfasi,
    etkinlik: etkinlikSayfasi,
    galeri: galeriSayfasi
  };

  /** Sayfada hangi bileşenler varsa yalnızca onların JSON'u yüklenir. */
  function gerekenVeri(sayfa) {
    var g = ['site', 'gorseller', 'kadro'];
    if ($('[data-haber-listesi], [data-kose-serit], [data-manset], [data-kose-yazarlari]') || /^(haberler|haber|yazar)$/.test(sayfa)) g.push('haberler');
    if ($('[data-etkinlik-listesi], [data-kayit]') || /^(etkinlikler|etkinlik|yazar)$/.test(sayfa)) g.push('etkinlikler');
    if ($('[data-hk], [data-galeri]')) g.push('galeri');
    return g;
  }

  function yuklemeHatasi(hata) {
    console.warn('[Foton Medya] İçerik yüklenemedi:', hata);
    var serit = $('.demo-serit');
    var uyari = el('div', { class: 'bilgi-kutu bilgi-kutu--uyari', role: 'alert', style: 'margin:0;border-radius:0;justify-content:center' }, [
      ikon('uyari'),
      el('span', { text: 'İçerik yüklenemedi. Site dosyadan (file://) açıldıysa bir web sunucusuyla açın: klasörde “python3 -m http.server 8080” çalıştırıp http://localhost:8080 adresine gidin.' })
    ]);
    if (serit) serit.parentNode.insertBefore(uyari, serit.nextSibling);
    else document.body.insertBefore(uyari, document.body.firstChild);
  }

  function baslat() {
    mobilMenu();
    tarihleriYaz();
    secimDugmeleri();
    formlariKur(document);

    // htmx ile gelen partial'lar
    document.body.addEventListener('htmx:load', function (e) { yeniIcerik(e.detail && e.detail.elt); });
    ['htmx:responseError', 'htmx:sendError'].forEach(function (olay) {
      document.body.addEventListener(olay, function (e) {
        var hedef = e.detail && (e.detail.target || e.detail.elt);
        if (!hedef) return;
        var i = al(D, 'site.iletisim') || YEDEK_ILETISIM;
        doldur(hedef, [el('p', { class: 'bos-durum' }, [
          'Form şu anda açılamadı. Lütfen ', el('a', { href: 'mailto:' + i.eposta, text: i.eposta }),
          ' ya da ', el('a', { href: 'tel:' + i.telefon1, text: i.telefon1Goster }), ' üzerinden ulaşın.'
        ])]);
      });
    });

    var sayfa = document.body.getAttribute('data-sayfa') || '';
    Promise.all(gerekenVeri(sayfa).map(veri))
      .then(function () {
        iletisimUygula(document);
        kategorileriCiz();
        havaBaslat();
        listeleriCiz(document);
        if (SAYFALAR[sayfa]) SAYFALAR[sayfa]();
        $$('form[data-form]').forEach(kayitBaglami);
      })
      .catch(yuklemeHatasi);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }
})();
