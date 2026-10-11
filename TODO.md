# FRONTIERS — Yapılacaklar

Son durum (2026-10-11): v2.0 tamamlandı, commit `4c11bab`. 74/74 test geçiyor, Cloudflare derlemesi başarılı.
Yayın paketi: `../FRONTIERS-v2.0-kaynak.zip` (git archive HEAD).

## Sıradaki adım
- [ ] **ChatGPT Sites'a yayın** — kullanıcı zip'i ChatGPT'deki mevcut FRONTIERS projesine yükleyip
      "mevcut siteyi güncelle, yeni site oluşturma" diyecek. Hata çıkarsa mesajı buraya getirecek.
- [ ] Yayından sonra canlı sitede kontrol: menü + müzik, tek oyunculu tur, çevrim içi oda (iki cihaz),
      eski (klasik) oda davet bağlantısı.

## Karar bekleyenler (kullanıcıya sor)
- [ ] **Müzik telifi:** parçalar Age of Empires II/III film müzikleri. Herkese açık site için telifsiz
      ortaçağ parçalarıyla değiştirelim mi? (Oyun müziksiz de çalışır.)
- [ ] İnternetten hızlı test için tünel (Cloudflare Tunnel) istenirse kur — yayın beklenmeden.

## İyileştirme fikirleri
- [ ] Denge: yapay zekâ maçlarında köşe krallıklar (Kızıl Aslan, Bakır Kılıç) daha sık kazanıyor.
- [ ] Efekt seslerini kulakla dinleyip ayarla (sentez sesler yalnızca programatik doğrulandı).
- [ ] Çevrim içi: 1,5 sn yoklama yerine anlık bağlantı (WebSocket / Durable Object) — opsiyonel.
- [ ] Başka cihazdan ülke kurtarma (şu an token yalnızca tarayıcıda).
- [ ] Yapay zekâ turlarında çevrim içi izleyicilere olayları sırayla tekrar oynat (şu an toplu animasyon).
- [ ] Gerçek kullanıcılarla oyun testi; dengeyi geri bildirime göre ayarla.
