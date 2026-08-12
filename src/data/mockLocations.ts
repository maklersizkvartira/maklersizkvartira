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
    id: 'karakalpakstan',
    name: 'Qoraqalpogʻiston Respublikasi',
    districts: ['Nukus sh.', 'Qo\'ng\'irot', 'To\'rtko\'l', 'Beruniy', 'Amudaryo', 'Chimboy', 'Xo\'jayli', 'Mo\'ynoq', 'Taxtako\'pir', 'Ellikqal\'a']
  }
];
