/**
 * Uzbekistan's administrative division, and the Tashkent metro.
 *
 * Despite the file name — kept because the geocoder, the create-listing
 * dropdowns and the backend's generated copy all import this path — none of
 * this is mock data. It is the real division: twelve viloyats, the Republic
 * of Karakalpakstan and the city of Tashkent, which is fourteen first-level
 * units (hududs), and inside them their tumans plus the cities that are
 * administrative units in their own right rather than part of a tuman.
 *
 * The previous version held an arbitrary subset — a handful of tumans per
 * region, 151 of them in total — which the home page then presented as "14
 * viloyat va 151 tuman". Both halves of that sentence were wrong: fourteen
 * counts hududs and not viloyats, and 151 was whatever happened to be listed
 * here. Every count the UI shows is derived from this array, so the fix is
 * the data, not the copy.
 *
 * Spelling follows what is already in the database. District names are
 * matched server-side with a case-insensitive LIKE against the value stored
 * on each listing, so re-transliterating an existing entry (`Bo'stonliq` to
 * `Boʻstonliq`, say) would quietly stop matching the listings that were
 * published under the old spelling. New entries therefore use the same plain
 * apostrophe as their neighbours, and no existing string was touched.
 *
 * Convention: a city that is its own unit carries ` sh.`, and where a tuman
 * shares that city's name it carries ` t.` — `Samarqand sh.` is the city,
 * `Samarqand t.` is the tuman around it.
 *
 * The backend keeps a generated copy at
 * `backend_python/app/data/locations.py`; it has to be regenerated with
 * `python -m scripts.sync_locations` after any change here.
 */

export interface RegionData {
  id: string;
  name: string;
  districts: string[];
}

export const UZBEKISTAN_REGIONS: RegionData[] = [
  {
    id: 'tashkent_city',
    name: 'Toshkent shahri',
    districts: ['Chilonzor', 'Yunusobod', 'Mirobod', 'Mirzo Ulugʻbek', 'Olmazor', 'Yakkasaroy', 'Sergeli', 'Shayxontohur', 'Yashnobod', 'Uchtepa', 'Bektemir', 'Yangihayot']
  },
  {
    id: 'tashkent_region',
    name: 'Toshkent viloyati',
    districts: ['Nurafshon sh.', 'Chirchiq sh.', 'Angren sh.', 'Olmaliq sh.', 'Bekobod sh.', 'Ohangaron sh.', 'Yangiyo\'l sh.', 'Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz', 'Ohangaron', 'Oqqurg\'on', 'O\'rta Chirchiq', 'Parkent', 'Pskent', 'Qibray', 'Quyi Chirchiq', 'Toshkent t.', 'Yangiyo\'l', 'Yuqori Chirchiq', 'Zangiota']
  },
  {
    id: 'samarkand',
    name: 'Samarqand viloyati',
    districts: ['Samarqand sh.', 'Kattaqo\'rg\'on sh.', 'Urgut sh.', 'Bulung\'ur', 'Ishtixon', 'Jomboy', 'Kattaqo\'rg\'on t.', 'Narpay', 'Nurobod', 'Oqdaryo', 'Pastdarg\'om', 'Paxtachi', 'Payariq', 'Qo\'shrabot', 'Samarqand t.', 'Toyloq', 'Urgut']
  },
  {
    id: 'fergana',
    name: 'Fargʻona viloyati',
    districts: ['Farg\'ona sh.', 'Qo\'qon sh.', 'Marg\'ilon sh.', 'Quvasoy sh.', 'Bag\'dod', 'Beshariq', 'Buvayda', 'Dang\'ara', 'Farg\'ona t.', 'Furqat', 'Oltiariq', 'O\'zbekiston', 'Qo\'shtepa', 'Quva', 'Rishton', 'So\'x', 'Toshloq', 'Uchko\'prik', 'Yozyovon']
  },
  {
    id: 'andijan',
    name: 'Andijon viloyati',
    districts: ['Andijon sh.', 'Xonobod sh.', 'Asaka sh.', 'Andijon t.', 'Asaka', 'Baliqchi', 'Bo\'ston', 'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Marhamat', 'Oltinko\'l', 'Paxtaobod', 'Qo\'rg\'ontepa', 'Shahrixon', 'Ulug\'nor', 'Xo\'jaobod']
  },
  {
    id: 'namangan',
    name: 'Namangan viloyati',
    districts: ['Namangan sh.', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Namangan t.', 'Norin', 'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Uychi', 'Yangiqo\'rg\'on']
  },
  {
    id: 'bukhara',
    name: 'Buxoro viloyati',
    districts: ['Buxoro sh.', 'Kogon sh.', 'Buxoro t.', 'G\'ijduvon', 'Jondor', 'Kogon t.', 'Olot', 'Peshku', 'Qorako\'l', 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent']
  },
  {
    id: 'qashqadaryo',
    name: 'Qashqadaryo viloyati',
    districts: ['Qarshi sh.', 'Shahrisabz sh.', 'Chiroqchi', 'Dehqonobod', 'G\'uzor', 'Kasbi', 'Kitob', 'Koson', 'Ko\'kdala', 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Qarshi t.', 'Shahrisabz t.', 'Yakkabog\'']
  },
  {
    id: 'surxondaryo',
    name: 'Surxondaryo viloyati',
    districts: ['Termiz sh.', 'Denov sh.', 'Angor', 'Bandixon', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Muzrabot', 'Oltinsoy', 'Qiziriq', 'Qumqo\'rg\'on', 'Sariosiyo', 'Sherobod', 'Sho\'rchi', 'Termiz t.', 'Uzun']
  },
  {
    id: 'khorezm',
    name: 'Xorazm viloyati',
    districts: ['Urganch sh.', 'Xiva sh.', 'Bog\'ot', 'Gurlan', 'Hazorasp', 'Qo\'shko\'pir', 'Shovot', 'Tuproqqal\'a', 'Urganch t.', 'Xiva t.', 'Xonqa', 'Yangiariq', 'Yangibozor']
  },
  {
    id: 'navoiy',
    name: 'Navoiy viloyati',
    districts: ['Navoiy sh.', 'Zarafshon sh.', 'Karmana', 'Konimex', 'Navbahor', 'Nurota', 'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi']
  },
  {
    id: 'jizzakh',
    name: 'Jizzax viloyati',
    districts: ['Jizzax sh.', 'Arnasoy', 'Baxmal', 'Do\'stlik', 'Forish', 'G\'allaorol', 'Mirzacho\'l', 'Paxtakor', 'Sharof Rashidov', 'Yangiobod', 'Zaafarobod', 'Zarbdor', 'Zomin']
  },
  {
    id: 'sirdaryo',
    name: 'Sirdaryo viloyati',
    districts: ['Guliston sh.', 'Shirin sh.', 'Yangiyer sh.', 'Boyovut', 'Guliston t.', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo t.', 'Xovos']
  },
  {
    id: 'karakalpakstan',
    name: 'Qoraqalpogʻiston Respublikasi',
    districts: ['Nukus sh.', 'Amudaryo', 'Beruniy', 'Bo\'zatov', 'Chimboy', 'Ellikqal\'a', 'Kegeyli', 'Mo\'ynoq', 'Nukus t.', 'Qanliko\'l', 'Qorao\'zak', 'Qo\'ng\'irot', 'Shumanay', 'Taxiatosh', 'Taxtako\'pir', 'To\'rtko\'l', 'Xo\'jayli']
  }
];

export interface MetroLineData {
  id: string;
  name: string;
  color: string;
  stations: string[];
}

export const TASHKENT_METRO_LINES: MetroLineData[] = [
  {
    id: 'chilonzor',
    name: "🔴 Chilonzor yo'li",
    color: '#ef4444',
    stations: [
      'Buyuk Ipak Yo\'li',
      'Pushkin',
      'Hamid Olimjon',
      'Amir Temur Xiyoboni',
      'Mustaqillik Maydoni',
      'Paxtakor',
      'Xalqlar Do\'stligi',
      'Milliy Bog\'',
      'Novza',
      'Mirzo Ulug\'bek',
      'Chilonzor',
      'Olmazor',
      'Choshtepa',
      'O\'tkir',
      'Sergeli',
      'Qipchoq'
    ]
  },
  {
    id: 'uzbekistan',
    name: "🔵 O'zbekiston yo'li",
    color: '#3b82f6',
    stations: [
      'Beruniy',
      'Tinchlik',
      'Chorsu',
      'G\'afur G\'ulom',
      'Alisher Navoiy',
      'O\'zbekiston',
      'Kosmonavtlar',
      'Oybek',
      'Toshkent (Vokzal)',
      'Mashinasozlar',
      'Do\'stlik (Chkalov)'
    ]
  },
  {
    id: 'yunusobod',
    name: "🟢 Yunusobod yo'li",
    color: '#10b981',
    stations: [
      'Turkiston',
      'Yunusobod',
      'Shahriston',
      'Bodomzor',
      'Minor',
      'Abdulla Qodiriy',
      'Yunus Rajabiy',
      'Ming O\'rik'
    ]
  },
  {
    id: 'halqa',
    name: "🟡 Yerusti Halqa yo'li (30-yillik)",
    color: '#eab308',
    stations: [
      'Texnopark (Do\'stlik-2)',
      'Yashnobod (2-bekat)',
      'Tuzel (3-bekat)',
      'Olmos (4-bekat)',
      'Rohat (5-bekat)',
      'Yangiobod (6-bekat)',
      'Qo\'yliq (7-bekat)',
      'Matonat (8-bekat)',
      'Qiyot (9-bekat)',
      'Qipchoq (10-bekat)'
    ]
  }
];

export const ALL_TASHKENT_METROS = Array.from(
  new Set(TASHKENT_METRO_LINES.flatMap((l) => l.stations))
).sort();
