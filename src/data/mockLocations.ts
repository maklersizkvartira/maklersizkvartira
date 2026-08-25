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
    districts: ['Chirchiq sh.', 'Angren sh.', 'Olmaliq sh.', 'Yangiyo\'l sh.', 'Bo\'stonliq', 'Zangiota', 'Qibray', 'Parkent', 'Pskent', 'Oqqurg\'on', 'Bekobod', 'Chinoz']
  },
  {
    id: 'samarkand',
    name: 'Samarqand viloyati',
    districts: ['Samarqand sh.', 'Kattaqo\'rg\'on sh.', 'Urgut', 'Pastdarg\'om', 'Payariq', 'Bulung\'ur', 'Jomboy', 'Ishtixon', 'Narpay', 'Toyloq', 'Samarqand t.']
  },
  {
    id: 'fergana',
    name: 'Fargʻona viloyati',
    districts: ['Farg\'ona sh.', 'Qo\'qon sh.', 'Marg\'ilon sh.', 'Quvasoy sh.', 'Rishton', 'Oltiariq', 'Bag\'dod', 'Buvayda', 'Uchko\'prik', 'Yozyovon', 'Beshariq']
  },
  {
    id: 'andijan',
    name: 'Andijon viloyati',
    districts: ['Andijon sh.', 'Xonobod sh.', 'Asaka', 'Shahrixon', 'Baliqchi', 'Bo\'ston', 'Izboskan', 'Marhamat', 'Oltinko\'l', 'Paxtaobod', 'Xo\'jaobod']
  },
  {
    id: 'namangan',
    name: 'Namangan viloyati',
    districts: ['Namangan sh.', 'Chust', 'Kosonsoy', 'Pop', 'To\'raqo\'rg\'on', 'Uychi', 'Uchqo\'rg\'on', 'Mingbuloq', 'Norin', 'Yangiqo\'rg\'on']
  },
  {
    id: 'bukhara',
    name: 'Buxoro viloyati',
    districts: ['Buxoro sh.', 'Kogon sh.', 'G\'ijduvon', 'Olot', 'Qorako\'l', 'Qorovulbozor', 'Peshku', 'Romitan', 'Shofirkon', 'Vobkent', 'Buxoro t.']
  },
  {
    id: 'qashqadaryo',
    name: 'Qashqadaryo viloyati',
    districts: ['Qarshi sh.', 'Shahrisabz sh.', 'Kitob', 'Yakkabog\'', 'G\'uzor', 'Dehqonobod', 'Koson', 'Nishon', 'Chiroqchi', 'Kasbi', 'Mirishkor', 'Muborak']
  },
  {
    id: 'surxondaryo',
    name: 'Surxondaryo viloyati',
    districts: ['Termiz sh.', 'Denov', 'Sherobod', 'Boysun', 'Jarqo\'rg\'on', 'Qumqo\'rg\'on', 'Muzrabot', 'Oltinsoy', 'Sariosiyo', 'Sho\'rchi', 'Termiz t.']
  },
  {
    id: 'khorezm',
    name: 'Xorazm viloyati',
    districts: ['Urganch sh.', 'Xiva sh.', 'Xonqa', 'Qo\'shko\'pir', 'Gurlan', 'Yangibozor', 'Shovot', 'Hazorasp', 'Bog\'ot']
  },
  {
    id: 'navoiy',
    name: 'Navoiy viloyati',
    districts: ['Navoiy sh.', 'Zarafshon sh.', 'Karmana', 'Qiziltepa', 'Xatirchi', 'Nurota', 'Uchquduq', 'Konimex', 'Tomdi']
  },
  {
    id: 'jizzakh',
    name: 'Jizzax viloyati',
    districts: ['Jizzax sh.', 'Do\'stlik', 'Forish', 'G\'allaorol', 'Sharof Rashidov', 'Mirzacho\'l', 'Paxtakor', 'Zomin', 'Zarbdor', 'Zaafarobod', 'Arnasoy']
  },
  {
    id: 'sirdaryo',
    name: 'Sirdaryo viloyati',
    districts: ['Guliston sh.', 'Shirin sh.', 'Yangiyer sh.', 'Boyovut', 'Sayxunobod', 'Sardoba', 'Mirzaobod', 'Oqoltin', 'Xovos', 'Sirdaryo t.', 'Guliston t.']
  },
  {
    id: 'karakalpakstan',
    name: 'Qoraqalpogʻiston Respublikasi',
    districts: ['Nukus sh.', 'Qo\'ng\'irot', 'To\'rtko\'l', 'Beruniy', 'Amudaryo', 'Chimboy', 'Xo\'jayli', 'Mo\'ynoq', 'Taxtako\'pir', 'Ellikqal\'a']
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
