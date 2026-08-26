/**
 * Per-place editorial context for the Uzbek pack — one profile per region and
 * per Tashkent district.
 *
 * Two things this file deliberately is not:
 *
 *  - It is not a template with the name swapped in. "X is a great place to
 *    rent a flat, browse listings in X" written fourteen times is one page
 *    repeated, and both a reader and a crawler can tell. The test every
 *    `about` here has to pass: cover the heading, read the paragraph, and you
 *    should still be able to name the place. So Asaka gets the car plant,
 *    Bektemir gets the river, Olmazor gets the two universities everyone in
 *    the city still calls Politexnika and Tibbiyot akademiyasi.
 *  - It is not a number. There are no listing counts, no average rents, no
 *    ratings anywhere below. Geography, universities, bazaars and metro lines
 *    do not go stale between deploys; a hard-coded price would be wrong within
 *    the month.
 *
 * `highlights` are the concrete draws a renter would actually recognise on a
 * map — stations, campuses, markets, plants — kept to a few words so they
 * render as chips rather than sentences.
 */

import type { PlaceProfile } from './types';

export const UZ_REGION_PROFILES: Record<string, PlaceProfile> = {
  toshkent: {
    about:
      'Toshkent — mamlakatdagi eng katta ijara bozori: 12 ta tuman, uch yo‘nalishli metro va '
      + 'viloyatlardan kelib ishlaydigan yuz minglab odam. Uy fondi juda xilma-xil — Chilonzor '
      + 'va Uchtepadagi sovet davri panel uylardan tortib, Sergeli va Yangihayotdagi yangi '
      + 'kvartallar hamda markazdagi baland ofis-turar majmualarigacha. Markazdan uzoqlashgan '
      + 'sari narx sezilarli tushadi, shuning uchun ko‘pchilik metro bekatiga yaqinlikni tuman '
      + 'nomidan muhimroq deb biladi. Uy tanlashdan oldin u qaysi metro liniyasiga tushishini va '
      + 'ish joyingizgacha tirbandlikda qancha vaqt ketishini hisoblab ko‘ring.',
    highlights: [
      'Uch yo‘nalishli metro',
      'Chorsu va Oloy bozorlari',
      'O‘zbekiston Milliy universiteti',
      'Markaziy biznes va ofislar hududi',
      'Sergelidagi yangi kvartallar',
      'Toshkent xalqaro aeroporti',
    ],
  },

  'toshkent-viloyati': {
    about:
      'Viloyat poytaxtni halqa bo‘lib o‘rab turadi va ijara talabi ko‘p jihatdan shu yaqinlikdan '
      + 'kelib chiqadi: Qibray, Zangiota va Yangiyo‘lda Toshkentga har kuni qatnaydiganlar uy '
      + 'qidiradi, Olmaliq, Chirchiq va Angrenda esa kon-metallurgiya va kimyo korxonalarining '
      + 'xodimlari. Uy fondi shunga yarasha ikki xil — sanoat shaharchalaridagi 4-5 qavatli '
      + 'bloklar va tuman markazlaridagi keng hovlili uylar. Bo‘stonliqda manzara butunlay '
      + 'boshqacha: Chorvoq va Chimyon atrofida ijara ko‘proq mavsumiy va kunlik bo‘ladi. '
      + 'Poytaxtga qatnaydigan bo‘lsangiz, elektropoezd yoki marshrutka bekatigacha bo‘lgan '
      + 'masofani e’londa aniqlab oling.',
    highlights: [
      'Olmaliq kon-metallurgiya kombinati',
      'Chirchiq sanoat zonasi',
      'Chorvoq suv ombori',
      'Chimyon tog‘ kurorti',
      'Toshkentga elektropoezd qatnovi',
      'Parkent va Bo‘stonliq bog‘lari',
    ],
  },

  samarqand: {
    about:
      'Samarqandda ijara bozorini ikki narsa harakatga keltiradi — talabalar va turizm. SamDU, '
      + 'SamISI va tibbiyot institutida o‘quv yili boshlanishi bilan universitetlar atrofidagi '
      + 'bir-ikki xonali kvartiralar tez band bo‘ladi, mavsumda esa Registon va Go‘ri Amir '
      + 'yaqinidagi uylar mehmonxonaga muqobil sifatida kunlik ijaraga chiqadi. Shahar markazida '
      + 'ta’mirlangan past qavatli eski uylar, yangi mahallalarda esa zamonaviy ko‘p qavatli '
      + 'binolar ustun. Kattaqo‘rg‘on va Urgutda narx sezilarli past, lekin markazga har kunlik '
      + 'qatnov vaqtini oldindan hisobga oling.',
    highlights: [
      'Registon majmuasi',
      'SamDU talabalar shaharchasi',
      'Go‘ri Amir maqbarasi',
      'Urgut bozori',
      'Samarqand turistik markazi',
      'Samarqand xalqaro aeroporti',
    ],
  },

  fargona: {
    about:
      'Farg‘ona vodiysi mamlakatdagi eng zich joylashgan hudud va bu ijaraga to‘g‘ridan-to‘g‘ri '
      + 'ta’sir qiladi: bo‘sh xonadon kam, yaxshi e’lon esa tez yopiladi. Farg‘ona shahrida FarDU '
      + 'va neftni qayta ishlash zavodi atrofida talab yuqori, Marg‘ilonda atlas va adras '
      + 'ustaxonalari bilan bog‘liq oilalar, Qo‘qonda esa savdo bilan shug‘ullanuvchilar uy '
      + 'izlaydi. Uy fondining katta qismi hovlili uylar va past qavatli bloklardan iborat, '
      + 'shuning uchun alohida kirishli hovli varianti bu yerda odatiy hol. Shaharlar bir-biriga '
      + 'yaqin — Quvasoy yoki Marg‘ilonda yashab, Farg‘onaga qatnash ko‘p oilalar uchun arzonroq '
      + 'chiqadi.',
    highlights: [
      'FarDU o‘quv binolari',
      'Marg‘ilon atlas ustaxonalari',
      'Yodgorlik ipak fabrikasi',
      'Qo‘qondagi Xudoyorxon o‘rdasi',
      'Farg‘ona neftni qayta ishlash zavodi',
      'Quvasoy sanoat korxonalari',
    ],
  },

  andijon: {
    about:
      'Andijonda ijara talabining eng aniq manbasi — Asakadagi UzAuto Motors zavodi va uning '
      + 'atrofidagi ta’minotchi korxonalar: smenali ishchilar ko‘pincha zavodga yaqin, tez '
      + 'topshiriladigan uy izlaydi. Andijon shahrida bozorning ikkinchi yarmini Andijon davlat '
      + 'universiteti va tibbiyot instituti talabalari tashkil qiladi. Uy fondi markazdagi ko‘p '
      + 'qavatli bloklar va chekka mahallalardagi hovlili uylardan iborat, xonadonlar odatda '
      + 'oilaviy va uzoq muddatga topshiriladi. Xonobod va Asakada narx shahar markazidan past, '
      + 'ammo qatnov uchun avtobus jadvalini oldindan tekshirib qo‘ying.',
    highlights: [
      'Asakadagi UzAuto Motors zavodi',
      'Andijon davlat universiteti',
      'Andijon tibbiyot instituti',
      'Bobur nomidagi bog‘',
      'Andijon markaziy bozori',
      'Xonobod sanoat hududi',
    ],
  },

  namangan: {
    about:
      'Namangan aholisining yoshi bo‘yicha mamlakatdagi eng yosh shaharlardan biri va ijara '
      + 'bozori ham shunga mos: talabalar, yangi oila qurganlar va yaqin tumanlardan ishga '
      + 'kelganlar asosiy mijozlar. NamDU va Namangan muhandislik-texnologiya instituti '
      + 'joylashgan hududda bir va ikki xonali kvartiralar o‘quv yili boshida ayniqsa tez ketadi. '
      + 'Shahar tarixan bog‘dorchilik va gulchilik bilan mashhur, shuning uchun chekka '
      + 'mahallalarda katta hovlisi bor uylar ko‘p uchraydi. Chust, Pop va Kosonsoyda narx '
      + 'pastroq, lekin markazga qatnov vaqtini hisobga olish kerak.',
    highlights: [
      'NamDU o‘quv binolari',
      'Muhandislik-texnologiya instituti',
      'Chust pichoqchilik ustaxonalari',
      'Namangan gul bozori',
      'Kosonsoy suv ombori',
      'Markaziy avtovokzal',
    ],
  },

  buxoro: {
    about:
      'Buxoroda ijara bozori tarixiy markaz atrofida to‘plangan: Labi Hovuz va Poyi Kalon '
      + 'yaqinidagi uylar ko‘pincha kunlik yoki mavsumiy ijaraga chiqadi, chunki ular sayyohlar '
      + 'uchun mehmonxonaga muqobil. Uzoq muddatli ijara izlayotganlar odatda markazdan chetdagi '
      + 'yangi mahallalarga va Buxoro davlat universiteti atrofiga qaraydi. Eski shaharning bir '
      + 'qismi muhofaza ostidagi past qavatli hovlili uylardan iborat — ular chiroyli, lekin '
      + 'isitish va ta’mir masalasini oldindan aniqlashtirish kerak. Kogonda temir yo‘l tugunida '
      + 'ishlaydiganlar, G‘ijduvonda esa hunarmandchilik bilan band oilalar uchun narx sezilarli '
      + 'arzon.',
    highlights: [
      'Ark qal’asi va Labi Hovuz',
      'Buxoro davlat universiteti',
      'Poyi Kalon majmuasi',
      'Kogon temir yo‘l tuguni',
      'G‘ijduvon kulolchilik ustaxonalari',
      'Eski shahar mehmon uylari',
    ],
  },

  qashqadaryo: {
    about:
      'Qashqadaryodagi ijara bozorini asosan gaz sanoati shakllantiradi: Muborak va Sho‘rtandagi '
      + 'konlar hamda qayta ishlash majmualari vaxta usulida ishlaydigan mutaxassislarni olib '
      + 'keladi, ular esa Qarshida oylik xonadon oladi. Talabning ikkinchi qismi Qarshi davlat '
      + 'universiteti talabalari va viloyat idoralari xodimlaridan chiqadi. Shahrisabzda manzara '
      + 'boshqacha — Oqsaroy va tarixiy markaz atrofida sayyohlarga mo‘ljallangan qisqa muddatli '
      + 'ijara ko‘proq uchraydi. Uy fondi asosan 4-5 qavatli bloklar va keng hovlili uylardan '
      + 'iborat, markazdan chiqqan sari narx tez tushadi.',
    highlights: [
      'Qarshi davlat universiteti',
      'Sho‘rtan gaz-kimyo majmuasi',
      'Muborak gazni qayta ishlash zavodi',
      'Shahrisabzdagi Oqsaroy',
      'Qarshi markaziy bozori',
      'Viloyat ko‘p tarmoqli tibbiyot markazi',
    ],
  },

  surxondaryo: {
    about:
      'Surxondaryo — mamlakatning eng janubiy va eng issiq hududi, shuning uchun bu yerda uy '
      + 'tanlashda konditsioner va soyali hovli narxga jiddiy ta’sir qiladi. Termizda talab '
      + 'Afg‘oniston bilan chegara savdosi, yuk terminallari va Termiz davlat universiteti '
      + 'atrofida to‘planadi; logistika bilan bog‘liq xodimlar ko‘pincha bir necha oylik ijara '
      + 'qidiradi. Denov va Sherobodda uy fondi deyarli butunlay hovlili uylardan iborat, '
      + 'ko‘pchilik limonzor va issiqxona xo‘jaligi bilan shug‘ullanadi. Shartnomada yozgi elektr '
      + 'yuklamasi va suv ta’minoti kimning zimmasida ekanini albatta yozib qo‘ying.',
    highlights: [
      'Termiz davlat universiteti',
      'Do‘stlik chegara ko‘prigi',
      'Termiz yuk terminali',
      'Denov limonzorlari',
      'Qadimgi Termiz yodgorliklari',
      'Termiz xalqaro aeroporti',
    ],
  },

  xorazm: {
    about:
      'Xorazmda ijara ikki qutbli: Urganch — ma’muriy va o‘quv markazi, Xiva esa sayyohlik '
      + 'shahri. Urganch davlat universiteti va viloyat kasalxonalari atrofida uzoq muddatli '
      + 'kvartira ijarasi ustun, Xivada esa Ichan-Qal’a devorlari yonidagi hovlili uylarning '
      + 'ko‘pi mehmon uyiga aylangan. Uy fondida bir qavatli, ichki hovlili an’anaviy uylar '
      + 'salmoqli o‘rin egallaydi; ko‘p qavatli bloklar asosan Urganch markazida. Qishda shamol '
      + 'va sovuq kuchli bo‘lgani uchun isitish tizimi qanday ishlashini uyni ko‘rgan paytingizda '
      + 'so‘rab oling.',
    highlights: [
      'Ichan-Qal’a muzey-qo‘riqxonasi',
      'Urganch davlat universiteti',
      'Urganch xalqaro aeroporti',
      'Xiva mehmon uylari hududi',
      'Urganch markaziy bozori',
      'Viloyat ko‘p tarmoqli shifoxonasi',
    ],
  },

  navoiy: {
    about:
      'Navoiy — sanoat uchun rejalab qurilgan yosh shahar va uning ijara bozori kon-metallurgiya '
      + 'kombinati hamda erkin iqtisodiy zona bilan bevosita bog‘liq. Shartnoma asosida keladigan '
      + 'muhandislar va konchilik institutining talabalari bir hamda ikki xonali kvartiralarni '
      + 'tez band qiladi. Shahar rejali qurilgani uchun uy fondi bir xilroq: keng ko‘chalar '
      + 'bo‘ylab tartibli 4-9 qavatli bloklar, hovlili uylar esa kam uchraydi. Zarafshonda vaziyat '
      + 'alohida — u konchilar shaharchasi, kirish va yashash tartibini ish beruvchi orqali '
      + 'oldindan aniqlab olgan ma’qul.',
    highlights: [
      'Navoiy kon-metallurgiya kombinati',
      'Navoiy erkin iqtisodiy zonasi',
      'Navoiy xalqaro yuk aeroporti',
      'Davlat konchilik instituti',
      'Zarafshon konchilar shaharchasi',
      'Markaziy xiyobon va bozor',
    ],
  },

  jizzax: {
    about:
      'Jizzax ijara bozori ixcham, lekin unda ikki aniq oqim bor: Jizzax politexnika institutida '
      + 'o‘qiydiganlar va shahar chekkasidagi sanoat zonasida ishlaydiganlar. Shahar '
      + 'Toshkent–Samarqand yo‘nalishi ustida joylashgani uchun bu yerda vaqtinchalik, bir necha '
      + 'oylik ijara ham odatiy hol. Uy fondida markazdagi 4-5 qavatli bloklar va chekka '
      + 'mahallalardagi hovlili uylar ustun turadi. Zomin tomonda esa gap boshqa: milliy bog‘ va '
      + 'sanatoriylar tufayli ijara mavsumiy — yozda hamda dam olish kunlarida narx ko‘tariladi.',
    highlights: [
      'Jizzax politexnika instituti',
      'Zomin milliy bog‘i',
      'Jizzax sanoat zonasi',
      'Toshkent–Samarqand yo‘li',
      'G‘allaorol tuman markazi',
      'Viloyat markaziy shifoxonasi',
    ],
  },

  sirdaryo: {
    about:
      'Sirdaryo mamlakatdagi eng kichik viloyatlardan biri va uning ijara bozori ham shunga '
      + 'yarasha ixcham. Gulistonda asosiy talab Guliston davlat universiteti talabalari va '
      + 'viloyat idoralari xodimlaridan chiqadi, Shirinda esa issiqlik elektr stansiyasi va u '
      + 'bilan bog‘liq korxonalarda ishlaydiganlar uy izlaydi. Atrofdagi paxta va g‘alla '
      + 'xo‘jaliklari tufayli mavsumiy, bir necha oylik ijara so‘rovlari ko‘p uchraydi. Uy fondi '
      + 'asosan past qavatli bloklar va hovlili uylardan iborat; Toshkentga temir yo‘l orqali '
      + 'qatnov qulay, shuning uchun poytaxtga qatnab ishlaydiganlar ham bor.',
    highlights: [
      'Guliston davlat universiteti',
      'Sirdaryo issiqlik elektr stansiyasi',
      'Yangiyer sanoat korxonalari',
      'Guliston markaziy bozori',
      'Toshkentga temir yo‘l qatnovi',
      'Viloyat tibbiyot birlashmasi',
    ],
  },

  qoraqalpogiston: {
    about:
      'Qoraqalpog‘istonda ijara bozori deyarli butunlay Nukusda to‘plangan: Berdaq nomidagi '
      + 'Qoraqalpoq davlat universiteti, respublika kasalxonalari va idoralari shu shaharda. '
      + 'Savitskiy muzeyi hamda Orol yo‘nalishi tufayli keladigan sayyohlar va tadqiqotchilar '
      + 'qisqa muddatli ijaraning alohida qatlamini hosil qilgan. Uy fondi asosan sovet davrida '
      + 'qurilgan past va o‘rta qavatli bloklar hamda keng hovlili uylardan iborat, Xo‘jayli va '
      + 'To‘rtko‘lda narx Nukusdan sezilarli past. Iqlim quruq va shamolli — uyni ko‘rganda suv '
      + 'ta’minoti va isitish qanday ishlashini alohida so‘rang.',
    highlights: [
      'Qoraqalpoq davlat universiteti',
      'Savitskiy nomidagi muzey',
      'Nukus xalqaro aeroporti',
      'Respublika tibbiyot markazi',
      'Nukus markaziy bozori',
      'Xo‘jayli temir yo‘l bekati',
    ],
  },
};

export const UZ_DISTRICT_PROFILES: Record<string, PlaceProfile> = {
  chilonzor: {
    about:
      'Chilonzor — Toshkentning aholisi eng ko‘p tumani va shaharning ommaviy uy-joy qurilishi '
      + 'aynan shu yerdan boshlangan. Uy fondining asosini raqamlangan kvartallarga bo‘lingan, '
      + '1960-70-yillarda qurilgan 4-9 qavatli panel uylar tashkil qiladi: narx markazdagidan '
      + 'past, hovlilar esa yashil va bolalar maydonchalari bilan. Metroning eng qadimgi liniyasi '
      + 'tumanni ko‘ndalang kesib o‘tadi — Chilonzor, Novza va Mirzo Ulug‘bek bekatlari markazga '
      + 'yigirma daqiqada olib boradi. Talabalar va yosh oilalar uchun bu ko‘pincha birinchi '
      + 'ijara varianti bo‘ladi; eski uylarda quvur, elektr va derazalar holatini oldindan ko‘rib '
      + 'chiqing.',
    highlights: [
      'Chilonzor dehqon bozori',
      'Chilonzor va Novza bekatlari',
      'Milliy bog‘',
      'Ippodrom savdo hududi',
      'Raqamlangan kvartallar',
    ],
  },

  yunusobod: {
    about:
      'Yunusobod — Toshkentning shimoliy va nisbatan yosh tumani: uylarning katta qismi '
      + '1980-yillardan keyin qurilgan, so‘nggi yillarda esa ularga biznes markazlar va qimmat '
      + 'turar-joy majmualari qo‘shildi. Bu yerda elchixonalar, xalqaro tashkilotlar va yirik '
      + 'ofislar ko‘p, shuning uchun ijara bozorida chet ellik xodimlar salmog‘i sezilarli — narx '
      + 'shahar o‘rtachasidan yuqori. Yunusobod metro liniyasi Minor, Bodomzor va Shahriston '
      + 'bekatlari orqali tumanni markazga hamda Tashkent City tomonga ulaydi. Yangi majmualarda '
      + 'kommunal to‘lov va boshqaruv kompaniyasi haqi ijaradan alohida hisoblanishi mumkin — '
      + 'buni shartnoma imzolashdan oldin aniqlang.',
    highlights: [
      'Yunusobod metro liniyasi',
      'Elchixonalar hududi',
      'Toshkent teleminorasi',
      'Minor masjidi',
      'Tashkent City yaqinligi',
      'Olimpiya tennis kortlari',
    ],
  },

  mirobod: {
    about:
      'Mirobod — markazning temir yo‘l bilan bog‘langan qismi: Toshkent vokzali, uning atrofidagi '
      + 'mehmonxonalar va Oloy bozori shu tumanda. Uy fondi qorishiq — o‘tgan asr o‘rtalaridagi '
      + 'past qavatli uylar, keyingi davr bloklari va markaz yaqinida qurilgan yangi majmualar '
      + 'bitta ko‘chada uchrashib qoladi. Oybek, Kosmonavtlar va Toshkent bekatlari bir necha '
      + 'daqiqalik masofada, shuning uchun bu yerda mashinasiz yashash oson va ijara ham shunga '
      + 'yarasha qimmat. Vokzal atrofida shovqin va qatnov ko‘p — deraza qaysi tomonga qaraganiga '
      + 'uyni ko‘rgan paytingizda e’tibor bering.',
    highlights: [
      'Toshkent temir yo‘l vokzali',
      'Oloy bozori',
      'Oybek va Kosmonavtlar bekatlari',
      'Sayilgoh ko‘chasi yaqinligi',
      'Markaziy ofislar hududi',
    ],
  },

  'mirzo-ulugbek': {
    about:
      'Mirzo Ulug‘bek — Toshkentning ilmiy-o‘quv sharqi: O‘zbekiston Milliy universiteti talabalar '
      + 'shaharchasi, Fanlar akademiyasi institutlari va ular atrofida o‘nlab yillar davomida '
      + 'shakllangan turar-joy massivlari shu yerda. Shuning uchun ijara bozorida talabalar, '
      + 'tadqiqotchilar va o‘qituvchilar ustun — sentyabr oldidan bir xonali kvartira hamda '
      + 'sherikchilik e’lonlari juda tez yopiladi. Uy fondi asosan 1970-80-yillardagi to‘qqiz '
      + 'qavatli uylar va yashil hovlilardan iborat, Buyuk Ipak Yo‘li bekati esa markazga '
      + 'to‘g‘ridan-to‘g‘ri chiqaradi. Botanika bog‘i va zoopark yonidagi ko‘chalar tinchroq, '
      + 'ammo metrogacha piyoda yurish uzoqroq.',
    highlights: [
      'O‘zbekiston Milliy universiteti',
      'Fanlar akademiyasi institutlari',
      'Buyuk Ipak Yo‘li bekati',
      'Botanika bog‘i',
      'Toshkent zoopark',
      'Talabalar shaharchasi',
    ],
  },

  olmazor: {
    about:
      'Olmazor — shaharning shimoli-g‘arbi va uning nomi ko‘pchilik uchun ikki oliygoh bilan '
      + 'bog‘liq: Toshkent davlat texnika universiteti, ya’ni hamma hanuz Politexnika deb '
      + 'ataydigan joy, hamda Toshkent tibbiyot akademiyasi. Shu ikki markaz tufayli arzon bir '
      + 'xonali kvartira va sherikchilikka talab bu yerda yil davomida saqlanadi. Uy fondi asosan '
      + 'o‘rta qavatli sovet davri uylaridan iborat, hovlilarda katta daraxtlar bor, narx esa '
      + 'markazdan ancha past. Eng eski metro liniyasining oxirgi bekati shu tumanda — vagonda '
      + 'joy tegishi ehtimoli yuqori, lekin markazga yo‘l yarim soatga cho‘ziladi.',
    highlights: [
      'Toshkent davlat texnika universiteti',
      'Toshkent tibbiyot akademiyasi',
      'Olmazor oxirgi metro bekati',
      'Talabalar yotoqxonalari hududi',
      'Yashil hovlili eski kvartallar',
    ],
  },

  yakkasaroy: {
    about:
      'Yakkasaroy — maydoni bo‘yicha kichik, lekin markazga eng yaqin tumanlardan biri: Anhor '
      + 'kanali bo‘yidan Shota Rustaveli ko‘chasigacha bo‘lgan oraliqni piyoda kesib o‘tish '
      + 'mumkin. Uy fondida ikki qatlam bor — sokin ko‘chalardagi past qavatli eski uylar va '
      + 'kengroq ko‘chalar bo‘yidagi zamonaviy majmualar. Paxtakor markaziy stadioni, kafelar, '
      + 'xususiy klinikalar va Mustaqillik maydoni yaqinligi tufayli bu yerda mashina qo‘yish '
      + 'joyi masalasi ijaraning o‘zidan ham dolzarbroq bo‘lib chiqadi. Narx markaziy tumanlar '
      + 'darajasida, ammo qatnovga vaqt sarflamaslik ko‘pchilik uchun shu farqni oqlaydi.',
    highlights: [
      'Paxtakor markaziy stadioni',
      'Mustaqillik maydoni yaqinligi',
      'Anhor kanali bo‘yi',
      'Shota Rustaveli ko‘chasi',
      'Piyoda yuriladigan markaz',
    ],
  },

  sergeli: {
    about:
      'Sergeli so‘nggi yillarda Toshkentning eng tez qurilayotgan qismiga aylandi: janubda birin '
      + 'ketin yangi turar-joy massivlari ko‘tarildi, shuning uchun bu yerda yangi binodagi '
      + 'kvartirani markazdagi eski uy narxidan arzonroqqa topish mumkin. Yerusti metro liniyasi '
      + 'Sergeli va Qipchoq bekatlari orqali shahar markaziga to‘g‘ridan-to‘g‘ri chiqaradi. '
      + 'Aholining katta qismi yosh oilalar; ba’zi massivlarda bog‘cha, maktab va do‘konlar '
      + 'uylardan keyinroq ochiladi, buni oldindan tekshirgan ma’qul. Ijaraga olishdan oldin uy '
      + 'qaysi massivda ekanini va bekatgacha piyoda necha daqiqa ketishini aniqlashtiring.',
    highlights: [
      'Sergeli va Qipchoq bekatlari',
      'Yerusti metro liniyasi',
      'Yangi turar-joy massivlari',
      'Yosh oilalar kvartallari',
      'Xona hisobida arzon narx',
    ],
  },

  shayxontohur: {
    about:
      'Shayxontohur — Toshkentning eski shahri: Chorsu bozorining ko‘k gumbazi, Ko‘kaldosh '
      + 'madrasasi va Hazrati Imom majmuasi shu tumanda. Uy fondi ham shunga yarasha o‘ziga xos — '
      + 'tor ko‘chalardagi an’anaviy mahalla uylari bilan Navoiy ko‘chasi bo‘yidagi ko‘p qavatli '
      + 'bloklar yonma-yon turadi. Chorsu va G‘afur G‘ulom bekatlari markazga ham, bozorga ham '
      + 'bir necha daqiqada olib boradi, shuning uchun savdo bilan band odamlar uchun bu tuman '
      + 'ayniqsa qulay. Mahalla uyini ijaraga olayotgan bo‘lsangiz, kirish alohidami yoki hovli '
      + 'egalar bilan umumiymi — shuni birinchi savol qilib bering.',
    highlights: [
      'Chorsu bozori',
      'Ko‘kaldosh madrasasi',
      'Hazrati Imom majmuasi',
      'Chorsu va G‘afur G‘ulom bekatlari',
      'Eski shahar mahallalari',
    ],
  },

  yashnobod: {
    about:
      'Yashnobod — sanoat va turar joy aralashgan sharqiy tuman: Toshkent xalqaro aeroporti, '
      + 'mashinasozlik korxonalari va yirik Qo‘yliq bozori shu yerda joylashgan. Ijara narxi '
      + 'markazdagidan past, shuning uchun tumanni smenali ishlaydiganlar, aeroport va logistika '
      + 'xodimlari hamda bozor bilan bog‘liq oilalar tanlaydi. Uy fondi asosan zavodlar atrofida '
      + 'qurilgan sovet davri bloklaridan iborat, chekkaroq mahallalarda esa hovlili uylar ko‘p. '
      + 'Aeroportga yaqin ko‘chalarda samolyot ovozi seziladi — uy qaysi ko‘chada ekanini xaritada '
      + 'tekshirib ko‘ring.',
    highlights: [
      'Toshkent xalqaro aeroporti',
      'Qo‘yliq bozori',
      'Mashinasozlar metro bekati',
      'Do‘stlik metro bekati',
      'Sanoat korxonalari hududi',
    ],
  },

  uchtepa: {
    about:
      'Uchtepa — shaharning g‘arbi va ko‘pchilik uni Farhod bozori orqali biladi: bozor '
      + 'atrofidagi savdo, ustaxona va omborlar bu yerdagi ijara talabining katta qismini hosil '
      + 'qiladi. Turar-joy fondi deyarli butunlay sovet davri panel va g‘isht bloklaridan iborat, '
      + 'shuning uchun narx shahar bo‘yicha eng past qatorda turadi. Beruniy va Tinchlik bekatlari '
      + 'tumandan markazga bitta liniyada olib chiqadi, avtobus va marshrutkalar esa Chilonzor '
      + 'tomonga qatnaydi. Eski uylarda lift, quvur va elektr simlari yangilanganmi — shartnomadan '
      + 'oldin buni so‘rash odat bo‘lgan.',
    highlights: [
      'Farhod bozori',
      'Beruniy metro bekati',
      'Tinchlik metro bekati',
      'Sovet davri kvartallari',
      'Shahar bo‘yicha past narx',
    ],
  },

  bektemir: {
    about:
      'Bektemir — Toshkentning eng kichik tumani: Chirchiq daryosi bo‘yida, shaharning '
      + 'janubi-sharqiy chekkasida joylashgan va uzoq vaqt alohida shaharcha bo‘lib kelgan. Bu '
      + 'yerda ko‘p qavatli uylar kam, aholining katta qismi bog‘i bor past qavatli uylarda '
      + 'yashaydi, ijara narxi esa poytaxt bo‘yicha eng arzon qatorda. Tuman sanoat korxonalari va '
      + 'ombor hududlari bilan chegaradosh, ammo turar-joy qismi shaharning eng jim joylaridan '
      + 'biri hisoblanadi. Markazga qatnash uchun halqa yo‘li liniyasidagi bekatlar va avtobuslar '
      + 'ishlatiladi — ish joyingizgacha yo‘l vaqtini oldindan o‘lchab ko‘ring.',
    highlights: [
      'Chirchiq daryosi bo‘yi',
      'Halqa yo‘li metro bekatlari',
      'Bog‘li past qavatli uylar',
      'Sanoat va ombor zonasi',
      'Poytaxtdagi eng arzon ijara',
    ],
  },

  yangihayot: {
    about:
      'Yangihayot — Toshkentning eng yosh tumani: u 2020-yilda Sergelidan ajratib chiqarilgan va '
      + 'deyarli butunlay yangi qurilish hisobiga o‘smoqda. Shu sababli ijaraga chiqadigan '
      + 'xonadonlarning katta qismi topshirilganiga bir necha yil bo‘lgan majmualarda — lift, '
      + 'quvur va derazalar yangi, hovlilar esa parking bilan rejalashtirilgan. Aholi asosan yosh '
      + 'oilalar va poytaxtga ko‘chib kelganlardan iborat; ba’zi kvartallarda maktab, bog‘cha va '
      + 'do‘konlar hali to‘liq ochilmagan bo‘lishi mumkin. Yerusti metro va halqa yo‘li bekatlari '
      + 'markazga chiqishni yengillashtiradi, lekin uy aynan qaysi bekatga yaqinligini e’londa '
      + 'tekshiring.',
    highlights: [
      'Yangihayot metro bekati',
      'Yangi turar-joy majmualari',
      'Halqa yo‘li bekatlari',
      'Yosh oilalar tumani',
      'Zamonaviy hovli va parkinglar',
    ],
  },
};
