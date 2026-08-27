/**
 * Uzbek long-form editorial: the six guide articles and the four help pages.
 *
 * These are the only pages on the site that are written rather than generated.
 * Everything else — district landings, category pages, listing metadata — is
 * assembled from the taxonomy by `copy.uz.ts`, which means the templates there
 * have to stay generic. This file is where the site is allowed to be specific:
 * what a Tashkent lease actually says about the deposit, which scam is running
 * this season, what a student should settle with a roommate before signing.
 *
 * Two constraints govern the text and are worth stating so the next editor
 * keeps them:
 *
 *  - No invented figures. Not one price in so‘m, not one listing count, not
 *    one "87% of tenants". Rent in Tashkent moves faster than a static file
 *    is redeployed, so the price article describes the forces that set a
 *    price and lets the live listings show the number.
 *  - The product is rental only. Nothing here discusses buying or selling
 *    property, and the guides should never drift there.
 *
 * The two legal pages (`foydalanish-shartlari`, `maxfiylik-siyosati`) are a
 * plain-language summary written for a reader, not a contract drafted by a
 * lawyer, and each says so in its own text. They deliberately name no company
 * registration number, address or licence.
 */

import type { Article, HelpArticle } from './types';

export const UZ_ARTICLES: Article[] = [
  {
    slug: 'maklersiz-uy-topish',
    title: 'Maklersiz uy topish: amaliy qo‘llanma',
    summary:
      'Uy egasining o‘zini qanday topish kerak va telefondagi odam makler ekanini birinchi '
      + 'suhbatdayoq qanday bilib olish mumkin.',
    publishedAt: '2025-11-18',
    updatedAt: '2026-06-12',
    readingMinutes: 6,
    h1: 'Maklersiz uy topish va maklerni birinchi qo‘ng‘iroqda tanib olish',
    intro:
      'Toshkentda ham, viloyat shaharlarida ham uy izlash odatda bir xil boshlanadi: e’lonlar '
      + 'ro‘yxatiga kirasiz, o‘nlab variantni ko‘rasiz, birontasiga qo‘ng‘iroq qilasiz — va '
      + 'go‘shakning narigi tomonidagi odam uy egasi emas, vositachi bo‘lib chiqadi. U sizni '
      + 'uyga olib boradi, kalitni ko‘rsatadi va ko‘pincha bir oylik ijaraga teng haq so‘raydi. '
      + 'Bu pul ta’mir uchun ham, hujjat uchun ham emas — u faqat telefon raqamni bilgani uchun '
      + 'olinadi. Uy egasining o‘zi bilan gaplashish esa mumkin: buning uchun qidiruvni to‘g‘ri '
      + 'boshlash va bir nechta oddiy belgini bilish kifoya. Quyida o‘sha belgilar va uy '
      + 'ko‘rishdan kelishuvgacha bo‘lgan yo‘lning amaliy tartibi keltirilgan.',
    sections: [
      {
        heading: 'Izlashni boshlashdan oldin uchta chegarani belgilang',
        paragraphs: [
          'Uy izlashda eng ko‘p vaqt "arzonroq va yaxshiroq" degan noaniq talab bilan yo‘qoladi. '
            + 'Odam o‘n beshta uyni ko‘radi, hech biridan ko‘ngli to‘lmaydi, oxirida charchab, '
            + 'birinchi uchragan variantga rozi bo‘ladi — va aynan o‘shani keyin pushaymon bo‘lib '
            + 'tashlab ketadi. Shuning uchun qidiruvdan oldin uchta chegarani aniq yozib oling.',
          'Birinchisi — pul. Bu faqat oylik ijara emas. Ko‘chib o‘tadigan oyda odatda ijara '
            + 'haqi ustiga zakladka ham qo‘shiladi, ya’ni birinchi oy deyarli har doim ikki '
            + 'barobar chiqadi. Ikkinchisi — geografiya, lekin tuman nomi bilan emas, yo‘l vaqti '
            + 'bilan o‘lchangani: ishxonangizgacha eshikdan eshikkacha qancha vaqt ketishi '
            + 'tumanning obro‘sidan ko‘ra muhimroq. Uchinchisi — muddat: olti oyga va bir yilga '
            + 'kelishilgan narx ko‘pincha bir xil bo‘lmaydi, uzoqroq muddatga uy egalari yon '
            + 'bosishga tayyorroq turadi.',
        ],
        bullets: [
          'Ko‘chib o‘tishga jami qancha pul tayyor: ijara, zakladka va birinchi oyning kommunali.',
          'Ish yoki o‘quv joyingizgacha eshikdan eshikkacha necha daqiqa — piyoda va transportda.',
          'Necha oyga kerak va shu muddat ichida narx o‘zgarmasligini kelishib olasizmi.',
          'Uy jihozlangan bo‘lishi shartmi yoki mebelingiz o‘zingizda bormi.',
          'Bola, uy hayvoni yoki sherik bilan yashaysizmi — buni birinchi qo‘ng‘iroqda ayting.',
        ],
      },
      {
        heading: 'E’lonni kim joylaganini qanday aniqlash mumkin',
        paragraphs: [
          'Vositachining e’loni odatda o‘zini fosh qiladi, faqat qarashni bilish kerak. Uy '
            + 'egasi o‘z uyini bir marta va batafsil suratga oladi: xonalar, oshxona, hammom, '
            + 'kirish qismi, derazadan ko‘rinish. Vositachining rasmlari esa ko‘pincha faqat '
            + 'eng chiroyli ikkita burchakni ko‘rsatadi, podyezd va hovli tushirilmagan bo‘ladi, '
            + 'chunki maqsad uyni ko‘rsatish emas — qo‘ng‘iroq qildirish.',
          'Matnning uslubi ham ko‘p narsani aytadi. Uy egasi "kvartiram bo‘sh qoldi, uzoq '
            + 'muddatga beraman" deb yozadi; vositachi esa "bazamizda variantlar ko‘p", "sizga '
            + 'mos uyni tanlab beramiz", "hududni ayting, tanlaymiz" deb yozadi. Aniq manzil '
            + 'yoki hech bo‘lmasa mo‘ljal ko‘rsatilmagani ham xarakterli belgi: uy egasi '
            + 'qaysi ko‘chada ekanini yashirishga sabab ko‘rmaydi.',
          'Telefonda tekshirish yanada oson. Faqat egasi biladigan narsalarni so‘rang: hujjat '
            + 'kimning nomida, hisoblagichlar o‘rnatilganmi, qo‘shnilar kim, uyda oxirgi marta '
            + 'qachon ta’mir bo‘lgan. Vositachi bu savollarga umumiy javob beradi yoki '
            + '"borganda ko‘rasiz" deydi. Uy egasi esa hech ikkilanmay javob beradi, chunki bu '
            + 'uning o‘z uyi.',
        ],
        bullets: [
          'Bitta raqam bir vaqtning o‘zida turli tumanlardagi o‘nlab e’londa uchraydi.',
          'Rasmlar chiroyli, lekin uyning umumiy ko‘rinishi, podyezd va hovli yo‘q.',
          'Matnda "baza", "variantlar", "tanlab beramiz" degan so‘zlar bor.',
          'Manzil aytilmaydi, mo‘ljal esa "keyin aytamiz" deb qoldiriladi.',
          'Narx atrofdagi shunga o‘xshash uylardan sezilarli past — bu ko‘pincha yem.',
        ],
      },
      {
        heading: 'Birinchi qo‘ng‘iroqda so‘raladigan savollar',
        paragraphs: [
          'Birinchi suhbat besh daqiqadan oshmasligi kerak, lekin o‘sha besh daqiqa keraksiz '
            + 'yurishlarning yarmini oldini oladi. Savollarni ketma-ket, xotirjam bering — bu '
            + 'talabchanlik emas, oddiy amaliyot, va normal uy egasi buni yaxshi tushunadi.',
          'Alohida e’tibor narxning tarkibiga qaratilsin. O‘zbekistonda "kommunal alohida" degan '
            + 'ibora har xil narsani anglatishi mumkin: ba’zi uylarda bu faqat suv va gaz, '
            + 'ba’zilarida esa ko‘p qavatli uy boshqaruvi to‘lovi, internet va qishki isitish '
            + 'ham qo‘shiladi. Buni telefondayoq aniqlab olsangiz, keyinchalik oy oxirida '
            + 'kutilmagan hisob chiqmaydi.',
        ],
        bullets: [
          'Uy hujjati kimning nomida va shartnomani kim imzolaydi?',
          'Narxga nimalar kiradi: suv, gaz, svet, isitish, uy boshqaruvi to‘lovi, internet?',
          'Zakladka qancha, qaysi holatda to‘liq qaytariladi?',
          'Kelishuv necha oyga va shu muddat ichida narx oshadimi?',
          'Uyda hozir kim yashayapti va qachondan bo‘shaydi?',
        ],
      },
      {
        heading: 'Uyni ko‘rganda nimaga qarash kerak',
        paragraphs: [
          'Uyni imkon bo‘lsa kunduzi va kechqurun — ikki marta ko‘ring. Kunduzi yorug‘lik, '
            + 'namlik va derazadan ko‘rinish ma’lum bo‘ladi; kechqurun esa podyezd yoritilganmi, '
            + 'hovlida qanday odamlar yig‘iladi, qo‘shnilardan shovqin keladimi — shulari. '
            + 'Yuqori qavatlarda suv bosimini tekshirish shart: kranni oching va issiq suv necha '
            + 'soniyada kelishini o‘zingiz ko‘ring.',
          'Isitish masalasi O‘zbekistonda alohida turadi. Uy markaziy isitishdami, kolonkadami '
            + 'yoki elektr isitgichlarga tayanadimi — bu qishki kommunal hisobni butunlay '
            + 'o‘zgartiradi. Xuddi shunday, elektr quvvati ham muhim: eski uylarda kondisioner, '
            + 'kir yuvish mashinasi va isitgich bir vaqtda ishlaganda avtomat tushib qolishi '
            + 'odatiy hol.',
        ],
        bullets: [
          'Suv bosimi va issiq suv — kranni o‘zingiz oching, aytilganiga ishonmang.',
          'Isitish turi va o‘tgan qishda kommunal qancha chiqqani.',
          'Derazalar, eshik qulfi, hammomdagi nam dog‘lar va shift izlari.',
          'Uyali aloqa va internet signali — telefoningizda shu yerda tekshiring.',
          'Podyezd, lift, hovli, avtoturargoh va qo‘shnilar bilan qisqa suhbat.',
        ],
      },
      {
        heading: 'Pul faqat shartnomadan keyin beriladi',
        paragraphs: [
          'Bu qoidada istisno yo‘q. Uyni o‘z ko‘zingiz bilan ko‘rmaguningizcha, hujjatni '
            + 'ko‘rmaguningizcha va yozma shartnoma imzolanmaguncha hech kimga hech qancha pul '
            + 'o‘tkazmang — na "band qilib turish uchun", na "kalitni olib qo‘yish uchun". '
            + 'Oldindan to‘lov so‘rovi eng keng tarqalgan firibgarlik sxemasining boshlanishi.',
          'Pulni topshirganda tilxat oling yoki hech bo‘lmasa shartnomaning o‘zida "qabul '
            + 'qilindi" degan yozuv va imzo bo‘lsin. Zakladka shartnomada alohida band bilan '
            + 'yozilishi kerak: qancha, nima uchun ushlab qolinishi mumkin va necha kun ichida '
            + 'qaytariladi. Bu bir daqiqalik ish, lekin ko‘chib chiqish paytidagi bahsning '
            + 'aksariyatini yo‘q qiladi.',
        ],
      },
    ],
    faq: [
      {
        q: 'Maklersiz uy topish rostdan ham mumkinmi?',
        a:
          'Ha, chunki uy egalarining katta qismi o‘z uyini o‘zi topshirishni afzal ko‘radi — '
          + 'ular ham vositachiga foiz bermoqchi emas. Muhimi, e’lonni egasi joylagan joydan '
          + 'izlash va birinchi suhbatda hujjat kimning nomida ekanini so‘rash.',
      },
      {
        q: 'Vositachi o‘zini uy egasi deb tanishtirsa nima bo‘ladi?',
        a:
          'Uyni ko‘rgach, shartnoma imzolash payti hammasi ochiladi: hujjat boshqa odamning '
          + 'nomida bo‘ladi va "egasi keyin keladi" deyiladi. Shu daqiqada to‘xtang. Egasi '
          + 'ishtirok etmagan yoki ishonchnoma ko‘rsatmagan kelishuvga pul bermang.',
      },
      {
        q: 'Uy egasi zakladka so‘rasa, bu normalmi?',
        a:
          'Ha, zakladka O‘zbekistonda odatiy amaliyot va u vositachilik haqi emas — bu uyga '
          + 'zarar yetmasa qaytariladigan garov. Faqat uning miqdori va qaytarish sharti '
          + 'shartnomada yozilgan bo‘lishi kerak.',
      },
    ],
  },

  {
    slug: 'ijara-shartnomasi-tekshirish',
    title: 'Ijara shartnomasi: nimani tekshirish kerak',
    summary:
      'Ijara shartnomasida qanday bandlar bo‘lishi shart, zakladka qanday yoziladi va uydan '
      + 'chiqishdan oldin nimani hujjatlashtirish kerak.',
    publishedAt: '2025-12-04',
    updatedAt: '2026-07-21',
    readingMinutes: 7,
    h1: 'Ijara shartnomasini imzolashdan oldin nimani tekshirish kerak',
    intro:
      'O‘zbekistonda uy ijarasi ko‘pincha og‘zaki kelishuv bilan boshlanadi: "yaxshi odamsiz, '
      + 'ishonaman" deyiladi va pul beriladi. Muammo shundaki, ishonch ikki tomon bir xil '
      + 'narsani eslab qolganda ishlaydi. Olti oydan keyin uy egasi "isitish sizning '
      + 'hisobingizdan edi" deydi, ijarachi esa "yo‘q, narxga kirardi" deydi — va ikkalasi ham '
      + 'chin dildan haq ekaniga ishonadi. Yozma shartnoma birovni aldashdan saqlash uchun emas, '
      + 'aynan shu xotira farqini yo‘q qilish uchun kerak. Quyida oddiy ijara shartnomasida '
      + 'nima bo‘lishi kerakligi, zakladka bandini qanday yozish va ko‘chib chiqish paytidagi '
      + 'bahslarni oldindan qanday yopish mumkinligi ko‘rsatilgan.',
    sections: [
      {
        heading: 'Shartnoma nega yozma bo‘lishi kerak',
        paragraphs: [
          'Yozma shartnoma ikkala tomonni ham himoya qiladi, va bu ijarachiga qaraganda uy '
            + 'egasiga ba’zan ko‘proq kerak bo‘ladi: uyga zarar yetsa yoki ijarachi to‘lovni '
            + 'kechiktirsa, og‘zaki kelishuvdan hech narsa qolmaydi. Shuning uchun shartnoma '
            + 'taklif qilgan uy egasi shubhali emas, aksincha — jiddiy odam.',
          'Shartnomani ikki nusxada chop eting, ikkalasini ham ikki tomon imzolasin va har '
            + 'kim o‘z nusxasini olsin. Har bir varaqning pastiga qisqa imzo qo‘yish odati '
            + 'ham foydali: keyinchalik oraliqdagi varaq almashtirildi degan bahs chiqmaydi. '
            + 'Imzolangan shartnomani telefoningizga suratga olib qo‘ying — qog‘oz yo‘qoladi, '
            + 'surat qolaveradi.',
        ],
      },
      {
        heading: 'Shartnomada albatta bo‘lishi kerak bo‘lgan bandlar',
        paragraphs: [
          'Yaxshi ijara shartnomasi uzun bo‘lishi shart emas. Ikki bet ham yetadi, faqat unda '
            + 'quyidagi savollarning har biriga bir jumlalik aniq javob bo‘lsin. Agar '
            + 'shartnomada bandlardan biri tushib qolgan bo‘lsa, uni qo‘lda yozib qo‘shish va '
            + 'yon tomoniga ikkala tomon imzo qo‘yishi mumkin — bu butunlay qonuniy amaliyot.',
          'Alohida diqqat narxning barqarorligiga qaratilsin. "Narx bozorga qarab o‘zgarishi '
            + 'mumkin" degan noaniq jumla amalda uy egasiga istalgan oyda narxni oshirish '
            + 'huquqini beradi. Uning o‘rniga muddat va aniq shart yozilsin: masalan, narx '
            + 'shartnoma muddati davomida o‘zgarmaydi.',
        ],
        bullets: [
          'Tomonlar: ism-sharif, pasport ma’lumotlari va aloqa raqamlari.',
          'Uyning aniq manzili, xonalar soni va maydoni.',
          'Oylik ijara haqi, uni qaysi sanada va qanday usulda to‘lash.',
          'Narx qancha muddat davomida o‘zgarmasligi.',
          'Kommunal to‘lovlar kimning zimmasida — har biri alohida sanab o‘tilgan holda.',
          'Zakladka miqdori, ushlab qolish asoslari va qaytarish muddati.',
          'Shartnoma muddati va uni uzaytirish tartibi.',
          'Bekor qilishdan oldin necha kun avval ogohlantirish shart.',
          'Uyda kim yashaydi: ijarachidan tashqari oila a’zolari, sherik, uy hayvoni.',
          'Ta’mir va buzilgan jihozlarni kim tuzatadi.',
        ],
      },
      {
        heading: 'Zakladka: eng ko‘p bahs chiqadigan band',
        paragraphs: [
          'Zakladka — bu uy egasining kelajakdagi zararga qarshi garovi, ijara haqining '
            + 'oldindan to‘langan qismi emas. Farqi muhim: ko‘p ijarachi oxirgi oyni zakladka '
            + 'hisobidan yashab, keyin uy egasi bilan janjallashadi. Shartnomada bu ochiq '
            + 'yozilsin: zakladka oxirgi oy ijarasi o‘rniga o‘tadimi yoki alohida qaytariladimi.',
          'Ikkinchi muhim jumla — nima uchun ushlab qolinishi mumkinligi. Umumiy "zarar '
            + 'yetkazilsa" degan ibora yetarli emas, chunki uy egasi devordagi eski dog‘ni ham '
            + 'zarar deb hisoblashi mumkin. Tabiiy eskirish — masalan, oshxona devorining vaqt '
            + 'o‘tishi bilan xiralashuvi — zarar emasligini alohida yozib qo‘yish bahsning '
            + 'yarmini oldindan yopadi.',
          'Uchinchisi — muddat. "Chiqqandan keyin qaytariladi" degan jumla amalda oylab '
            + 'cho‘zilishi mumkin. Aniq son yozing: uyni topshirgan kundan boshlab necha kun '
            + 'ichida va qaysi usulda qaytariladi.',
        ],
      },
      {
        heading: 'Kommunal to‘lovlar va hisoblagichlar',
        paragraphs: [
          'Ko‘chib kirgan kuni suv, gaz va elektr hisoblagichlarining ko‘rsatkichini yozib '
            + 'oling va har birini suratga tushiring. Bu bir daqiqalik ish, lekin oldingi '
            + 'ijarachining qarzi sizning zimmangizga o‘tib qolishining oldini oladi. '
            + 'Ko‘rsatkichlarni shartnomaga ilova qilib yozib qo‘yish eng ishonchli yo‘l.',
          'Ko‘p qavatli uylarda uy boshqaruvi yoki turar joy mulkdorlari shirkatiga to‘lov '
            + 'ham bo‘ladi, hovlili uylarda esa chiqindi va suv alohida hisoblanishi mumkin. '
            + 'Har birini nomma-nom shartnomada belgilang: "kommunal ijarachi zimmasida" degan '
            + 'bitta jumla keyinchalik kutilmagan hisoblarga aylanadi.',
        ],
      },
      {
        heading: 'Inventarizatsiya ro‘yxati va uydan chiqish',
        paragraphs: [
          'Jihozlangan uyni olayotgan bo‘lsangiz, mebel va texnika ro‘yxatini tuzing: '
            + 'muzlatgich, kir yuvish mashinasi, kondisioner, gaz plitasi, mebel — har biri '
            + 'qanday holatda ekani bir necha so‘z bilan yozilsin. Ro‘yxatni ikki tomon '
            + 'imzolasin va uyning barcha xonalarini ko‘chib kirgan kuni suratga oling. '
            + 'Chiqayotganda o‘sha suratlar sizning eng kuchli dalilingiz bo‘ladi.',
          'Chiqish tartibini ham oldindan kelishing: necha kun avval ogohlantirasiz, uyni '
            + 'qanday holatda topshirasiz, kalitni kimga berasiz. Odatda bir oy oldin '
            + 'ogohlantirish yetarli deb hisoblanadi, lekin bu shartnomada yozilgan bo‘lsagina '
            + 'ishlaydi. Uyni topshirgan kuni oxirgi hisoblagich ko‘rsatkichlarini yana yozib '
            + 'oling va zakladka qaytarilganini tasdiqlovchi qisqa tilxat oling.',
        ],
        bullets: [
          'Ko‘chib kirganda: barcha xonalar surati va uch hisoblagich ko‘rsatkichi.',
          'Texnika ro‘yxati — modeli, holati, ishlayotgani tekshirilgani.',
          'Chiqishdan necha kun oldin ogohlantirish sharti.',
          'Zakladka qaytarilganda tilxat yoki yozma tasdiq.',
        ],
      },
    ],
    faq: [
      {
        q: 'Shartnomani notarial tasdiqlash shartmi?',
        a:
          'Oddiy uzoq muddatli ijarada ko‘pchilik oddiy yozma shakl bilan cheklanadi. Notarial '
          + 'tasdiq shartnomaga qo‘shimcha kuch beradi va yirik summalar yoki uzoq muddat '
          + 'nazarda tutilganda ma’qul yo‘l. Aniq holatingiz uchun yuristdan maslahat oling.',
      },
      {
        q: 'Uy egasi shartnoma tuzishni istamasa nima qilish kerak?',
        a:
          'Sababini so‘rang. Ba’zan bu shunchaki odat masalasi bo‘ladi va bir betlik oddiy '
          + 'shartnoma bilan hal bo‘ladi. Agar keskin rad etilsa, bu jiddiy ogohlantiruvchi '
          + 'belgi — bunday uyga zakladka qoldirmaslik ma’qul.',
      },
      {
        q: 'Muddat tugamasdan chiqib ketsam, zakladka kuyadimi?',
        a:
          'Bu shartnomada nima yozilganiga bog‘liq. Shuning uchun imzolashdan oldin muddatidan '
          + 'oldin bekor qilish bandini o‘qing: ko‘p shartnomada bir oy oldin ogohlantirilsa, '
          + 'zakladka to‘liq qaytariladi degan shart bo‘ladi.',
      },
    ],
  },

  {
    slug: 'toshkent-ijara-narxlari',
    title: 'Toshkentda ijara narxini nima belgilaydi',
    summary:
      'Tuman, metrogacha masofa, qavat, jihoz, uy turi va mavsum ijara narxiga qanday ta’sir '
      + 'qiladi — raqamsiz, omillar bo‘yicha tushuntirish.',
    publishedAt: '2026-01-27',
    updatedAt: '2026-07-03',
    readingMinutes: 6,
    h1: 'Toshkentda ijara narxini nima belgilaydi',
    intro:
      'Bu maqolada birorta ham narx raqami yo‘q, va bu ataylab shunday. Toshkentdagi ijara '
      + 'narxi mavsumga, tumanga va hatto ko‘chaning qaysi tomoniga qarab bir necha hafta '
      + 'ichida o‘zgaradi; yozib qo‘yilgan har qanday raqam bir oydan keyin yolg‘onga aylanadi. '
      + 'Foydaliroq narsa — narxni nima ko‘taradi va nima tushiradi, buni bilish. Shunda '
      + 'e’lonlar ro‘yxatiga qaraganingizda "qimmat" yoki "arzon" degan tuyg‘uga emas, aniq '
      + 'sabablarga tayanasiz va uy egasi bilan gaplashganda nima uchun narx shunday ekanini '
      + 'tushunasiz. Quyida Toshkent bozorida haqiqatan ishlaydigan olti omil.',
    sections: [
      {
        heading: 'Tuman va markazgacha bo‘lgan masofa',
        paragraphs: [
          'Toshkent narx bo‘yicha bir jinsli shahar emas. Mirobod, Yakkasaroy va Shayxontohurning '
            + 'markazga tutash qismlari an’anaviy ravishda eng qimmat hisoblanadi: ish joylari, '
            + 'idoralar va xizmatlar shu yerda to‘plangan. Chilonzor, Yunusobod va Mirzo Ulugʻbek '
            + 'o‘rtacha qatlamni tashkil qiladi, Sergeli, Bektemir va Yashnobodning chekka '
            + 'mahallalari esa odatda arzonroq turadi.',
          'Lekin tuman nomi o‘zi hech narsani anglatmaydi. Bir xil tumanning ikki uchidagi '
            + 'kvartira narxi keskin farq qilishi mumkin, chunki ahamiyatli narsa — mo‘ljal. '
            + 'Katta bozor, xalqaro maktab yoki yirik biznes markazga yaqin uy o‘sha tumanning '
            + 'chekka qismidagi xuddi shunday uydan qimmatroq bo‘ladi.',
          'Shuning uchun qidiruvni tumandan emas, o‘zingiz har kuni boradigan nuqtadan '
            + 'boshlagan ma’qul: o‘sha nuqtadan atrofga qarab kengaying. Ko‘pincha bir bekat '
            + 'narida turgan uy sezilarli arzonroq chiqadi, yo‘l vaqti esa deyarli o‘zgarmaydi.',
        ],
      },
      {
        heading: 'Metro va yo‘l vaqti',
        paragraphs: [
          'Metroga yaqinlik Toshkentda narxning eng barqaror omillaridan biri. Bekatgacha '
            + 'piyoda o‘n daqiqa yo‘l bo‘lgan uy, yigirma daqiqalik uydan doim qimmatroq '
            + 'turadi — hatto ikkalasi bir ko‘chada bo‘lsa ham. Shahar uch yer osti yo‘nalishi '
            + 'va yer usti Halqa yo‘li liniyasi bilan qoplangani uchun, e’lonlarda bekat nomi '
            + 'ko‘pincha tuman nomidan ko‘ra aniqroq mo‘ljal beradi.',
          'Metrodan uzoq, lekin asosiy avtobus yo‘nalishiga yaqin joylar shu tufayli qiziq '
            + 'nuqta bo‘lib qoladi: narx metro atrofidagidan past, real yo‘l vaqti esa ba’zan '
            + 'undan yomon emas. Qidiruvda faqat "metroga yaqin" filtriga tayanmang — kunning '
            + 'tirbandlik soatida haqiqiy yo‘l vaqtini bir marta o‘zingiz o‘lchab ko‘ring.',
        ],
        bullets: [
          'Bekatgacha piyoda vaqt — e’londa ko‘rsatilgan bo‘lsa, uni albatta hisobga oling.',
          'Qaysi liniya: markazga bir marta o‘tirib boriladimi yoki almashish kerakmi.',
          'Tirbandlik soatidagi real yo‘l vaqti, xaritadagi ideal vaqt emas.',
          'Yaqin atrofda bozor, poliklinika va maktab bormi.',
        ],
      },
      {
        heading: 'Uy turi: sovet davri fondi va yangi qurilishlar',
        paragraphs: [
          'Toshkentning turar joy fondi ikki katta qatlamdan iborat. Birinchisi — sovet '
            + 'davrida qurilgan panel va g‘ishtli uylar: shiftlari pastroq, xonalari ixcham, '
            + 'lekin joylashuvi ko‘pincha juda qulay, chunki o‘sha mahallalar metro va '
            + 'infratuzilma atrofida shakllangan. Ikkinchisi — so‘nggi yillardagi yangi '
            + 'qurilish majmualari: lift, yopiq hovli, avtoturargoh va zamonaviy planirovka.',
          'Yangi uylar odatda qimmatroq, ammo bu farq har doim ham qulaylikning farqi emas. '
            + 'Yangi majmuada uy boshqaruvi to‘lovi yuqoriroq bo‘lishi mumkin, atrofdagi '
            + 'infratuzilma esa hali to‘liq shakllanmagan bo‘ladi. Eski fonddagi yaxshi '
            + 'ta’mirlangan kvartira ko‘p hollarda pul-vaqt nisbatida yutuqliroq chiqadi.',
          'G‘ishtli uylar issiqlikni panelga qaraganda yaxshiroq ushlaydi va bu qishki '
            + 'kommunalda seziladi. Uyning devor turi e’londa ko‘rsatilmagan bo‘lsa, ko‘rgani '
            + 'borganda so‘rab qo‘ying.',
        ],
      },
      {
        heading: 'Qavat, ta’mir va jihoz',
        paragraphs: [
          'Birinchi va oxirgi qavat deyarli har doim arzonroq. Birinchi qavatda shovqin, '
            + 'namlik va xavfsizlik masalasi bor; oxirgi qavatda esa tom va yozgi issiq. '
            + 'O‘rta qavatlar eng talab qilinadigani, ayniqsa liftli uylarda. Liftsiz besh '
            + 'qavatli uyning to‘rtinchi-beshinchi qavati esa narxni sezilarli tushiradi.',
          'Ta’mir va jihoz — narxning eng katta ko‘taruvchisi. To‘liq jihozlangan, texnikasi '
            + 'bor kvartira bo‘sh kvartiradan ancha qimmat turadi, chunki ijarachi ko‘chib '
            + 'kelgan kuniyoq yashay boshlaydi. Agar mebelingiz o‘zingizda bo‘lsa, bo‘sh uy '
            + 'izlash mantiqan arzonroq chiqadi — faqat bunday e’lonlar kamroq bo‘ladi.',
        ],
        bullets: [
          'Qavat va liftning bor-yo‘qligi.',
          'Ta’mir darajasi: yangi, o‘rtacha yoki eskirgan.',
          'Texnika: muzlatgich, kir yuvish mashinasi, kondisioner, plita.',
          'Isitish turi — markaziy, kolonka yoki elektr.',
          'Alohida sanuzel, balkon, ombor xonasi.',
        ],
      },
      {
        heading: 'Mavsum va kelishuv shartlari',
        paragraphs: [
          'Toshkentda ijara bozori aniq mavsumga ega. Avgust oxiri va sentabr — yilning eng '
            + 'qizg‘in davri: o‘quv yili boshlanadi, talabalar va viloyatlardan kelgan oilalar '
            + 'bir vaqtda uy izlaydi, tanlov qisqaradi va uy egalari narxda yon bosmaydi. '
            + 'Qish o‘rtasida esa aksincha: e’lon kamroq, lekin har bir uy egasi uzoqroq '
            + 'kutgan bo‘ladi va muzokara uchun joy ko‘proq qoladi.',
          'Shartlarning o‘zi ham narxga ta’sir qiladi. Uzoq muddatga kelishuv, o‘z vaqtida '
            + 'to‘lash tarixi va bir nechta oyni oldindan to‘lash taklifi ko‘pincha narxni '
            + 'pasaytiradi. Aksincha, uy hayvoni, ko‘p odam bilan yashash yoki qisqa muddat '
            + 'uni ko‘taradi. Bularning hammasi muzokara mavzusi — narx e’londa yozilgani '
            + 'bilan tugamaydi.',
        ],
      },
    ],
    faq: [
      {
        q: 'Nega bu sahifada aniq narxlar yozilmagan?',
        a:
          'Chunki ular tez o‘zgaradi va yozib qo‘yilgan raqam ko‘p o‘tmay noto‘g‘ri bo‘lib '
          + 'qoladi. Hozirgi real narxlarni ko‘rish uchun e’lonlar ro‘yxatini oching va uni '
          + 'narx bo‘yicha saralang — bu har qanday o‘rtacha ko‘rsatkichdan aniqroq.',
      },
      {
        q: 'Narxni tushirish uchun muzokara qilsa bo‘ladimi?',
        a:
          'Ha, ayniqsa uzoq muddatga kelishayotgan bo‘lsangiz yoki e’lon uzoq vaqtdan beri '
          + 'osilib turgan bo‘lsa. Muzokarani hurmat bilan va aniq taklif bilan boshlang: '
          + 'masalan, bir yilga kelishuv yoki to‘lov sanasini uy egasiga qulay qilish.',
      },
      {
        q: 'Qachon uy izlagan ma’qul?',
        a:
          'Iloji bo‘lsa avgust-sentabr shiddatidan tashqarida. Qish oylarida tanlov kamroq, '
          + 'lekin raqobat ham past bo‘ladi va shartlarni kelishish osonroq kechadi.',
      },
    ],
  },

  {
    slug: 'ijarada-firibgarlikdan-saqlanish',
    title: 'Ijarada firibgarlikdan qanday saqlanish kerak',
    summary:
      'O‘zbekistonda uchraydigan ijara firibgarligining asosiy sxemalari va har birini '
      + 'oldindan tanib olishning amaliy usullari.',
    publishedAt: '2026-02-19',
    updatedAt: '2026-08-01',
    readingMinutes: 7,
    h1: 'Ijara firibgarligining sxemalari va ulardan qanday saqlanish kerak',
    intro:
      'Ijara firibgarligining deyarli barchasi bitta narsaga tayanadi: shoshilish. Odam uy '
      + 'topolmay charchagan bo‘ladi, arzon e’lonni ko‘radi, "boshqasi olib qo‘yadi" degan '
      + 'qo‘rquv paydo bo‘ladi — va aynan shu daqiqada oldindan pul o‘tkazadi. Sxemalar '
      + 'o‘zgaradi, kanallar o‘zgaradi, lekin mexanizm o‘n yildan beri o‘zgargani yo‘q. Quyida '
      + 'O‘zbekistonda eng ko‘p uchraydigan beshta sxema va har birini nima bilan tanib olish '
      + 'mumkinligi keltirilgan. Ularning hech biri murakkab emas: agar bitta qoidani — uyni '
      + 'ko‘rmasdan va hujjatni tekshirmasdan pul bermaslikni — buzmasangiz, ko‘pchiligi '
      + 'sizga ta’sir qilolmaydi.',
    sections: [
      {
        heading: 'Uyni ko‘rmasdan turib oldindan to‘lov',
        paragraphs: [
          'Eng keng tarqalgan sxema. E’lon jozibali, narx bozordagidan past, rasmlar chiroyli. '
            + 'Suhbatdosh "hozir shahardan tashqaridaman" yoki "chet eldaman" deydi va uyni '
            + 'band qilib turish uchun kichik summa so‘raydi. Pul o‘tkazilgach, raqam o‘chadi.',
          'Bu sxemaning kuchi psixologiyada: so‘ralgan summa ataylab kichik bo‘ladi, chunki '
            + 'odam katta pulni o‘ylab ko‘radi, kichik pulni esa "xavf ozgina-ku" deb '
            + 'o‘tkazaveradi. Firibgar esa yuzlab odamdan shu kichik summani yig‘adi.',
          'Qoida oddiy: uyni o‘z ko‘zingiz bilan ko‘rmaguningizcha va uy egasi bilan yuzma-yuz '
            + 'uchrashmaguningizcha hech qanday to‘lov yo‘q. "Band qilish", "kalitni ushlab '
            + 'turish", "kelishuvni tasdiqlash" — bularning hammasi bir xil so‘rov.',
        ],
      },
      {
        heading: 'Boshqa uyning rasmlari',
        paragraphs: [
          'Ikkinchi sxema — internetdan yoki boshqa e’londan olingan rasmlar. Uy chiroyli '
            + 'ko‘rinadi, lekin u umuman mavjud emas yoki butunlay boshqa shaharda. Ba’zan '
            + 'rasmlar haqiqiy uyniki bo‘ladi, faqat uni e’lon bergan odam emas, boshqa kishi '
            + 'ijaraga bermoqda.',
          'Tekshirish oson. Rasmda mebel joylashuvi, deraza yo‘nalishi va yorug‘lik bir-biriga '
            + 'mos keladimi, xonalar bitta uyga tegishlimi — diqqat bilan qarang. Jurnal '
            + 'muqovasidek toza, odam izi yo‘q, birorta shaxsiy buyum ko‘rinmaydigan rasmlar '
            + 'shubha tug‘diradi. Eng ishonchli usul esa video: uy egasidan telefon orqali '
            + 'jonli video qo‘ng‘iroq qilib, uyni real vaqtda ko‘rsatishni so‘rang. Firibgar '
            + 'buni deyarli hech qachon bajara olmaydi.',
        ],
        bullets: [
          'Rasmlar juda "jurnalona" va uyda yashash izlari yo‘q.',
          'Podyezd, hovli va derazadan ko‘rinish tushirilmagan.',
          'Jonli video qo‘ng‘iroqdan bosh tortiladi yoki bahona topiladi.',
          'Bir xil rasmlar boshqa manzil bilan boshqa e’londa ham uchraydi.',
        ],
      },
      {
        heading: '"Agentlik xizmati" va ma’lumot sotish',
        paragraphs: [
          'Bu sxemada sizdan uy uchun emas, ro‘yxat uchun pul so‘raladi: "to‘lovni qiling, '
            + 'sizga bazadagi uy egalarining raqamlarini beramiz". Pul to‘langach, siz eskirgan '
            + 'yoki boshqa odamlarga ham sotilgan raqamlar ro‘yxatini olasiz. Qo‘ng‘iroq '
            + 'qilasiz — uylar allaqachon topshirilgan bo‘ladi, pul esa qaytmaydi.',
          'Ba’zan bu ochiqdan-ochiq "shartnoma rasmiylashtirish", "sayt xizmati" yoki "e’lon '
            + 'ko‘rish haqi" deb ataladi. Bunday to‘lovlarning hech biri normal amaliyot emas. '
            + 'Ijarachi uchun uy izlash bepul: pul faqat uy egasiga, faqat uyni ko‘rgach va '
            + 'faqat shartnoma asosida to‘lanadi.',
        ],
      },
      {
        heading: 'Kalit evaziga zakladka',
        paragraphs: [
          'Bu ancha nozik sxema, chunki unda odam siz bilan haqiqatan uchrashadi. Sizni uyga '
            + 'olib boradi, ko‘rsatadi, hatto kalitni qo‘lingizga tutqazadi va o‘sha yerda '
            + 'zakladka so‘raydi. Ammo shartnoma imzolanmaydi, hujjat ko‘rsatilmaydi, tilxat '
            + 'berilmaydi. Ertasiga uyga kelsangiz, qulf almashgan bo‘lishi yoki uyda boshqa '
            + 'odam yashayotgani ma’lum bo‘lishi mumkin.',
          'Himoya vositasi bitta: pul faqat imzolangan shartnoma va hujjat ko‘rsatilgandan '
            + 'keyin. Hujjat kimning nomida ekanini ko‘ring, pasport bilan solishtiring. Agar '
            + 'uy egasi o‘zi emas, qarindoshi topshirayotgan bo‘lsa, uning ishonchnomasini '
            + 'so‘rang. Bu qo‘pollik emas — bu oddiy tartib, va halol odam bundan ranjimaydi.',
        ],
      },
      {
        heading: 'O‘zi ijaraga olgan uyni boshqaga topshirish',
        paragraphs: [
          'Subijara sxemasida odam uyni haqiqatan qisqa muddatga ijaraga oladi, keyin uni '
            + 'o‘zini egasi qilib ko‘rsatib, bir necha kishiga bir vaqtda topshiradi. Hammadan '
            + 'zakladka va bir oylik to‘lovni oladi va yo‘qoladi. Zarar ko‘rganlar esa uyning '
            + 'haqiqiy egasi bilan yuzma-yuz qoladi.',
          'Aynan shuning uchun hujjatni tekshirish shart. Shartnomada uy egasi sifatida '
            + 'ko‘rsatilgan ism mulk hujjatidagi ism bilan bir xil bo‘lishi kerak. Agar bir '
            + 'xil bo‘lmasa, u odamning uyni qayta ijaraga berish huquqi yozma tasdiqlangan '
            + 'bo‘lishi shart. Bu bir daqiqalik tekshiruv butun sxemani ishlamay qoldiradi.',
        ],
        bullets: [
          'Hujjatdagi ism va shartnomadagi ism bir xilmi.',
          'Pasport ko‘rsatildimi va u hujjatdagi shaxsga to‘g‘ri keladimi.',
          'Egasi o‘zi kelmasa, ishonchnoma bormi.',
          'Uyni ko‘rsatayotgan odam qo‘shnilarga tanishmi — bir og‘iz so‘rab ko‘ring.',
        ],
      },
      {
        heading: 'Agar aldangan bo‘lsangiz',
        paragraphs: [
          'Birinchi navbatda barcha dalilni saqlang: yozishmalar, e’lon surati, telefon '
            + 'raqam, to‘lov cheki yoki o‘tkazma tasdig‘i. Ekran suratlarini darhol oling — '
            + 'e’lon va akkaunt bir necha soat ichida o‘chirilishi mumkin.',
          'Keyin ichki ishlar organlariga murojaat qiling va shu bilan birga e’lonni '
            + 'platformada shikoyat tugmasi orqali belgilang. Bu ikkinchi qadam ko‘pincha '
            + 'e’tibordan chetda qoladi, holbuki aynan u keyingi odamni saqlab qoladi: '
            + 'belgilangan e’lon moderatsiyaga tushadi va o‘sha raqam boshqa e’lonlarda ham '
            + 'tekshiriladi.',
        ],
      },
    ],
    faq: [
      {
        q: 'Uyni band qilish uchun oldindan pul berish kerakmi?',
        a:
          'Yo‘q. Uyni ko‘rmasdan turib berilgan har qanday "band qilish" to‘lovi xavfli. '
          + 'Haqiqiy uy egasi sizni uyga taklif qiladi va pul masalasini uchrashuvda, '
          + 'shartnoma bilan hal qiladi.',
      },
      {
        q: 'Uy egasi hujjatni ko‘rsatishdan bosh tortsa-chi?',
        a:
          'Bu jiddiy ogohlantiruvchi belgi. Hujjatdagi ismni ko‘rish — pasportning barcha '
          + 'sahifasini surat qilish emas, oddiy tekshiruv. Rad javobi bo‘lsa, kelishuvni '
          + 'davom ettirmang.',
      },
      {
        q: 'Shubhali e’lonni ko‘rsam nima qilaman?',
        a:
          'E’lon sahifasidagi shikoyat tugmasini bosing va nimasi shubhali ekanini qisqacha '
          + 'yozing. Moderatorlar uni tekshiradi, o‘sha telefon raqam esa boshqa e’lonlar '
          + 'bo‘yicha ham nazoratga olinadi.',
      },
    ],
  },

  {
    slug: 'talabalar-uchun-kvartira-tanlash',
    title: 'Talabalar uchun uy tanlash bo‘yicha qo‘llanma',
    summary:
      'Universitetga yaqinmi yoki metroga yaqin, yotoqxonami yoki ijara, sherik bilan nimani '
      + 'oldindan kelishib olish kerak — talabalar uchun.',
    publishedAt: '2026-04-08',
    updatedAt: '2026-06-30',
    readingMinutes: 5,
    h1: 'Talaba sifatida uy tanlash: universitet, metro va sherik masalasi',
    intro:
      'Birinchi kurs boshlanishidan oldingi hafta O‘zbekistonda ijara bozorining eng '
      + 'shiddatli davri. Viloyatlardan kelgan minglab talaba bir vaqtda uy izlaydi, e’lonlar '
      + 'bir kunda yopiladi va shoshilinch qabul qilingan qarorlar butun o‘quv yiliga '
      + 'ta’sir qiladi. Ko‘pchilik keyin bitta narsadan afsuslanadi: uyni tanlashda faqat '
      + 'narxga qaragan, yo‘l vaqti va sherik masalasini esa "ko‘ramiz" deb qoldirgan. '
      + 'Quyida shu ikki masala va ular bilan bog‘liq amaliy qarorlar ko‘rib chiqilgan — '
      + 'universitetga yaqinlik bilan metroga yaqinlik o‘rtasidagi tanlovdan tortib, '
      + 'sherik bilan birinchi kunda kelishib olish kerak bo‘lgan narsalargacha.',
    sections: [
      {
        heading: 'Universitetga yaqinmi yoki metroga yaqin',
        paragraphs: [
          'Birinchi instinkt — universitetga imkon qadar yaqin joy topish. Bu mantiqli, ammo '
            + 'har doim ham eng yaxshi yechim emas. O‘quv binosiga tutash mahallalarda talab '
            + 'yuqori bo‘lgani uchun narx ham yuqori bo‘ladi, tanlov esa tor. Bir necha bekat '
            + 'narida, lekin metroga yaqin uy ko‘pincha arzonroq chiqadi va real yo‘l vaqti '
            + 'atigi bir necha daqiqaga uzayadi.',
          'Toshkentda bu ayniqsa seziladi. Vuzgorodok atrofi, Yunusobodning oliygohlar '
            + 'joylashgan qismi yoki Chilonzordagi o‘quv binolari yaqinidagi kvartiralar '
            + 'sentabrda tez tugaydi. Shu bilan birga, metro liniyasi bo‘ylab bir necha bekat '
            + 'narida joylashgan tumanlarda variant ko‘proq bo‘ladi.',
          'Qaror qabul qilishdan oldin bitta narsani aniqlang: darslaringiz haftada necha '
            + 'kun va qaysi soatlarda. Har kuni ertalabki juftlikka boradigan talaba uchun '
            + 'yaqinlik muhim; haftada uch kun va kunduzi o‘qiydigan talaba uchun esa '
            + 'arzonroq va tinchroq uy foydaliroq bo‘lishi mumkin.',
        ],
        bullets: [
          'Eshikdan auditoriyagacha real vaqt — ertalabki tirbandlikni hisobga olib.',
          'Kechki qaytish: o‘sha yo‘l qorong‘ida ham qulaymi.',
          'Yaqinda oshxona, do‘kon va kutubxona bormi.',
          'Internet tezligi — masofaviy dars va imtihon uchun.',
        ],
      },
      {
        heading: 'Yotoqxona va ijara: farqi nimada',
        paragraphs: [
          'Yotoqxona odatda arzonroq va tashkiliy jihatdan sodda: joy universitet orqali '
            + 'beriladi, kommunal alohida hisoblanmaydi, xavfsizlik nazorat ostida. Ayni '
            + 'paytda joy cheklangan, ichki tartib qat’iy va shaxsiy makon deyarli qolmaydi.',
          'Ijara qimmatroq, lekin ko‘proq erkinlik va tinch o‘qish sharoitini beradi, '
            + 'ayniqsa sherik bilan bo‘lishilganda. Ko‘p talaba uchun oraliq yechim eng '
            + 'to‘g‘ri variant bo‘lib chiqadi: ikki-uch kishi bo‘lib bir kvartira olish yoki '
            + 'katta kvartirada alohida xona ijaraga olish. Ikkinchisi umumiy oshxona va '
            + 'hammomni bo‘lishishni anglatadi, lekin narx bo‘yicha yotoqxonaga yaqin turadi.',
        ],
      },
      {
        heading: 'Sherik tanlash — uydan muhimroq masala',
        paragraphs: [
          'Yomon uyga bir yil chidasa bo‘ladi, mos kelmaydigan sherik bilan esa bir oy ham '
            + 'og‘ir. Shuning uchun sherikni tanlashda tanish-bilishlik yetarli emas: do‘st '
            + 'bo‘lish va birga yashash butunlay boshqa narsalar. Eng yaxshi tekshiruv — '
            + 'ko‘chib o‘tishdan oldin bir marta xotirjam o‘tirib, kundalik odatlar haqida '
            + 'ochiq gaplashish.',
          'Uch narsani albatta aniqlang: kim qachon uxlaydi, mehmon qanchalik tez-tez '
            + 'keladi va pul masalasi qanday hal qilinadi. Bu uchtasi sheriklikdagi '
            + 'nizolarning katta qismini tashkil qiladi. Ochiq gaplashish noqulay tuyulishi '
            + 'mumkin, lekin uch oydan keyingi janjaldan ancha oson.',
        ],
      },
      {
        heading: 'Sherik bilan oldindan kelishib olinadigan narsalar',
        paragraphs: [
          'Kelishuvni og‘zaki qoldirmang. Telefondagi oddiy eslatmaga yozib qo‘yish ham '
            + 'yetarli: muhimi, ikkalangiz ham bir xil narsani ko‘rgan bo‘lasiz. Ijara '
            + 'shartnomasida esa ikkala sherikning ismi bo‘lgani ma’qul — shunda javobgarlik '
            + 'ham, huquq ham teng bo‘ladi.',
          'Alohida e’tibor chiqib ketish holatiga qaratilsin. Sherik yarim yilda ko‘chib '
            + 'ketsa, qolgan oylar kimning zimmasida bo‘ladi va yangi sherikni kim topadi — '
            + 'buni oldindan aytib qo‘yish keyingi noqulay suhbatni butunlay yo‘q qiladi.',
        ],
        bullets: [
          'Ijara va kommunal qanday bo‘linadi, kim to‘playdi, qaysi sanada to‘lanadi.',
          'Zakladkani kim qo‘ydi va chiqishda u kimga qaytadi.',
          'Xonalarni taqsimlash: kattaroq xonaga ko‘proq to‘lanadimi.',
          'Mehmon va qarindoshlar qachon va qancha muddatga kelishi mumkin.',
          'Tozalik navbati va umumiy xaridlar — kim nima oladi.',
          'Sherik muddatidan oldin chiqib ketsa, nima bo‘ladi.',
        ],
      },
      {
        heading: 'Uy egasi bilan talaba sifatida gaplashish',
        paragraphs: [
          'Ba’zi uy egalari talabalarga uy berishga ehtiyot bo‘ladi — odatda shovqin va '
            + 'to‘lov barqarorligi sababli. Buni yengishning yo‘li ochiqlik: nechta kishi '
            + 'yashashini, qayerda o‘qishingizni va to‘lov qanday amalga oshirilishini '
            + 'boshidan ayting. Ota-ona kafolati yoki bir necha oyni oldindan to‘lash '
            + 'taklifi ko‘pincha masalani hal qiladi.',
          'Muddat masalasini ham aniq gaplashing. O‘quv yili sentabrdan iyungacha davom '
            + 'etadi, ko‘p talaba esa yozda uyga qaytadi. Agar yozda uyni bo‘shatmoqchi '
            + 'bo‘lsangiz, buni boshidan ayting va shartnomaga yozdiring — aks holda uch '
            + 'oylik ijara qarz bo‘lib qolishi mumkin.',
        ],
      },
    ],
    faq: [
      {
        q: 'Talaba uchun sheriklik e’lonini qayerdan izlash kerak?',
        a:
          'Sheriklikka mo‘ljallangan alohida bo‘lim bor va unda jins bo‘yicha tanlash '
          + 'mumkin. E’lonni sherik izlayotgan talabaning o‘zi ham, kvartirasiga sherik '
          + 'qidirayotgan uy egasi ham joylashi mumkin.',
      },
      {
        q: 'Uy egasi ota-onamning kafolatini so‘rasa, bu normalmi?',
        a:
          'Ha, bu keng tarqalgan amaliyot va sizga qarshi shubha emas. Odatda ota-onaning '
          + 'aloqa raqami va telefon orqali tasdig‘i yetarli bo‘ladi.',
      },
      {
        q: 'Yozda uyni bo‘shatib turish mumkinmi?',
        a:
          'Faqat uy egasi rozi bo‘lsa va bu shartnomada yozilgan bo‘lsa. Aks holda bo‘sh '
          + 'turgan oylar uchun ham to‘lov talab qilinadi, shuning uchun bu masalani '
          + 'imzolashdan oldin hal qiling.',
      },
    ],
  },

  {
    slug: 'uy-egasi-uchun-elon-yozish',
    title: 'Qo‘ng‘iroq keltiradigan e’lon qanday yoziladi',
    summary:
      'Uy egalari uchun: qanday rasm kerak, tavsifda nima yozish va nimani oldindan aytish '
      + 'kerak, tasdiqlash nega yordam beradi.',
    publishedAt: '2026-05-14',
    updatedAt: '2026-07-16',
    readingMinutes: 6,
    h1: 'Uy egasi uchun: qo‘ng‘iroq keltiradigan e’lon qanday yoziladi',
    intro:
      'Ikkita bir xil kvartira bir xil tumanda, bir xil narxda turadi. Biri bir hafta ichida '
      + 'topshiriladi, ikkinchisi bir oy davomida bo‘sh qoladi. Farq deyarli har doim uyda '
      + 'emas, e’londa bo‘ladi. Ijarachi kuniga o‘nlab e’lonni ko‘radi va har biriga bir '
      + 'necha soniya ajratadi: rasmga qaraydi, narxni ko‘radi, birinchi ikki qatorni o‘qiydi '
      + 'va davom etadi. Shu bir necha soniyada uyingiz haqida yetarli tasavvur bermasangiz, '
      + 'e’lon pastga tushib ketadi. Yaxshi e’lon yozish esa qiyin ish emas — u bir soatlik '
      + 'ehtiyotkorlik, va bu bir soat ko‘pincha bo‘sh turgan haftalarni tejaydi.',
    sections: [
      {
        heading: 'Rasmlar — e’lonning to‘qson foizi',
        paragraphs: [
          'Rasmlarni kunduzi, quyoshli havoda oling. Chiroqni yoqing, pardalarni oching, '
            + 'ortiqcha buyumlarni yig‘ishtiring — bu ta’mir emas, oddiy tayyorgarlik. '
            + 'Har bir xonani eshik oldidan, burchakdan turib oling: shunda xona kattaroq '
            + 'va tushunarliroq ko‘rinadi. Telefon kamerasi mutlaqo yetarli, faqat qo‘l '
            + 'qimirlamasin.',
          'Eng ko‘p uchraydigan xato — faqat ikkita "eng chiroyli" rasm qo‘yish. Ijarachi '
            + 'ko‘rmagan narsasidan shubhalanadi va bunday e’lonni ochmaydi ham. Barcha '
            + 'xonani, oshxonani, hammomni, balkonni va podyezdni ko‘rsating. Hatto eskirgan '
            + 'joyni ham: uni yashirsangiz, ijarachi kelib ko‘radi, ranjiydi va ketadi — '
            + 'siz esa bekorga vaqt yo‘qotasiz.',
        ],
        bullets: [
          'Kunduzgi yorug‘lik, yoqilgan chiroq, ochiq pardalar.',
          'Har bir xona, oshxona, hammom, balkon — hech biri qoldirilmasin.',
          'Derazadan ko‘rinish, podyezd va hovli.',
          'Rasmlar bir kunda olingan va bir uyga tegishli bo‘lsin.',
          'Boshqa e’londan olingan rasm ishlatilmasin — tekshiruv buni aniqlaydi.',
        ],
      },
      {
        heading: 'Sarlavha aniq bo‘lsin',
        paragraphs: [
          'Sarlavha e’lonning birinchi jumlasi emas, uning manzili. "Ajoyib kvartira, '
            + 'shoshiling" degan sarlavha hech qanday ma’lumot bermaydi. Uning o‘rniga eng '
            + 'muhim uch narsani joylashtiring: xonalar soni, mo‘ljal va uyning asosiy '
            + 'ustunligi. Masalan, xonalar soni, tuman yoki metro bekati va "jihozlangan" '
            + 'yoki "yangi ta’mir" kabi bitta aniq belgi.',
          'Bosh harflar bilan yozish, undov belgilari va "SHOSHILINCH" so‘zi hech qachon '
            + 'yordam bermaydi — aksincha, bu vositachi e’lonlarining uslubi va ijarachida '
            + 'shubha uyg‘otadi. Oddiy, tinch va aniq yozilgan sarlavha ko‘proq ochiladi.',
        ],
      },
      {
        heading: 'Tavsif: ijarachi nimani bilishni xohlaydi',
        paragraphs: [
          'Tavsifni ijarachining savollari tartibida yozing, o‘zingizga qulay tartibda emas. '
            + 'Birinchi ikki qatorda eng muhimini bering: uy qayerda, nechta xonali, '
            + 'jihozlanganmi, kimga mo‘ljallangan. Qolgan tafsilotlar keyin kelaveradi.',
          'Uzun, gullab-yashnagan matn kerak emas. O‘n-o‘n besh qatorlik aniq tavsif '
            + 'yuz qatorlik maqtovdan yaxshiroq ishlaydi. "Hammasi bor", "shinam", '
            + '"yevroremont" kabi umumiy so‘zlar hech narsa anglatmaydi — ularning o‘rniga '
            + 'aniq faktlarni yozing: qaysi texnika bor, isitish qanday, qavat nechanchi.',
        ],
        bullets: [
          'Mo‘ljal: metro bekati, bozor, maktab yoki yirik ko‘cha.',
          'Xonalar soni, maydoni, qavati va uyning qavatlar soni, lift bor-yo‘qligi.',
          'Jihoz va texnika ro‘yxati.',
          'Isitish turi, internet, avtoturargoh.',
          'Kimga topshiriladi: oila, talaba, sherikchilik — o‘zingiz aniq ayting.',
          'Qachondan bo‘shaydi va eng kam muddat qancha.',
        ],
      },
      {
        heading: 'Narx va uning tarkibi',
        paragraphs: [
          'Narxni yozmagan e’lon deyarli ochilmaydi. "Kelishilgan holda" degan ibora '
            + 'ijarachi uchun vaqtni tejash emas, aksincha — u shunchaki keyingi e’longa '
            + 'o‘tadi. Aniq raqam yozing, muzokara esa baribir bo‘ladi.',
          'Narx bilan birga uning tarkibini ham yozing: kommunal kiradimi, uy boshqaruvi '
            + 'to‘lovi kimning zimmasida, internet alohidami. Zakladka miqdorini ham '
            + 'e’londayoq ko‘rsating. Bu ma’lumotlar keraksiz qo‘ng‘iroqlarni kamaytiradi '
            + 'va sizga faqat shartlarga rozi odamlar qo‘ng‘iroq qiladi.',
        ],
      },
      {
        heading: 'Nimani oldindan aytish kerak',
        paragraphs: [
          'Kamchiliklarni yashirish qisqa muddatli foyda beradi, uzoq muddatda esa faqat '
            + 'zarar keltiradi. Agar uy birinchi qavatda bo‘lsa, lift bo‘lmasa, isitish '
            + 'faqat elektr bo‘lsa yoki qo‘shni ko‘chada qurilish ketayotgan bo‘lsa — '
            + 'buni yozing. Bunday ochiqlik ijarachida ishonch uyg‘otadi va ko‘rgani '
            + 'keladigan odamlar aynan shu shartlarga rozi bo‘lganlar bo‘ladi.',
          'Shartlarni ham oldindan ayting: uy hayvoniga ruxsatmi, nechta kishi yashashi '
            + 'mumkin, chekishga munosabat qanday. Bu masalalarni e’londa hal qilib '
            + 'qo‘yish uyni ko‘rgani kelgan odam bilan noqulay suhbatdan yaxshiroq.',
        ],
      },
      {
        heading: 'Tasdiqlash va tez javob',
        paragraphs: [
          'Telefon raqamini tasdiqlash, pasport va mulk hujjatini tekshirtirish e’longa '
            + 'ishonch belgisini beradi. Ijarachi uchun bu muhim, chunki u firibgarlikdan '
            + 'ehtiyot bo‘ladi va tasdiqlangan e’lonni birinchi bo‘lib ochadi. Tekshiruv '
            + 'bepul va bir marta bajariladi.',
          'Oxirgi, lekin muhim narsa — javob tezligi. Uy izlayotgan odam bir kunda bir '
            + 'nechta uyga qo‘ng‘iroq qiladi va birinchi javob berganini ko‘rgani boradi. '
            + 'Javobsiz qo‘ng‘iroqqa qayta aloqaga chiqish odati, hatto bir necha soatdan '
            + 'keyin bo‘lsa ham, e’lonning natijasini sezilarli o‘zgartiradi. Uy '
            + 'topshirilgach esa e’lonni darhol yopib qo‘ying — bu boshqalarning vaqtini '
            + 'tejaydi va sizning obro‘yingizni saqlaydi.',
        ],
      },
    ],
    faq: [
      {
        q: 'E’lon joylash pullikmi?',
        a:
          'Yo‘q. E’lon joylash ham, uni tahrirlash ham, tasdiqlashdan o‘tkazish ham uy '
          + 'egasi uchun bepul. Sizdan hech qanday komissiya olinmaydi.',
      },
      {
        q: 'Telefon raqamimni hamma ko‘radimi?',
        a:
          'Yo‘q. Raqam faqat tizimga kirgan foydalanuvchilarga, faqat e’lonning to‘liq '
          + 'sahifasida ko‘rinadi. Bu qidiruv robotlari raqamni yig‘ib olishining oldini '
          + 'oladi.',
      },
      {
        q: 'E’lonim nega ko‘rilmayapti?',
        a:
          'Ko‘pincha sabab uchtadan biri: rasm kam yoki sifatsiz, narx ko‘rsatilmagan, '
          + 'yoki tavsif juda umumiy. Shu uchtasini tuzatish odatda e’lonni sezilarli '
          + 'jonlantiradi.',
      },
    ],
  },

  {
    slug: 'zakladka-va-depozit',
    title: 'Zakladka: qachon to‘liq qaytariladi',
    summary:
      'Zakladka nima uchun olinadi, uy egasi nimani qonuniy ushlab qolishi mumkin va ko‘chib '
      + 'kirgan kundagi suratlar chiqish kunida qanday dalilga aylanadi.',
    publishedAt: '2026-03-05',
    updatedAt: '2026-08-11',
    readingMinutes: 8,
    h1: 'Zakladka: qanday qo‘yiladi, nima uchun ushlab qolinadi va qanday qaytariladi',
    intro:
      'Ijarada eng ko‘p bahs chiqadigan pul — bu zakladka. U ijara haqi ham emas, vositachilik '
      + 'haqi ham emas, lekin ko‘chib o‘tadigan oyda cho‘ntakdan aynan u og‘ir chiqadi va '
      + 'ko‘chib chiqadigan kuni aynan u janjalga aylanadi. Sababi deyarli har doim bitta: '
      + 'zakladka og‘zaki kelishib qo‘yiladi. "Uyga zarar yetkazmasangiz qaytaraman" deyiladi, '
      + 'ikkala tomon bosh irg‘aydi — va bir yildan keyin ma’lum bo‘ladiki, "zarar" so‘zini '
      + 'ular butunlay boshqacha tushunar ekan. Uy egasi uchun bu devordagi dog‘ va eshikdagi '
      + 'chizilgan iz, ijarachi uchun esa bu faqat singan narsa. Quyida zakladka nima uchun '
      + 'olinishi, uni shartnomada qanday yozish, ko‘chib kirgan kuni nima qilib qo‘yish va '
      + 'pul qaytarilmasa qanday yo‘l tutish mumkinligi ko‘rib chiqilgan. Bu umumiy amaliy '
      + 'maslahat, yuridik xulosa emas: chalkash yoki katta summali holatlarda yuristga '
      + 'murojaat qilgan ma’qul.',
    sections: [
      {
        heading: 'Zakladka nima va nima emas',
        paragraphs: [
          'Zakladka — uy egasining garovi. U kelajakda yuzaga kelishi mumkin bo‘lgan zarar, '
            + 'to‘lanmay qolgan kommunal hisob yoki muddatidan oldin tashlab ketilgan uy uchun '
            + 'oldindan qo‘yilgan xavfsizlik puli. Eng muhim jihati shundaki, bu pul uy '
            + 'egasining daromadi emas. Agar uyga zarar yetmasa va qarz qolmasa, u to‘liq '
            + 'qaytarilishi kerak — bu iltifot emas, kelishuvning oddiy sharti.',
          'Birinchi tushunmovchilik shu yerdan boshlanadi. Ko‘p ijarachi zakladkani "oxirgi '
            + 'oyning ijarasi" deb hisoblaydi va chiqishdan bir oy oldin to‘lovni to‘xtatadi. '
            + 'Uy egasi esa uni tegilmaydigan garov deb biladi va oxirgi oy uchun alohida pul '
            + 'kutadi. Ikkalasi ham o‘zicha haq, chunki bu masala hech qachon yozib '
            + 'qo‘yilmagan. Shartnomadagi bitta jumla — zakladka oxirgi oy ijarasi o‘rniga '
            + 'o‘tadimi yoki alohida qaytariladimi — bu bahsni butunlay yopadi.',
          'Ikkinchi tushunmovchilik zakladkani vositachilik haqi bilan chalkashtirishdan '
            + 'kelib chiqadi. Makler oladigan pul xizmat haqi va u qaytarilmaydi; zakladka '
            + 'esa qaytariladigan pul va u faqat uyning egasiga topshiriladi. Agar sizdan '
            + '"zakladka" deb pul so‘rayotgan odam uyning egasi bo‘lmasa yoki uning yozma '
            + 'vakolati bo‘lmasa, bu allaqachon butunlay boshqa suhbat.',
        ],
        bullets: [
          'Zakladka — qaytariladigan garov, ijara haqining bir qismi emas.',
          'U faqat uy egasiga yoki uning ishonchnomasi bor vakiliga beriladi.',
          'Miqdori va qaytarish sharti shartnomada yozilgan bo‘lishi kerak.',
          'Pul topshirilganda tilxat yoki shartnomadagi imzolangan yozuv olinadi.',
        ],
      },
      {
        heading: 'Shartnomadagi zakladka bandi qanday yozilishi kerak',
        paragraphs: [
          'Zakladka bandi uzun bo‘lishi shart emas — to‘rt-besh jumla yetadi, faqat har biri '
            + 'aniq bo‘lsin. "Zarar yetkazilsa ushlab qolinadi" degan umumiy ibora amalda hech '
            + 'narsani anglatmaydi, chunki zararning chegarasi ko‘rsatilmagan. Uning o‘rniga '
            + 'nimalar ushlab qolinishi mumkinligini sanab o‘tish va tabiiy eskirish zarar '
            + 'hisoblanmasligini alohida yozib qo‘yish kerak.',
          'Ikkinchi muhim narsa — muddat. "Chiqqandan keyin qaytariladi" degan jumla amalda '
            + 'oylab cho‘zilishi mumkin va uni hech kim buzgan bo‘lib chiqmaydi. Uyni '
            + 'topshirgan kundan boshlab necha kun ichida va qaysi usulda qaytarilishi aniq '
            + 'son bilan yozilsin. Agar to‘lov o‘tkazma orqali bo‘lsa, karta yoki hisob '
            + 'raqami ham shartnomaga kirsin.',
          'Agar tayyor shartnomada bu bandlardan biri yo‘q bo‘lsa, uni qo‘lda yozib qo‘shish '
            + 'va yon tomoniga ikkala tomon imzo qo‘yishi mumkin. Shartnomaning qolgan '
            + 'bandlari alohida qo‘llanmada batafsil ko‘rilgan.',
        ],
        bullets: [
          'Zakladka miqdori — raqam va yozuv bilan.',
          'U oxirgi oy ijarasi o‘rniga o‘tadimi yoki alohida qaytariladimi.',
          'Qaysi holatlarda ushlab qolinishi mumkin — ro‘yxat ko‘rinishida.',
          'Tabiiy eskirish zarar hisoblanmasligi haqidagi alohida jumla.',
          'Uy topshirilgandan keyin necha kun ichida va qanday usulda qaytariladi.',
          'Ushlab qolingan har bir summa yozma asoslanishi sharti.',
        ],
      },
      {
        heading: 'Ko‘chib kirgan kun butun bahsni oldindan hal qiladi',
        paragraphs: [
          'Chiqish kunidagi bahsning natijasi kirish kunida hal bo‘ladi. Kalitni olgan kuni '
            + 'uyning har bir xonasini telefoningizga suratga oling — chiroyli qilib emas, '
            + 'to‘liq qilib: devorlar, shift burchaklari, pol, eshik yonidagi izlar, '
            + 'hammomdagi choklar, oshxona shkaflarining ichi, deraza ramkalari. Telefon '
            + 'suratlarida sana avtomatik saqlanadi va aynan shu sana keyinchalik dalil '
            + 'bo‘ladi. Ustiga qisqa video ham oling: bir marta xonama-xona yurib chiqish '
            + 'yetarli.',
          'Suratlar bilan birga inventarizatsiya ro‘yxati tuzing. Mebel va texnikani '
            + 'nomma-nom yozing va har birining yonida holatini bir-ikki so‘z bilan '
            + 'ko‘rsating: muzlatgich ishlaydi, eshigining rezinasi eskirgan; kondisioner '
            + 'ishlaydi, pulti yo‘q; oshxona stolining qirrasi ko‘chgan. Ro‘yxatni ikki '
            + 'nusxada chop eting, ikkala tomon imzolasin va u shartnomaga ilova bo‘lsin.',
          'Uchinchi ish — hisoblagichlar. Suv, gaz va elektr ko‘rsatkichlarini yozib oling '
            + 'va raqamlar aniq ko‘rinadigan qilib suratga tushiring: oldingi ijarachining '
            + 'qarzi ko‘pincha aynan zakladkadan ushlab qolinadi.',
        ],
        bullets: [
          'Har bir xona, hammom va oshxonaning sanali surati.',
          'Bir martalik yurib chiqish videosi — bir-ikki daqiqa yetadi.',
          'Imzolangan inventarizatsiya ro‘yxati, texnikaning holati ko‘rsatilgan holda.',
          'Uch hisoblagich ko‘rsatkichi — yozma va surat bilan.',
          'Mavjud nuqson va shikastlarning alohida surati, hech biri yashirilmasin.',
        ],
      },
      {
        heading: 'Uy egasi nimani ushlab qolishi mumkin',
        paragraphs: [
          'Zakladkadan ushlab qolish uchun asos bo‘lishi mumkin bo‘lgan narsalar aslida '
            + 'unchalik ko‘p emas. Bular — haqiqiy shikast, ya’ni foydalanish natijasidagi '
            + 'oddiy eskirish emas, balki buzilish; to‘lanmagan ijara yoki kommunal qarz; '
            + 'shartnomada ko‘rsatilgan tartibni buzib chiqib ketish; va uyning topshirish '
            + 'holatiga keltirilmagani, masalan tozalanmagani yoki ortiqcha buyumlar tashlab '
            + 'ketilgani.',
          'Tabiiy eskirish esa zarar emas. Devor bo‘yog‘ining vaqt o‘tishi bilan '
            + 'xiralashuvi, linoleumning yurilgan joyi yupqalashgani, kran prokladkasining '
            + 'ishdan chiqishi, kuygan lampochka, eshik qulfining tabiiy bo‘shashishi — '
            + 'bularning hech biri ijarachining aybi emas. Bu chegara ko‘pincha muhokamaga '
            + 'sabab bo‘ladi, shuning uchun uni shartnomaga yozib qo‘yish shunchalik muhim.',
          'Ushlab qolinadigan summa ham asoslangan bo‘lishi kerak. "Ta’mirga ketadi" degan '
            + 'taxminiy raqam emas, aniq narsa: qaysi buyum, uni tuzatish yoki almashtirish '
            + 'qancha turgani va buni tasdiqlovchi chek yoki hech bo‘lmasa ustaning yozma '
            + 'bahosi. Bunday hisobni so‘rash to‘liq o‘rinli va odobsizlik emas.',
        ],
        bullets: [
          'Zarar deb hisoblanadi: singan oyna, teshilgan eshik, kuydirilgan sirt, yo‘qolgan texnika.',
          'Zarar hisoblanmaydi: bo‘yoq xiralashuvi, yupqalashgan qoplama, eskirgan prokladka.',
          'Qarzlar: to‘lanmagan ijara, yopilmagan kommunal hisob, uy boshqaruvi to‘lovi.',
          'Har bir ushlab qolingan summa uchun yozma asos va imkon bo‘lsa chek.',
        ],
      },
      {
        heading: 'Chiqish kuni: uyni qanday topshirish kerak',
        paragraphs: [
          'Uyni topshirishga bir kun oldindan tayyorlaning. Uyni tozalang, kichik narsalarni '
            + 'o‘zingiz tuzatib qo‘ying — kuygan lampochkani almashtirish yoki qoqib qo‘yilgan '
            + 'mixni olib tashlash sizga bir soat, uy egasining hisobida esa ancha ko‘p pul '
            + 'turadi. Ortiqcha buyumlarni tashlab ketmang: uy egasi uchun ular chiqindi va '
            + 'uni chiqarish ham xarajat.',
          'Topshirish uy egasi ishtirokida bo‘lsin. Ikkalangiz inventarizatsiya ro‘yxatini '
            + 'qo‘lga olib xonama-xona yuring va har bandni birga tekshiring. Oxirgi '
            + 'hisoblagich ko‘rsatkichlarini yozing va suratga oling, to‘langan kommunal '
            + 'kvitansiyalarini ko‘rsating. Kalitni topshirgan daqiqada uy egasidan qisqa '
            + 'tilxat oling: uy shu sanada, shu holatda qabul qilindi va da’vo yo‘q.',
          'Agar zakladka o‘sha kuniyoq qaytarilsa, pul olinganini ham yozma tasdiqlang; '
            + 'keyinroq o‘tkaziladigan bo‘lsa, tilxatda qaysi sanagacha va qancha summa '
            + 'qaytarilishi ko‘rsatilsin.',
        ],
      },
      {
        heading: 'Zakladka qaytarilmasa nima qilish kerak',
        paragraphs: [
          'Birinchi qadam — janjal emas, yozma murojaat. Uy egasiga xabar yozing: qaysi '
            + 'sanada uyni topshirganingiz, shartnomaning qaysi bandi bo‘yicha qancha summa '
            + 'qaytarilishi kerakligi va uni qaysi sanagacha kutayotganingiz. Xabar yozma '
            + 'bo‘lgani muhim, chunki telefon suhbati keyin dalil bo‘lolmaydi. Ko‘p holatda '
            + 'masala shu bosqichda hal bo‘ladi.',
          'Agar javob bo‘lmasa yoki asossiz ushlab qolish davom etsa, barcha hujjatni bir '
            + 'joyga yig‘ing: shartnoma, inventarizatsiya ro‘yxati, kirish va chiqish '
            + 'suratlari, hisoblagich ko‘rsatkichlari, to‘lov cheklari va yozishmalar. Shundan '
            + 'keyin rasmiy yozma da’vo yuborish va kerak bo‘lsa sudga murojaat qilish yo‘li '
            + 'ochiladi. Aynan shu paytda ko‘chib kirgan kunidagi sanali suratlar butun '
            + 'ishning og‘irligini belgilaydi.',
          'Yana bir bor takrorlash o‘rinli: bu maqola umumiy amaliy yo‘riqnoma, huquqiy '
            + 'maslahat emas. Summa katta bo‘lsa yoki tomonlar kelisha olmasa, ish '
            + 'boshlanishidan oldin yuristga murojaat qiling — bir marta olingan maslahat '
            + 'ko‘pincha oylab davom etadigan yozishmadan arzonroq tushadi.',
        ],
      },
    ],
    faq: [
      {
        q: 'Zakladka odatda qancha bo‘ladi?',
        a:
          'Bu kelishuv masalasi va uy, muddat hamda shartlarga qarab o‘zgaradi — biz aniq '
          + 'raqam aytmaymiz. Muhimi, miqdor shartnomada yozilgan va uni qaytarish sharti '
          + 'aniq ko‘rsatilgan bo‘lsin.',
      },
      {
        q: 'Zakladka hisobidan oxirgi oyni yashasa bo‘ladimi?',
        a:
          'Faqat shartnomada shunday yozilgan bo‘lsa. Aks holda uy egasi buni to‘lanmagan '
          + 'ijara deb hisoblaydi va bu eng ko‘p uchraydigan nizolardan biri. Bu bandni '
          + 'imzolashdan oldin aniqlashtiring.',
      },
      {
        q: 'Uy egasi devordagi eski dog‘ uchun pul ushlab qolsa-chi?',
        a:
          'Ko‘chib kirgan kundagi sanali suratlar bu savolga bir daqiqada javob beradi. '
          + 'Agar dog‘ siz kirgan kuni ham bo‘lgan bo‘lsa, u tabiiy eskirish yoki oldingi '
          + 'holat hisoblanadi va ushlab qolishga asos bo‘lmaydi.',
      },
    ],
  },

  {
    slug: 'kvartirani-korish-checklist',
    title: 'Kvartirani ko‘rish: yarim soatlik ro‘yxat',
    summary:
      'Uyga kirgan yarim soat ichida nimani tekshirish kerak: suv bosimi, elektr shchiti, '
      + 'isitish, namlik, uyali aloqa va qaysi hujjatni so‘rash kerakligi.',
    publishedAt: '2026-04-22',
    updatedAt: '2026-07-29',
    readingMinutes: 7,
    h1: 'Kvartirani ko‘rish: uyda o‘tkaziladigan yarim soatning ro‘yxati',
    intro:
      'Uy ko‘rish odatda juda tez o‘tadi. Uy egasi eshikni ochadi, "mana zal, mana oshxona" '
      + 'deydi, siz bosh irg‘aysiz, o‘n daqiqada chiqasiz va mashinada o‘tirib "yaxshi ekan" '
      + 'deysiz. Uch oydan keyin esa qishda uy sovuqligi, kechqurun suv bosimi tushib '
      + 'ketishi va hammomdagi nam dog‘ har hafta kattalashib borishi ma’lum bo‘ladi. '
      + 'Aslida bu narsalarning deyarli hammasini o‘sha yarim soat ichida bilib olish '
      + 'mumkin edi — faqat nimaga qarash kerakligini bilish va bir necha kranni o‘zingiz '
      + 'ochib ko‘rish kerak edi. Quyidagi ro‘yxat aynan shu uchun tuzilgan: uni telefonga '
      + 'ko‘chirib oling va uyni ko‘rgani borganda ochib qo‘ying. Savol berish uyalchoqlik '
      + 'emas — normal uy egasi buni har kuni ko‘radi va bunga xotirjam qaraydi.',
    sections: [
      {
        heading: 'Borishdan oldin: uch daqiqalik tayyorgarlik',
        paragraphs: [
          'Uyni ko‘rgani ketayotganda uch narsani oling: zaryadi to‘la telefon, telefon '
            + 'zaryadlagichi va kichkina fonar. Zaryadlagich rozetkalarni tekshirish uchun — '
            + 'har bir xonada bittasini sanchib ko‘rasiz va zaryad borayotganini ko‘rasiz. '
            + 'Fonar esa shkaf ortiga, mo‘rilarga va sanuzeldagi quvurlar tagiga qarash '
            + 'uchun kerak bo‘ladi; namlik ko‘pincha aynan o‘sha ko‘rinmaydigan joylarda '
            + 'boshlanadi.',
          'Vaqtni ham tanlang. Imkon bo‘lsa kunduzi boring — sun’iy yorug‘lik devor va shift '
            + 'holatini yashiradi. Agar uy jiddiy ko‘rilayotgan bo‘lsa, ikkinchi marta '
            + 'kechqurun borish arziydi: podyezd yoritilganmi, hovlida qanday hayot bor, '
            + 'qo‘shnilardan shovqin keladimi — bularning javobi faqat kechqurun ko‘rinadi.',
        ],
        bullets: [
          'Zaryadlagich — rozetkalarni tekshirish uchun.',
          'Fonar — quvur tagi, shkaf orti va shift burchaklari uchun.',
          'Telefonda shu ro‘yxat va yozib olish uchun bo‘sh eslatma.',
          'Imkoni bo‘lsa yolg‘iz emas, bir kishi bilan boring.',
        ],
      },
      {
        heading: 'Suv, kanalizatsiya va sanuzel',
        paragraphs: [
          'Suv — birinchi tekshiriladigan narsa, chunki uni tuzatish eng qimmat va eng '
            + 'noqulay. Hammomga kiring va kranni to‘liq oching: bosim qanday, oqim tekismi, '
            + 'issiq suv necha soniyada keladi. Keyin oshxonadagi kranni ham bir vaqtda '
            + 'oching — ikkalasi birga ishlaganda bosim qanchalik tushishi yuqori qavatlarda '
            + 'ayniqsa muhim. Suv rangiga ham qarang: birinchi soniyalarda sarg‘ish oqim '
            + 'kelsa, quvurlar eski degani.',
          'Kanalizatsiyani tekshirish oson: rakovinani suvga to‘ldiring va bo‘shating. Suv '
            + 'sekin ketsa yoki g‘uldirab qaytsa, bu doimiy muammoning belgisi. Unitazni '
            + 'yuvib ko‘ring, bachokning to‘lishini kuting va oqmayotganini ko‘ring. '
            + 'Quvurlar tagiga fonar bilan qarang: quruq dog‘, oq tuz izi yoki zang '
            + 'sekin oqish borligini aytadi.',
          'Isitgich va suv isitgich alohida savol. Uyda kolonka bo‘lsa, uni yoqib ko‘ring '
            + 'va oxirgi marta qachon xizmat ko‘rsatilganini so‘rang. Gaz asbobi bilan '
            + 'bog‘liq har qanday narsada ehtiyot bo‘ling: shubhali hid yoki eski, '
            + 'ta’mirlanmagan qurilma bo‘lsa, bu shunchaki noqulaylik emas.',
        ],
        bullets: [
          'Hammom va oshxona kranini birga ochib bosimni ko‘ring.',
          'Issiq suv necha soniyada keladi va u barqarormi.',
          'Rakovinani to‘ldirib bo‘shating — suv qanchalik tez ketadi.',
          'Bachok oqmayaptimi, quvurlar tagida nam yoki zang izi bormi.',
          'Kolonka bo‘lsa — ishlaydimi va oxirgi tekshiruv qachon bo‘lgan.',
        ],
      },
      {
        heading: 'Elektr: shchit, rozetkalar va quvvat',
        paragraphs: [
          'Elektr shchitini ko‘rishni so‘rang. Bu g‘alati iltimos emas: shchitga bir qarash '
            + 'uyning holati haqida ko‘p narsa aytadi. Yangi avtomatlar, tartibli simlar va '
            + 'belgilangan liniyalar — yaxshi belgi. Chalkash simlar, eski probkalar va '
            + 'izolentali ulanishlar esa keyinchalik sizning muammoyingizga aylanadi.',
          'Rozetkalarni zaryadlagich bilan tekshiring — har bir xonada kamida bittasini. '
            + 'Ayni paytda ularning soniga ham qarang: eski uylarda bitta xonada bitta '
            + 'rozetka bo‘lishi odatiy hol va bu kundalik hayotda uzatgichlar o‘rmoniga '
            + 'aylanadi. Yorug‘lik o‘chirgichlarini ham bosib chiqing, chiroqlar borligini '
            + 'va ishlashini ko‘ring.',
          'Eng muhim savol — quvvat. Eski uylarda kondisioner, kir yuvish mashinasi va '
            + 'elektr isitgich bir vaqtda ishlaganda avtomat tushib qolishi keng tarqalgan. '
            + 'Uy egasidan to‘g‘ridan-to‘g‘ri so‘rang: shu uch qurilmani birga yoqsa bo‘ladimi '
            + 'va oxirgi marta simlar qachon yangilangan. Javobning ohangi ko‘pincha '
            + 'javobning o‘zidan ko‘proq narsani aytadi.',
        ],
      },
      {
        heading: 'Isitish, derazalar va namlik',
        paragraphs: [
          'Isitish O‘zbekistonda alohida turadigan masala, chunki u qishki kommunal hisobni '
            + 'butunlay o‘zgartiradi. Uy markaziy isitishdami, kolonka orqali isitiladimi '
            + 'yoki elektr isitgichlarga tayanadimi — buni yozda ko‘rayotgan bo‘lsangiz ham '
            + 'aniqlang. Va darhol ikkinchi savolni bering: o‘tgan qishda bu uy uchun '
            + 'kommunal qanday chiqqan. Aniq raqam so‘rash noqulay tuyulmasin, bu sizning '
            + 'kelgusi xarajatingiz.',
          'Derazalarni ochib-yopib ko‘ring. Ular qiyshaymay yopiladimi, rezinalari butunmi, '
            + 'ramkalar orasidan shamol o‘tadimi. Yog‘ochli eski derazalar issiqlikni yomon '
            + 'ushlaydi va bu qishda darhol seziladi. Deraza yonidagi devor va deraza tagi '
            + 'ham diqqat bilan ko‘rilsin: qora nuqtali dog‘lar, ko‘pikli bo‘yoq yoki '
            + 'ko‘chgan oboy namlikning belgisi.',
          'Namlikni hidlab ham bilish mumkin. Uyga kirgan birinchi soniyada zax hidini '
            + 'sezsangiz, buni e’tiborsiz qoldirmang — ayniqsa birinchi qavatda va oxirgi '
            + 'qavatda. Yangi bo‘yalgan bir bo‘lak shift yoki bitta xonada yangilangan '
            + 'oboy ko‘pincha yopib qo‘yilgan oqish izi bo‘ladi. So‘rashdan tortinmang: '
            + 'bu yerda oqib ketganmi, qachon tuzatilgan.',
        ],
        bullets: [
          'Isitish turi va o‘tgan qishdagi kommunal hisob.',
          'Derazalar zich yopiladimi, rezinalari butunmi.',
          'Shift burchaklari, deraza tagi va hammom devorida nam dog‘lar.',
          'Yangi bo‘yalgan yakka bo‘laklar — nima yopilgani so‘ralsin.',
          'Uyning zax hidi — birinchi soniyalarda eng yaxshi sezilgan.',
        ],
      },
      {
        heading: 'Aloqa, podyezd va qo‘shnilar',
        paragraphs: [
          'Uyali aloqa signalini o‘sha yerda, o‘z telefoningizda tekshiring — xonalarning '
            + 'har birida, ayniqsa yotoqxonada va hammomda. Qalin devorli uylarda va yerto‘la '
            + 'darajasidagi kvartiralarda signal kutilmaganda yo‘qolishi mumkin. Internet '
            + 'masalasini ham shu yerda hal qiling: uyga qaysi provayder tortilgan, kabel '
            + 'kirganmi yoki uni o‘zingiz olib kirasizmi, tezlik qanday.',
          'Podyezdga chiqib bir daqiqa turing. Zinapoya toza saqlanganmi, chiroq yonadimi, '
            + 'kirish eshigi qulflanadimi, lift ishlaydimi va u qanday holatda. Hovliga '
            + 'chiqing: mashina qo‘yish joyi bormi, chiqindi konteynerlari qayerda, bolalar '
            + 'maydonchasi qanday. Bu narsalar e’londa hech qachon yozilmaydi, lekin siz '
            + 'ular bilan har kuni yashaysiz.',
          'Imkoni bo‘lsa qo‘shnilardan biriga bir og‘iz so‘z tashlang. Podyezddagi '
            + 'odamdan "bu uyda suv yaxshi keladimi, qishda sovuq bo‘lmaydimi" deb so‘rash '
            + 'butunlay normal va ko‘pincha eng halol javobni beradi. Ayni paytda bu uyni '
            + 'ko‘rsatayotgan odam haqiqatan shu yerdanmi yoki yo‘qmi — buni ham bilib '
            + 'qo‘yasiz.',
        ],
      },
      {
        heading: 'Hujjatlar va uy egasiga beriladigan savollar',
        paragraphs: [
          'Uy yoqqan bo‘lsa, ketishdan oldin hujjat masalasini oching. Mulk hujjatini va '
            + 'uy egasining pasportini ko‘rishni so‘rang, ikkalasidagi ism bir xilligiga '
            + 'ishonch hosil qiling. Agar uyni egasining qarindoshi yoki tanishi '
            + 'topshirayotgan bo‘lsa, uning ishonchnomasi bo‘lishi kerak. Bu tekshiruv bir '
            + 'daqiqa oladi va firibgarlik sxemalarining aksariyatini shu yerdayoq '
            + 'to‘xtatadi.',
          'Shu yerda pul haqidagi savollarni ham bering: narxga nimalar kiradi, kommunal '
            + 'kimning zimmasida, zakladka qancha va qaysi holatda to‘liq qaytariladi, '
            + 'shartnoma necha oyga tuziladi va shu muddatda narx o‘zgaradimi. Javoblarni '
            + 'telefondagi eslatmaga yozib qo‘ying — bir kunda uch uy ko‘rsangiz, kechqurun '
            + 'ularning shartlari xotirada aralashib ketadi.',
          'Va oxirgi qoida, u hech qachon buzilmaydi: uyni ko‘rgan kuniyoq, hujjatni '
            + 'ko‘rmasdan va shartnoma imzolanmasdan hech kimga pul bermang. "Band qilib '
            + 'turaman" degan taklif qanchalik ishonarli eshitilmasin, javob bir xil bo‘ladi.',
        ],
        bullets: [
          'Mulk hujjati va pasport — ismlar bir xilmi.',
          'Egasi o‘zi kelmasa — ishonchnoma bormi.',
          'Narxga nimalar kiradi va kommunal kimning zimmasida.',
          'Zakladka miqdori va qaytarish sharti.',
          'Muddat, narxning barqarorligi va uydan chiqish tartibi.',
          'Uy qachondan bo‘shaydi va kalit qachon topshiriladi.',
        ],
      },
    ],
    faq: [
      {
        q: 'Uyni necha marta ko‘rish kerak?',
        a:
          'Jiddiy variant bo‘lsa ikki marta: bir marta kunduzi, bir marta kechqurun. '
          + 'Kunduzi yorug‘lik, namlik va uyning holati ko‘rinadi; kechqurun podyezd, '
          + 'shovqin va hovlidagi vaziyat ma’lum bo‘ladi.',
      },
      {
        q: 'Kranlarni o‘zim ochib ko‘rishim odobsizlik emasmi?',
        a:
          'Yo‘q, bu butunlay odatiy amaliyot va uy egalari bunga o‘rgangan. Aksincha, '
          + 'tekshirishga qarshilik ko‘rsatilishi o‘zi ogohlantiruvchi belgi bo‘ladi.',
      },
      {
        q: 'Uy yoqdi, lekin o‘ylab ko‘rmoqchiman — band qilib turishim mumkinmi?',
        a:
          'Faqat shartnoma imzolash orqali. Uyni ko‘rgan kuni "band qilish" uchun oldindan '
          + 'pul o‘tkazish eng keng tarqalgan firibgarlik so‘rovi, shuning uchun bunday '
          + 'taklifga rozi bo‘lmang.',
      },
    ],
  },

  {
    slug: 'sherik-bilan-yashash',
    title: 'Sherik bilan yashash: oldindan nimani kelishish kerak',
    summary:
      'Ijara va kommunal qanday bo‘linadi, mehmon va tozalik qoidalari, shartnomada kimning '
      + 'ismi turadi va sherik yarim yo‘lda chiqib ketsa nima bo‘ladi.',
    publishedAt: '2026-06-03',
    updatedAt: '2026-08-14',
    readingMinutes: 6,
    h1: 'Sherik bilan yashash: ko‘chib o‘tishdan oldin kelishib olinadigan narsalar',
    intro:
      'Sheriklikka ko‘chib o‘tish odatda juda oson boshlanadi. Ikki tanish odam narxni '
      + 'ikkiga bo‘ladi, "biz til topishamiz-ku" deydi, kalitni oladi va bir hafta davomida '
      + 'hammasi ajoyib ketadi. Muammolar ikkinchi oyda boshlanadi va ular deyarli hech '
      + 'qachon katta narsalar emas: kim idishni yuvmagani, kim mehmonini uch kunga olib '
      + 'kelgani, kommunal hisob nega bu safar teng bo‘linmagani. Bularning har biri '
      + 'alohida arzimas, lekin ular yig‘ilganda odamlar birga yashay olmay qoladi. Sabab '
      + 'esa bitta: hech kim boshida o‘tirib gaplashmagan. Quyida ko‘chib o‘tishdan oldin '
      + 'bir soat vaqt ajratib hal qilib qo‘yish kerak bo‘lgan masalalar ro‘yxati. Bu '
      + 'suhbat noqulay tuyulishi mumkin, lekin u uch oydan keyingi janjaldan ancha oson '
      + 'kechadi.',
    sections: [
      {
        heading: 'Sherikni tanlash: tanishlik yetarli emas',
        paragraphs: [
          'Do‘st bo‘lish va birga yashash — ikki xil narsa. Kafedagi suhbatda ajoyib '
            + 'ko‘ringan odam kechasi ikkida musiqa qo‘yadigan, kir idishni ertaga qoldiradigan '
            + 'yoki har hafta oltita mehmon chaqiradigan odam bo‘lib chiqishi mumkin. Buning '
            + 'aksi ham to‘g‘ri: siz ham kimningdir uchun shunday odamsiz. Shuning uchun '
            + 'tanlovni odamning yaxshiligiga emas, kundalik odatlarning bir-biriga '
            + 'mosligiga qurish kerak.',
          'Eng oddiy tekshiruv — ko‘chishdan oldin bir marta xotirjam o‘tirib gaplashish. '
            + 'Uch narsa aniq bo‘lsin: kim qachon uxlaydi va turadi, mehmon qanchalik '
            + 'tez-tez keladi, pul masalasi qanday hal qilinadi. Talabalar uchun uy tanlash '
            + 'haqidagi qo‘llanmada aytilganidek, aynan shu uch masala sheriklikdagi '
            + 'nizolarning katta qismini tashkil qiladi.',
          'Notanish odam bilan sheriklikka kirayotgan bo‘lsangiz, birinchi uchrashuvni uyda '
            + 'emas, uydan tashqarida o‘tkazing va imkon bo‘lsa uni birga uy ko‘rishga '
            + 'taklif qiling. Odam uyni qanday ko‘zdan kechirishi, nimani so‘rashi va uy '
            + 'egasi bilan qanday gaplashishi — bu birga yashash haqida bir soatlik '
            + 'suhbatdan ko‘proq narsani aytadi.',
        ],
      },
      {
        heading: 'Pul: ijara va kommunal qanday bo‘linadi',
        paragraphs: [
          'Ijarani bo‘lishning eng ko‘p uchraydigan usuli — teng bo‘lish. Bu xonalar bir '
            + 'xil bo‘lganda adolatli, lekin ko‘p kvartirada xonalar teng emas. Balkonli '
            + 'katta xona bilan derazasi hovliga qaragan kichkina xona bir xil turishi '
            + 'g‘alati bo‘ladi, va aynan shu tenglik ikkinchi oyda xafagarchilikka '
            + 'aylanadi. Farqni boshidayoq ochiq muhokama qiling: katta xonaga bir oz '
            + 'ko‘proq to‘lash butunlay odatiy amaliyot.',
          'Kommunal esa boshqacha ishlaydi va uni teng bo‘lish odatda to‘g‘ri bo‘ladi, '
            + 'chunki suv, gaz va elektrni ikkalangiz ham foydalanasiz. Faqat bitta shartni '
            + 'kelishing: kim to‘playdi va kim to‘laydi. Eng yaxshi tartib — har oyda bitta '
            + 'odam barcha hisoblarni to‘lasin va cheklarni umumiy chatga tashlasin, '
            + 'ikkinchisi esa o‘z qismini o‘sha kuniyoq o‘tkazsin. Bu "keyin hisoblashamiz" '
            + 'degan tumanli holatdan ancha sog‘lom.',
          'To‘lov sanasini ham qat’iy belgilang, va u ijara topshiriladigan sanadan bir-ikki '
            + 'kun oldin bo‘lsin. Sherigingiz maoshni ijaradan keyin oladigan bo‘lsa, buni '
            + 'oldindan biling: bu hal qilib bo‘lmaydigan muammo emas, lekin har oyda '
            + 'kutilmagan bo‘lib chiqsa, muammoga aylanadi.',
        ],
        bullets: [
          'Ijara qanday bo‘linadi: teng yoki xonaning kattaligiga qarab.',
          'Kim to‘playdi, kim to‘laydi va cheklar qayerda saqlanadi.',
          'Har oyning qaysi sanasida pul topshiriladi.',
          'Zakladkani kim qo‘ygan va chiqishda u kimga qaytadi.',
          'Umumiy xaridlar — tozalash vositalari, chiroq, internet — kim oladi.',
          'Bir kishi kechiksa nima bo‘ladi: shu haqda ham oldindan gaplashing.',
        ],
      },
      {
        heading: 'Shartnomada kimning ismi turadi',
        paragraphs: [
          'Bu eng ko‘p e’tibordan chetda qoladigan masala. Ko‘pincha shartnomani bitta '
            + 'odam imzolaydi, ikkinchisi esa shunchaki u bilan yashaydi. Bunda barcha '
            + 'javobgarlik — to‘lov, zarar, muddat — imzolagan odamning zimmasida bo‘ladi, '
            + 'ikkinchisining esa hech qanday huquqi yo‘q: uy egasi istagan payt "bu odam '
            + 'shartnomada yo‘q" deya olishi mumkin.',
          'To‘g‘ri yo‘l — ikkala sherikning ismi shartnomada bo‘lishi. Shunda ikkalangiz '
            + 'ham teng huquqli ijarachi bo‘lasiz va uy egasi bilan har biringiz alohida '
            + 'gaplasha olasiz. Uyda kim yashashi shartnomada ko‘rsatilishi kerakligini uy '
            + 'egalari ham yaxshi biladi va bu odatda hech qanday qarshilikka uchramaydi.',
          'Agar biror sababga ko‘ra shartnomani faqat bitta odam imzolayotgan bo‘lsa, hech '
            + 'bo‘lmasa uy egasidan ikkinchi odamning shu uyda yashashi haqidagi yozma '
            + 'roziligini oling, va o‘zaro pul kelishuvini alohida yozib qo‘ying. Bu '
            + 'kelishuv uy egasiga taalluqli emas, lekin sizlarning oralaringizda aniq '
            + 'bo‘ladi.',
        ],
      },
      {
        heading: 'Kundalik hayot: mehmon, tozalik va tinchlik',
        paragraphs: [
          'Nizolarning aksariyati katta masalalardan emas, mayda odatlardan chiqadi. '
            + 'Shuning uchun bir necha oddiy qoidani boshida kelishib olish arziydi. Mehmon '
            + 'masalasi birinchi o‘rinda: bir kechaga qolish normalmi, necha kishi '
            + 'chaqirish mumkin, viloyatdan kelgan qarindosh bir hafta turishi mumkinmi. '
            + 'Bu savollarga oldindan javob bo‘lmasa, birinchi holatning o‘zi keskin '
            + 'suhbatga aylanadi.',
          'Tozalik uchun navbat tuzing — og‘zaki emas, yozib. Umumiy joylar, ya’ni oshxona, '
            + 'hammom va yo‘lak, haftada kim tomonidan tozalanishi aniq bo‘lsin. Idish '
            + 'yuvish qoidasi ham shunga o‘xshash: eng oddiy va eng ishlaydigan variant — '
            + 'har kim o‘zidan keyin darhol yuvadi. "Keyin yuvaman" degan tartib hech qayerda '
            + 'ishlamagan.',
          'Tinchlik soatlari haqida ham gaplashing, ayniqsa biringiz ertalab ishga, '
            + 'ikkinchingiz kechqurun o‘qishga borsangiz. Kechasi soat nechadan keyin '
            + 'musiqa va telefon suhbati quloqchin bilan bo‘ladi — shu bitta jumla ko‘p '
            + 'uyquni saqlab qoladi. Va oxirgisi: umumiy oziq-ovqat masalasi. Muzlatgichda '
            + 'hamma narsa umumiymi yoki har kim o‘zinikini oladimi — buni ham aytib '
            + 'qo‘ying, chunki bu ham janjal sababi bo‘la oladi.',
        ],
        bullets: [
          'Mehmon: qancha vaqtga, qanchalik tez-tez, oldindan aytiladimi.',
          'Tozalash navbati va umumiy joylar ro‘yxati.',
          'Idish-tovoq qoidasi — eng oddiysi eng yaxshisi.',
          'Tinchlik soatlari va quloqchin qoidasi.',
          'Muzlatgich: umumiy javon va shaxsiy javon.',
          'Chekish, uy hayvoni va uydan tashqaridagi odatlar.',
        ],
      },
      {
        heading: 'Kimdir muddat o‘rtasida chiqib ketsa',
        paragraphs: [
          'Bu sheriklikning eng og‘riqli holati va u kutilganidan ko‘ra tez-tez sodir '
            + 'bo‘ladi: ish o‘zgaradi, oila sharoiti o‘zgaradi, talaba boshqa shaharga '
            + 'o‘tadi. Agar bu haqda oldindan gaplashilmagan bo‘lsa, qolgan odam butun ijara '
            + 'bilan yolg‘iz qoladi va bir hafta ichida yangi sherik topishga majbur '
            + 'bo‘ladi — eng yomon shartlarda.',
          'Shuning uchun uchta narsani oldindan kelishing. Birinchisi — ogohlantirish '
            + 'muddati: chiqmoqchi bo‘lgan odam necha kun oldin aytishi shart. Ikkinchisi — '
            + 'yangi sherikni kim topadi va uni ikkalangiz ham ma’qullashi kerakmi. '
            + 'Uchinchisi — yangi odam topilgunicha bo‘sh xonaning ijarasi kimning '
            + 'zimmasida bo‘ladi. Bu uchtasi ko‘pincha eng noqulay suhbatlarni butunlay '
            + 'yo‘q qiladi.',
          'Zakladka masalasi ham shu yerda hal qilinsin. Agar pulni bitta odam qo‘ygan '
            + 'bo‘lsa va chiqayotgan odam aynan o‘sha bo‘lsa, uning ulushi qanday '
            + 'qaytariladi: yangi sherikdan olinadimi yoki chiqish paytida uy egasidan '
            + 'kelgan summadan hisoblanadimi. Zakladka bo‘yicha umumiy qoidalar alohida '
            + 'maqolada batafsil yozilgan.',
        ],
      },
      {
        heading: 'Kelishuvni yozib qo‘ying',
        paragraphs: [
          'Barcha kelishuvni bitta joyda yozib qo‘yish kerak. Bu rasmiy hujjat bo‘lishi '
            + 'shart emas: telefondagi umumiy eslatma yoki chatdagi bitta xabar ham '
            + 'yetarli. Muhimi shundaki, ikkalangiz ham bir xil matnni ko‘rgan bo‘lasiz va '
            + 'olti oydan keyin "biz bunday kelishmagan edik" degan bahs chiqmaydi.',
          'Bu kelishuv uy egasi bilan tuzilgan shartnomani almashtirmaydi — u faqat sizlar '
            + 'o‘rtangizdagi tartib. Uy egasi oldida javobgarlik baribir shartnomada ismi '
            + 'turgan odamlarda qoladi. Pul yoki javobgarlik masalasi jiddiy bo‘lsa, bu '
            + 'yerdagi maslahatlar umumiy amaliyot ekanini yodda tuting va aniq holatingiz '
            + 'uchun yuristdan maslahat oling.',
        ],
      },
    ],
    faq: [
      {
        q: 'Sherikni qayerdan topsa bo‘ladi?',
        a:
          'Sheriklikka mo‘ljallangan alohida bo‘lim bor: unda sherik izlayotgan odam ham, '
          + 'kvartirasiga sherik qidirayotgan uy egasi ham e’lon joylashi mumkin. Jins '
          + 'bo‘yicha tanlash imkoniyati ham mavjud.',
      },
      {
        q: 'Ikkalamiz ham shartnomani imzolashimiz shartmi?',
        a:
          'Shart emas, lekin bu eng to‘g‘ri yo‘l. Aks holda barcha javobgarlik imzolagan '
          + 'odamda qoladi, ikkinchisining esa uyda yashash huquqi rasman tasdiqlanmagan '
          + 'bo‘ladi.',
      },
      {
        q: 'Sherik to‘lamay qo‘ysa, uy egasi kimdan talab qiladi?',
        a:
          'Shartnomada ismi turgan odamdan. Agar u yolg‘iz imzolagan bo‘lsa, butun summa '
          + 'uning zimmasida bo‘ladi. Aynan shuning uchun ikkala ism shartnomada bo‘lgani '
          + 'ma’qul.',
      },
    ],
  },

  {
    slug: 'kommunal-tolovlar',
    title: 'Kommunal to‘lovlar: kim nimani to‘laydi',
    summary:
      'Qaysi xizmat hisoblagich bo‘yicha, qaysi biri jon boshiga hisoblanadi, "kommunal '
      + 'alohida" nimani anglatadi va birovning qarzidan qanday saqlanish kerak.',
    publishedAt: '2026-02-11',
    updatedAt: '2026-08-18',
    readingMinutes: 7,
    h1: 'Ijarada kommunal to‘lovlar: mexanizmi, taqsimoti va hisoblagichlar',
    intro:
      'Ijara narxi haqida hamma gaplashadi, kommunal haqida esa deyarli hech kim — toki '
      + 'birinchi qishki hisob kelmaguncha. Aynan shu yerda ko‘p ijarachi tushunadiki, '
      + '"kommunal alohida" degan qisqa ibora e’londa juda beg‘ubor ko‘ringan ekan. '
      + 'O‘zbekistonda kommunal to‘lovlar bir necha xil mexanizm bo‘yicha hisoblanadi: '
      + 'bir qismi hisoblagich ko‘rsatkichiga, bir qismi uyda yashovchilar soniga, yana '
      + 'bir qismi kvartira maydoniga bog‘liq. Bu farqni bilmasdan turib, oy oxirida '
      + 'kelgan raqamni tekshirib ham bo‘lmaydi. Quyida hech qanday tarif keltirilmagan — '
      + 'ular o‘zgarib turadi va joylashuvga qarab farq qiladi. Buning o‘rniga tizim '
      + 'qanday ishlashi, uy egasi bilan nimani kelishish kerakligi va oldingi '
      + 'ijarachining qarzi sizga o‘tib qolmasligi uchun nima qilish lozimligi '
      + 'tushuntirilgan.',
    sections: [
      {
        heading: 'Hisoblagichli va hisoblagichsiz xizmatlar',
        paragraphs: [
          'Kommunal to‘lovlarni ikki guruhga bo‘lib qarash eng osoni. Birinchi guruh — '
            + 'hisoblagich bo‘yicha to‘lanadiganlar. Bularga elektr energiyasi, tabiiy gaz '
            + 'va ichimlik suvi kiradi: har birining o‘z hisoblagichi bor va to‘lov siz '
            + 'sarflagan hajmga bog‘liq. Bu guruhda tejash bevosita hisobda aks etadi, va '
            + 'aynan shuning uchun hisoblagichning ishlayotganiga ishonch hosil qilish '
            + 'muhim.',
          'Ikkinchi guruh — sarfga bog‘liq bo‘lmagan to‘lovlar. Chiqindi olib ketish odatda '
            + 'uyda yashovchilar soniga qarab hisoblanadi, ko‘p qavatli uydagi umumiy '
            + 'xizmatlar — podyezd tozalash, lift, hovlini obodonlashtirish — esa odatda '
            + 'kvartira maydoni bo‘yicha, uy boshqaruvi yoki turar joy mulkdorlari shirkati '
            + 'orqali undiriladi. Bu to‘lovlar siz uyda yashaysizmi yoki bir oy yo‘q '
            + 'bo‘lasizmi — baribir keladi.',
          'Bu bo‘linish amaliy jihatdan muhim, chunki muzokara nuqtalari boshqa-boshqa. '
            + 'Hisoblagichli xizmatlar deyarli har doim ijarachining zimmasida bo‘ladi, '
            + 'chunki ularni ijarachi sarflaydi. Uy va uning mulkiga tegishli doimiy '
            + 'to‘lovlar esa ko‘pincha uy egasida qoladi. Amalda esa bu har bir kelishuvda '
            + 'alohida hal qilinadi, shuning uchun uni og‘zaki emas, yozma tarzda '
            + 'aniqlashtirish kerak.',
        ],
        bullets: [
          'Hisoblagich bo‘yicha: elektr, gaz, ichimlik suvi.',
          'Jon boshiga: odatda chiqindi olib ketish xizmati.',
          'Maydon bo‘yicha: uy boshqaruvi yoki shirkat to‘lovi, lift, umumiy joylar.',
          'Alohida shartnomalar: internet, kabel televidenie, qo‘riqlash.',
          'Isitish — uy turiga qarab markaziy, kolonkali yoki elektr hisobidan.',
        ],
      },
      {
        heading: '"Kommunal alohida" aslida nimani anglatadi',
        paragraphs: [
          'E’lonlardagi eng chalkash ibora shu. Ba’zi uy egalari uni "faqat svet va suv '
            + 'sizning hisobingizdan" degan ma’noda ishlatadi, boshqalari esa uy '
            + 'boshqaruvi to‘lovi, chiqindi, internet va qishki isitishni ham shu iboraga '
            + 'kiritadi. Ikkalasi ham o‘zicha to‘g‘ri yozgan bo‘ladi, chunki bu ibora '
            + 'standart emas — u shunchaki odat.',
          'Shuning uchun birinchi qo‘ng‘iroqdayoq iborani ochib bering. "Kommunal alohida '
            + 'deganda nimani nazarda tutyapsiz?" degan savol butunlay o‘rinli va normal uy '
            + 'egasi unga bir daqiqada javob beradi. So‘ng javobni xizmatma-xizmat '
            + 'aniqlashtiring: svet, gaz, suv, chiqindi, uy boshqaruvi, internet, isitish. '
            + 'Yetti nom, yetti javob — shu bilan mavzu yopiladi.',
          'Kelishilgan taqsimot shartnomada nomma-nom yozilishi kerak. "Kommunal to‘lovlar '
            + 'ijarachi zimmasida" degan bitta jumla qishda kutilmagan hisobga aylanadi, '
            + 'ayniqsa markaziy isitishsiz uylarda, u yerda isitish elektr hisobiga tushadi '
            + 'va qishki hisob yozgidan keskin farq qiladi.',
        ],
      },
      {
        heading: 'Ko‘rsatkichlarni o‘qish va topshirish',
        paragraphs: [
          'Hisoblagichni o‘qish ko‘rinishidan oddiy, lekin bir necha nozik joyi bor. '
            + 'Ko‘pchilik hisoblagichda oxirgi raqam yoki raqamlar boshqa rangda — odatda '
            + 'qizil ramkada — bo‘ladi va ular kasr qismini bildiradi. Topshirishda faqat '
            + 'butun qism yoziladi. Elektr hisoblagichlarning ko‘pchiligi bugun raqamli va '
            + 'ekranda bir necha ko‘rsatkichni navbat bilan ko‘rsatadi; agar tarif zonalarga '
            + 'bo‘lingan bo‘lsa, har bir zona uchun alohida raqam bo‘ladi.',
          'Ko‘rsatkichni topshirishning bir necha yo‘li bor: xizmat ko‘rsatuvchi '
            + 'korxonaning mobil ilovasi yoki shaxsiy kabineti orqali, to‘lov terminallari '
            + 'va ilovalarida, yoki uy boshqaruvi orqali. Zamonaviy hisoblagichlarning bir '
            + 'qismi ko‘rsatkichni o‘zi uzatadi va bu holda sizdan hech narsa talab '
            + 'qilinmaydi. Qaysi tartib amal qilishini uy egasidan aniq so‘rab oling — bu '
            + 'har bir uyda har xil.',
          'Yaxshi odat: har oyning bir xil kunida uch hisoblagichni suratga olib qo‘yish. '
            + 'Bu bir daqiqalik ish, lekin nizo chiqqanda butun bir yillik tarix qo‘lingizda '
            + 'bo‘ladi. Suratlarni telefonda alohida albomga yig‘ing va uy egasi bilan '
            + 'umumiy chatga tashlab boring.',
        ],
        bullets: [
          'Qizil ramkadagi oxirgi raqamlar kasr qismi — ular topshirilmaydi.',
          'Elektr, gaz va suv uchun uchta alohida ko‘rsatkich.',
          'Ko‘rsatkich qaysi kanal orqali va oyning qaysi kunlarida topshiriladi.',
          'Har oyda bir xil kunda suratga olish — nizoga qarshi eng oson himoya.',
          'Hisoblagich plombasi butunligi — buni ko‘chib kirgan kuni ko‘ring.',
        ],
      },
      {
        heading: 'Uy egasi va ijarachi o‘rtasidagi odatiy taqsimot',
        paragraphs: [
          'O‘zbekistonda keng tarqalgan amaliyotga ko‘ra, ijarachi o‘zi sarflaydigan '
            + 'narsalarni to‘laydi: elektr, gaz, suv va chiqindi. Uyning o‘ziga tegishli, '
            + 'yashovchidan qat’i nazar keladigan to‘lovlar — uy boshqaruvi yoki shirkat '
            + 'badali, kapital ta’mir jamg‘armasi kabilar — ko‘pincha uy egasida qoladi. '
            + 'Ammo bu qonun emas, bu odat: tomonlar boshqacha kelishishi ham mumkin va bu '
            + 'butunlay normal.',
          'Internet alohida turadi. Ba’zi uylarda kabel allaqachon tortilgan va shartnoma '
            + 'uy egasi nomida bo‘ladi — bunda odatda ijarachi oylik to‘lovni qoplaydi. '
            + 'Boshqa uylarda ijarachi o‘z provayderini o‘zi olib kiradi. Ikkinchi holatda '
            + 'ulanish uchun texnik ishlar kerak bo‘lishi mumkin, shuning uchun uy egasidan '
            + 'ruxsat oldindan olinsin.',
          'Isitish esa alohida suhbat mavzusi. Markaziy isitishli uylarda to‘lov odatda '
            + 'boshqa tartibda hisoblanadi va e’londa aytilgan "kommunal" ichiga kirmasligi '
            + 'mumkin. Kolonkali uylarda isitish gaz hisobiga, elektr isitgichli uylarda esa '
            + 'to‘liq elektr hisobiga tushadi va bu qishda seziladi. Shuning uchun uy '
            + 'ko‘rayotganda o‘tgan qishdagi hisob haqida so‘rash eng foydali savollardan '
            + 'biri hisoblanadi.',
        ],
      },
      {
        heading: 'Birovning qarzini meros qilib olmaslik',
        paragraphs: [
          'Bu eng ko‘p uchraydigan noxush kutilmagan hol: ko‘chib kirasiz, birinchi hisob '
            + 'keladi va undagi summa siz sarflagan narsaga umuman mos kelmaydi, chunki '
            + 'unda oldingi ijarachidan qolgan qarz ham bor. Rasman qarz shaxsiy hisob '
            + 'raqamiga, ya’ni uyga bog‘langan bo‘ladi va uni kim to‘lagani xizmat '
            + 'ko‘rsatuvchi korxona uchun ahamiyatsiz.',
          'Buning oldini olish uchun ko‘chib kirishdan oldin ikki narsani qiling. '
            + 'Birinchidan, uy egasidan har bir xizmat bo‘yicha oxirgi to‘lov '
            + 'kvitansiyalarini yoki ilovadagi hisob holatini ko‘rsatishni so‘rang: qarz '
            + 'yo‘qligi ekranda ko‘rinadi. Ikkinchidan, kalitni olgan kuni uch '
            + 'hisoblagichning ko‘rsatkichini yozib oling, suratga tushiring va ularni '
            + 'shartnomaga ilova qiling yoki hech bo‘lmasa uy egasi bilan yozishmada '
            + 'tasdiqlang.',
          'Shartnomaga bitta qisqa jumla qo‘shish ham foydali: shartnoma imzolangan sanagacha '
            + 'yig‘ilgan barcha kommunal qarz uy egasining zimmasida qoladi. Bu jumla '
            + 'keyinchalik kim nimani to‘lashi haqidagi bahsni bir zumda hal qiladi.',
        ],
        bullets: [
          'Har bir xizmat bo‘yicha qarz yo‘qligini ko‘chib kirishdan oldin ko‘ring.',
          'Kalit olingan kundagi uch ko‘rsatkich — yozma va surat bilan.',
          'Shartnomada sana bo‘yicha qarz chegarasini belgilovchi jumla.',
          'Hisoblagichlar plombasi va ishlayotgani tekshirilgan bo‘lsin.',
          'Internet va kabel bo‘yicha ham qarz yo‘qligi so‘ralsin.',
        ],
      },
      {
        heading: 'Chiqish kuni: hisobni yopib ketish',
        paragraphs: [
          'Uydan chiqayotganda kommunalni yopib ketish sizning manfaatingizda, chunki '
            + 'to‘lanmagan qarz ko‘pincha zakladkadan ushlab qolinadi. Oxirgi kunda uch '
            + 'hisoblagichning ko‘rsatkichini yana yozib oling va suratga tushiring, '
            + 'so‘nggi hisoblarni to‘lang va cheklarni saqlang. Uy egasiga ham nusxasini '
            + 'yuboring.',
          'Uyni topshirish paytida bu ko‘rsatkichlarni birga ko‘rib chiqing va tilxatga '
            + 'yozib qo‘ying: shu sanada shunday ko‘rsatkich, qarz yo‘q. Shundan keyin '
            + 'kelgan har qanday hisob sizga tegishli emas va buni isbotlash uchun '
            + 'qo‘lingizda hujjat bo‘ladi.',
          'Bu maqolada tariflar keltirilmagani ataylab: ular o‘zgarib turadi va aniq '
            + 'raqamni faqat xizmat ko‘rsatuvchi korxonaning o‘z manbasidan olish to‘g‘ri '
            + 'bo‘ladi. Bu yerda tasvirlangan taqsimot va tartiblar esa umumiy amaliyot '
            + 'bo‘lib, huquqiy maslahat o‘rnini bosmaydi.',
        ],
      },
    ],
    faq: [
      {
        q: 'Kommunalni odatda kim to‘laydi — uy egasimi yoki ijarachimi?',
        a:
          'Keng tarqalgan amaliyotda ijarachi o‘zi sarflagan xizmatlarni — svet, gaz, suv '
          + 'va chiqindini — to‘laydi, uy boshqaruvi badali esa ko‘pincha uy egasida '
          + 'qoladi. Bu qonuniy majburiyat emas, kelishuv masalasi, shuning uchun '
          + 'shartnomada yozilsin.',
      },
      {
        q: 'Ko‘chib kirganimda eski qarz chiqib qolsa nima qilaman?',
        a:
          'Kalit olingan kundagi hisoblagich suratlari va shartnomadagi qarz chegarasi '
          + 'haqidagi jumla shu holatni hal qiladi. Ular bo‘lmasa, masala uy egasi bilan '
          + 'yozma muzokaraga aylanadi va isbot og‘irroq bo‘ladi.',
      },
      {
        q: 'Qishda kommunal qancha chiqishini oldindan bilsa bo‘ladimi?',
        a:
          'Aniq raqamni yo‘q, lekin uy egasidan o‘tgan qishdagi hisoblarni ko‘rsatishni '
          + 'so‘rash mumkin va bu eng ishonchli mo‘ljal. Isitish turi ham katta ahamiyatga '
          + 'ega: elektr isitgichga tayangan uyda qishki hisob sezilarli yuqori bo‘ladi.',
      },
    ],
  },
];

export const UZ_HELP: HelpArticle[] = [
  {
    slug: 'savol-javob',
    title: 'Platforma qanday ishlaydi',
    summary:
      'Qidiruvdan kalitgacha va e’londan kelishuvgacha: ijarachi hamda uy egasi uchun '
      + 'to‘liq tartib.',
    h1: 'Platforma qanday ishlaydi',
    intro:
      'Maklersiz Uy — e’lonlar taxtasi. Bu yerda uy egasi o‘z e’lonini o‘zi joylaydi, '
      + 'ijarachi esa uni to‘g‘ridan-to‘g‘ri topadi. Oraliqda vositachi ham, komissiya ham '
      + 'yo‘q. Quyida jarayonning har ikki tomoni boshdan-oyoq tushuntirilgan.',
    sections: [
      {
        heading: 'Ijarachi uchun: qidiruvdan kalitgacha',
        paragraphs: [
          'Ro‘yxatdan o‘tmasdan ham e’lonlarni ko‘rish, filtrlash va saralash mumkin. '
            + 'Faqat uy egasining telefon raqamini ko‘rish uchun tizimga kirish talab '
            + 'qilinadi — bu raqamlarni avtomatik yig‘ib oluvchi dasturlardan himoya '
            + 'qilish uchun.',
          'Qidiruvni hudud, kategoriya, narx oralig‘i, xonalar soni va metro bekati '
            + 'bo‘yicha toraytiring. Yoqqan e’lonni saqlab qo‘ying va bir nechtasini '
            + 'yonma-yon solishtiring. Keyin uy egasiga o‘zingiz qo‘ng‘iroq qilasiz, '
            + 'uyni ko‘rasiz va kelishuvni bevosita u bilan tuzasiz.',
        ],
        bullets: [
          'Qidirish va e’lon ko‘rish — ro‘yxatdan o‘tmasdan.',
          'Telefon raqamni ko‘rish — tizimga kirgandan keyin.',
          'Saralanganlar ro‘yxati bilan bir nechta variantni solishtirish.',
          'Qo‘ng‘iroq, ko‘rish va shartnoma — to‘g‘ridan-to‘g‘ri uy egasi bilan.',
        ],
      },
      {
        heading: 'Uy egasi uchun: e’londan kelishuvgacha',
        paragraphs: [
          'Ro‘yxatdan o‘ting va telefon raqamingizni tasdiqlang. Keyin "E’lon berish" '
            + 'bo‘limida uy turini, manzilini, xonalar sonini, narxini va rasmlarini '
            + 'kiriting. E’lon avtomatik tekshiruvdan o‘tib chop etiladi.',
          'E’lonni istalgan vaqtda tahrirlash, vaqtincha yashirish yoki butunlay '
            + 'o‘chirish mumkin. Uy topshirilgach e’lonni yopib qo‘yish qoidasi — '
            + 'oddiy odob masalasi: shunda ijarachilar bo‘sh bo‘lmagan uyga qo‘ng‘iroq '
            + 'qilib vaqt yo‘qotmaydi.',
        ],
      },
      {
        heading: 'Tekshiruv va ishonch belgilari',
        paragraphs: [
          'Har bir e’lon chop etilishidan oldin avtomatik tekshiruvdan o‘tadi: takroriy '
            + 'rasmlar, vositachi uslubidagi matn va bozorga mos kelmaydigan narx '
            + 'belgilanadi. Foydalanuvchilar ham istalgan e’lonni bir bosishda shikoyat '
            + 'qilib qoldirishi mumkin va bunday e’lon moderatorga tushadi.',
          'Uy egasi qo‘shimcha ravishda shaxsini va mulk hujjatini tasdiqlashi mumkin. '
            + 'Tasdiqlangan e’lonlar alohida belgi oladi. Belgi uyning sifatiga kafolat '
            + 'emas — u faqat e’lonni joylagan odam kimligi tekshirilganini bildiradi.',
        ],
      },
      {
        heading: 'Nima bepul',
        paragraphs: [
          'Hammasi. Qidirish, e’lon ko‘rish, telefon raqam olish, e’lon joylash va uni '
            + 'tasdiqlashdan o‘tkazish — ijarachi uchun ham, uy egasi uchun ham to‘lovsiz. '
            + 'Platforma hech qanday komissiya, vositachilik yoki xizmat haqi olmaydi.',
          'Agar kimdir sizdan "sayt uchun", "shartnoma rasmiylashtirish uchun" yoki '
            + '"bazaga kirish uchun" pul so‘rasa — bu platformaning odami emas. Bunday '
            + 'e’lonni darhol shikoyat qiling.',
        ],
      },
      {
        heading: 'Muammo chiqsa',
        paragraphs: [
          'E’lon bilan bog‘liq har qanday muammo — noto‘g‘ri ma’lumot, boshqa uyning '
            + 'rasmlari, vositachi yoki pul talab qilish — shikoyat tugmasi orqali '
            + 'bildiriladi. Iloji bo‘lsa yozishmalar ekran suratini ham saqlab qo‘ying.',
          'Platforma ijara kelishuvining tomoni emas, shuning uchun tomonlar o‘rtasidagi '
            + 'pul yoki shartnoma bahsini hal qila olmaydi. Lekin qoidabuzar e’lon va '
            + 'akkauntga nisbatan chora ko‘riladi, jiddiy holatlarda esa huquq-tartibot '
            + 'organlariga murojaat qilish tavsiya etiladi.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },

  {
    slug: 'xavfsizlik',
    title: 'Xavfsizlik qoidalari',
    summary:
      'Uyni ko‘rgani borganda va zakladka to‘laganda amal qilinadigan oddiy qoidalar — '
      + 'ularning aksariyati bir daqiqalik ish.',
    h1: 'Uy ko‘rish va to‘lov xavfsizligi',
    intro:
      'Ijara bilan bog‘liq muammolarning katta qismi bir nechta oddiy qoidaga amal '
      + 'qilinmagani uchun kelib chiqadi. Bu qoidalar hech kimga ishonmaslik haqida emas — '
      + 'ular shunchaki keyin isbotlash qiyin bo‘lgan narsalarni oldindan hujjatlashtirish '
      + 'haqida. Har biri bir necha daqiqa vaqt oladi.',
    sections: [
      {
        heading: 'Qo‘ng‘iroq va yozishmalar bosqichi',
        paragraphs: [
          'Suhbatni platforma va telefon orqali olib boring, muhim kelishuvlarni esa '
            + 'yozma qoldiring. Hujjat kimning nomida ekanini va shartnomani kim '
            + 'imzolashini birinchi suhbatdayoq so‘rang: bu bitta savol ko‘p vaqtni '
            + 'tejaydi.',
          'Pasportingiz nusxasini, bank kartangiz raqamini yoki SMS-kodni hech kimga '
            + 'yubormang. Uy ijarasi uchun bularning hech biri kerak emas. Bunday so‘rov '
            + 'kelsa, suhbatni to‘xtating va e’lonni shikoyat qiling.',
        ],
      },
      {
        heading: 'Uyni ko‘rgani borganda',
        paragraphs: [
          'Iloji bo‘lsa kunduzi va yolg‘iz emas, biror tanishingiz bilan boring. '
            + 'Qayerga va kim bilan ketayotganingizni yaqinlaringizga aytib qo‘ying, '
            + 'manzilni ularga yuboring. Bu ortiqcha ehtiyotkorlik emas — bu oddiy odat.',
          'Uyda hujjatni o‘z ko‘zingiz bilan ko‘ring va undagi ismni pasport bilan '
            + 'solishtiring. Uyni ko‘rsatayotgan odam egasi bo‘lmasa, uning yozma '
            + 'vakolatini so‘rang. Kelishuvga shoshilmang: bir kun o‘ylab ko‘rish '
            + 'huquqingiz bor va halol uy egasi buni tushunadi.',
        ],
        bullets: [
          'Kunduzi va imkon bo‘lsa hamroh bilan boring.',
          'Manzilni yaqinlaringizga oldindan yuboring.',
          'Hujjat va pasportni solishtiring.',
          'Uyning barcha xonasini va hisoblagichlarni suratga oling.',
          'Bosim ostida qaror qabul qilmang.',
        ],
      },
      {
        heading: 'To‘lov qoidalari',
        paragraphs: [
          'Uyni ko‘rmasdan turib hech qanday pul o‘tkazmang — na oldindan to‘lov, na '
            + '"band qilish" haqi, na "kalitni ushlab turish" uchun. Bu talab '
            + 'firibgarlikning eng keng tarqalgan boshlanishi.',
          'To‘lovni imzolangan shartnomadan keyin amalga oshiring va tilxat oling. '
            + 'Zakladka miqdori, uni ushlab qolish asoslari va qaytarish muddati '
            + 'shartnomada aniq yozilgan bo‘lsin. Naqd to‘langan har bir summa uchun '
            + 'yozma tasdiq qoldiring.',
        ],
      },
      {
        heading: 'Shubhali e’lonni belgilash',
        paragraphs: [
          'Har bir e’lon sahifasida shikoyat tugmasi bor. Bir bosish yetarli, sabab esa '
            + 'bir og‘iz so‘z bilan yozilsa kifoya. Shikoyat qilingan e’lon moderatorga '
            + 'tushadi, telefon raqam esa boshqa e’lonlar bo‘yicha ham tekshiriladi.',
          'Shubhalanish uchun aniq dalil shart emas. Sizga g‘alati tuyulgan narsani '
            + 'belgilash o‘zingizdan keyin keladigan odamni saqlab qolishi mumkin, '
            + 'noto‘g‘ri shikoyat esa hech kimga zarar keltirmaydi.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },

  {
    slug: 'foydalanish-shartlari',
    title: 'Foydalanish shartlari',
    summary:
      'E’lon joylash qoidalari, taqiqlanadigan xatti-harakatlar, moderatsiya tartibi va '
      + 'platformaning roli haqida sodda tilda.',
    h1: 'Foydalanish shartlari',
    intro:
      'Quyida platformadan foydalanish qoidalari sodda tilda bayon etilgan. Saytga kirish '
      + 'va undan foydalanish shu qoidalarga rozilikni bildiradi. Bu matn umumiy '
      + 'tushuntirish sifatida yozilgan va yuridik maslahat o‘rnini bosmaydi — aniq '
      + 'holatingiz bo‘yicha malakali yuristga murojaat qiling.',
    sections: [
      {
        heading: 'Platforma nima qiladi va nima qilmaydi',
        paragraphs: [
          'Maklersiz Uy — e’lonlar taxtasi. Platforma uy egalari joylagan e’lonlarni '
            + 'ko‘rsatadi va foydalanuvchilarga ularni topish imkonini beradi. Boshqa '
            + 'hech narsa qilmaydi.',
          'Platforma ijara kelishuvining tomoni emas. U uyni ijaraga bermaydi, ijaraga '
            + 'olmaydi, shartnoma tuzmaydi, pul qabul qilmaydi va tomonlar o‘rtasida '
            + 'vositachilik qilmaydi. Shartnoma faqat uy egasi bilan ijarachi o‘rtasida '
            + 'tuziladi va uning shartlari uchun javobgarlik ham shu ikki tomonda '
            + 'qoladi.',
          'Platforma hech qanday komissiya, vositachilik yoki xizmat haqi olmaydi. '
            + 'Sizdan platforma nomidan pul so‘ragan har qanday odam qoidabuzar '
            + 'hisoblanadi va bu haqda xabar berish kerak.',
        ],
      },
      {
        heading: 'E’lon joylash qoidalari',
        paragraphs: [
          'E’lonni faqat uyning egasi yoki uni topshirishga vakolatli shaxs joylashi '
            + 'mumkin. E’londagi ma’lumot haqiqiy bo‘lishi, rasmlar esa aynan o‘sha uyga '
            + 'tegishli va yaqin vaqtda olingan bo‘lishi shart.',
          'Uy topshirilgach yoki e’lon o‘z ahamiyatini yo‘qotgach uni yopib qo‘yish '
            + 'kerak. Bir uy bo‘yicha ko‘p marta takroriy e’lon joylash, e’lonni sun’iy '
            + 'ravishda tepaga chiqarish maqsadida o‘chirib-qayta joylash qoidabuzarlik '
            + 'hisoblanadi.',
        ],
        bullets: [
          'Faqat haqiqiy, mavjud va ijaraga beriladigan uy-joy e’lonlari.',
          'Rasmlar o‘sha uyniki bo‘lsin, boshqa manbadan olinmasin.',
          'Narx va shartlar aniq va haqiqatga mos ko‘rsatilsin.',
          'Bir uy — bir e’lon.',
          'Uy topshirilgach e’lon yopilsin.',
        ],
      },
      {
        heading: 'Taqiqlanadigan xatti-harakatlar',
        paragraphs: [
          'Quyidagilar qat’iy taqiqlanadi va e’lonning o‘chirilishiga, takrorlanganda '
            + 'esa hisobning bloklanishiga olib keladi.',
        ],
        bullets: [
          'Vositachilik xizmati va uning evaziga haq talab qilish.',
          'O‘zini uy egasi qilib ko‘rsatish yoki soxta ma’lumot kiritish.',
          'Uyni ko‘rsatishdan yoki shartnomadan oldin pul talab qilish.',
          'Boshqa odamning rasmi, matni yoki telefon raqamini ishlatish.',
          'Ijaraga aloqasi bo‘lmagan reklama, xizmat yoki tovar e’lonlari.',
          'Haqorat, kamsitish, tahdid va shaxsiy ma’lumotni ruxsatsiz tarqatish.',
          'Saytdan ma’lumotlarni avtomatik yig‘ish va uni qayta sotish.',
        ],
      },
      {
        heading: 'Moderatsiya va hisobni to‘xtatib turish',
        paragraphs: [
          'E’lonlar avtomatik tekshiruvdan o‘tadi, foydalanuvchilar shikoyati esa '
            + 'moderator tomonidan ko‘rib chiqiladi. Qoidalarga zid e’lon tahrirlashga '
            + 'qaytarilishi yoki o‘chirilishi mumkin.',
          'Takroriy yoki qo‘pol qoidabuzarlik holatida hisob vaqtincha to‘xtatiladi '
            + 'yoki butunlay yopiladi. Qaror asossiz deb hisoblasangiz, murojaat qilish '
            + 'va vaziyatni tushuntirish imkoniyati bor.',
        ],
      },
      {
        heading: 'Javobgarlik chegaralari',
        paragraphs: [
          'E’londagi ma’lumotning to‘g‘riligi uchun uni joylagan foydalanuvchi javob '
            + 'beradi. Platforma har bir uyni jismonan tekshira olmaydi va shartnoma '
            + 'shartlari, to‘lovlar yoki tomonlar o‘rtasidagi nizolar uchun javobgar '
            + 'emas. Shu sababli uyni ko‘rish, hujjatni tekshirish va yozma shartnoma '
            + 'tuzish har bir foydalanuvchining o‘z zimmasida.',
          'Qoidalar vaqti-vaqti bilan yangilanishi mumkin; sahifaning pastida oxirgi '
            + 'yangilanish sanasi ko‘rsatiladi. Yana bir bor eslatamiz: bu sahifa umumiy '
            + 'tushuntirish bo‘lib, yuridik maslahat o‘rnini bosmaydi.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },

  {
    slug: 'maxfiylik-siyosati',
    title: 'Maxfiylik siyosati',
    summary:
      'Qanday ma’lumot yig‘iladi, nima uchun kerak, telefon raqamni kim ko‘radi va '
      + 'hisobni qanday o‘chirish mumkin.',
    h1: 'Maxfiylik siyosati',
    intro:
      'Bu sahifa qanday ma’lumot yig‘ilishini, u nima uchun kerakligini va uni qanday '
      + 'boshqarish mumkinligini sodda tilda tushuntiradi. Matn umumiy tushuntirish '
      + 'sifatida yozilgan va yuridik maslahat o‘rnini bosmaydi.',
    sections: [
      {
        heading: 'Qanday ma’lumot yig‘iladi',
        paragraphs: [
          'Ro‘yxatdan o‘tishda telefon raqamingiz va ismingiz so‘raladi. Uy egasi '
            + 'bo‘lsangiz, e’lonlaringiz — manzil, narx, tavsif va rasmlar — ham '
            + 'saqlanadi. Bundan tashqari saylanganlar ro‘yxati va qidiruv sozlamalari '
            + 'kabi hisobingizga bog‘liq oddiy ma’lumotlar saqlanadi.',
          'Saytga tashrif haqidagi umumiy statistika anonim tarzda yig‘iladi: qaysi '
            + 'sahifalar ochilgani, taxminiy hudud va qurilma turi. Bu ma’lumot shaxsni '
            + 'aniqlash uchun ishlatilmaydi va alohida foydalanuvchi bilan bog‘lanmaydi.',
        ],
        bullets: [
          'Telefon raqam va ism — hisobni yaratish va aloqa uchun.',
          'E’lon ma’lumotlari — saytda chop etish uchun.',
          'Saylanganlar va sozlamalar — sizga qulaylik uchun.',
          'Anonim tashrif statistikasi — saytni yaxshilash uchun.',
        ],
      },
      {
        heading: 'Nima uchun kerak',
        paragraphs: [
          'Telefon raqam ikki narsa uchun kerak: hisobni himoya qilish va ijarachi bilan '
            + 'uy egasini bog‘lash. Raqam tasdiqlanishi soxta va takroriy hisoblarni '
            + 'sezilarli kamaytiradi.',
          'Ma’lumotlar reklama maqsadida uchinchi tomonlarga sotilmaydi. Ular faqat '
            + 'platformaning ishlashi, xavfsizlik va qoidabuzarliklarni aniqlash uchun '
            + 'ishlatiladi. Qonun talab qilgan hollarda vakolatli organlarga ma’lumot '
            + 'berilishi mumkin.',
        ],
      },
      {
        heading: 'Telefon raqamni kim ko‘radi',
        paragraphs: [
          'Uy egasining telefon raqami faqat e’lonning to‘liq sahifasida va faqat '
            + 'tizimga kirgan foydalanuvchilarga ko‘rinadi. Qidiruv natijalarida, '
            + 'ro‘yxat sahifalarida va tizimga kirmagan mehmonlar uchun raqam '
            + 'ko‘rsatilmaydi.',
          'Bu cheklov ataylab qo‘yilgan: u raqamlarni ommaviy yig‘ib oluvchi dasturlar '
            + 'va reklama tarqatuvchilardan himoya qiladi. Raqamingiz e’lon matnining '
            + 'o‘zida yozib qo‘yilsa, bu himoya ishlamaydi — shuning uchun raqamni '
            + 'tavsifga yozmang.',
        ],
      },
      {
        heading: 'Cookie va statistika',
        paragraphs: [
          'Sayt tizimga kirgan holatingizni eslab qolish va sozlamalaringizni saqlash '
            + 'uchun brauzeringizda kichik fayllardan foydalanadi. Ularsiz har safar '
            + 'qayta kirishga to‘g‘ri kelardi.',
          'Tashriflar statistikasi umumlashtirilgan holda yuritiladi. Brauzeringiz '
            + 'sozlamalari orqali bu fayllarni cheklashingiz mumkin, ammo bunda '
            + 'saytning ba’zi qulayliklari ishlamay qolishi mumkin.',
        ],
      },
      {
        heading: 'Hisobni o‘chirish va ma’lumotlarni so‘rash',
        paragraphs: [
          'Hisob sozlamalari bo‘limida ismingizni va aloqa ma’lumotlaringizni istalgan '
            + 'vaqtda o‘zgartirishingiz, e’lonlaringizni yashirishingiz yoki '
            + 'o‘chirishingiz mumkin.',
          'Hisobni butunlay o‘chirishni so‘rasangiz, e’lonlaringiz saytdan olib '
            + 'tashlanadi va shaxsiy ma’lumotlaringiz o‘chiriladi. Ayrim texnik yozuvlar '
            + 'xavfsizlik va qonun talablari doirasida cheklangan muddat saqlanib '
            + 'qolishi mumkin. O‘zingiz haqingizda saqlanayotgan ma’lumotlar nusxasini '
            + 'ham so‘rashingiz mumkin.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },
];
