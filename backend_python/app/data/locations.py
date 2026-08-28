"""Where Uzbekistan actually is.

Shield AI used to know twelve district names — the ones in Tashkent city — and
nothing else, so "Samarqandda uy kere" parsed as a request with no location at
all. This is the full administrative map: 14 regions, every district, and the
Tashkent metro.

Generated from ``src/data/mockLocations.ts``, which the listing form and the
filters already write onto listings, so the assistant recognises exactly the
places a listing can be filed under.

Do not edit by hand. Regenerate with::

    python -m scripts.sync_locations
"""

from __future__ import annotations


#: Region -> its districts, exactly as they are stored on a listing.
REGIONS: dict[str, tuple[str, ...]] = {
    'Toshkent shahri': (
        'Chilonzor', 'Yunusobod', 'Mirobod', 'Mirzo Ulugʻbek', 'Olmazor',
        'Yakkasaroy', 'Sergeli', 'Shayxontohur', 'Yashnobod', 'Uchtepa',
        'Bektemir', 'Yangihayot',
    ),
    'Toshkent viloyati': (
        'Nurafshon sh.', 'Chirchiq sh.', 'Angren sh.', 'Olmaliq sh.',
        'Bekobod sh.', 'Ohangaron sh.', "Yangiyo'l sh.", 'Bekobod', "Bo'ka",
        "Bo'stonliq", 'Chinoz', 'Ohangaron', "Oqqurg'on", "O'rta Chirchiq",
        'Parkent', 'Pskent', 'Qibray', 'Quyi Chirchiq', 'Toshkent t.', "Yangiyo'l",
        'Yuqori Chirchiq', 'Zangiota',
    ),
    'Samarqand viloyati': (
        'Samarqand sh.', "Kattaqo'rg'on sh.", 'Urgut sh.', "Bulung'ur", 'Ishtixon',
        'Jomboy', "Kattaqo'rg'on t.", 'Narpay', 'Nurobod', 'Oqdaryo',
        "Pastdarg'om", 'Paxtachi', 'Payariq', "Qo'shrabot", 'Samarqand t.',
        'Toyloq', 'Urgut',
    ),
    'Fargʻona viloyati': (
        "Farg'ona sh.", "Qo'qon sh.", "Marg'ilon sh.", 'Quvasoy sh.', "Bag'dod",
        'Beshariq', 'Buvayda', "Dang'ara", "Farg'ona t.", 'Furqat', 'Oltiariq',
        "O'zbekiston", "Qo'shtepa", 'Quva', 'Rishton', "So'x", 'Toshloq',
        "Uchko'prik", 'Yozyovon',
    ),
    'Andijon viloyati': (
        'Andijon sh.', 'Xonobod sh.', 'Asaka sh.', 'Andijon t.', 'Asaka',
        'Baliqchi', "Bo'ston", 'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Marhamat',
        "Oltinko'l", 'Paxtaobod', "Qo'rg'ontepa", 'Shahrixon', "Ulug'nor",
        "Xo'jaobod",
    ),
    'Namangan viloyati': (
        'Namangan sh.', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Namangan t.',
        'Norin', 'Pop', "To'raqo'rg'on", "Uchqo'rg'on", 'Uychi', "Yangiqo'rg'on",
    ),
    'Buxoro viloyati': (
        'Buxoro sh.', 'Kogon sh.', 'Buxoro t.', "G'ijduvon", 'Jondor', 'Kogon t.',
        'Olot', 'Peshku', "Qorako'l", 'Qorovulbozor', 'Romitan', 'Shofirkon',
        'Vobkent',
    ),
    'Qashqadaryo viloyati': (
        'Qarshi sh.', 'Shahrisabz sh.', 'Chiroqchi', 'Dehqonobod', "G'uzor",
        'Kasbi', 'Kitob', 'Koson', "Ko'kdala", 'Mirishkor', 'Muborak', 'Nishon',
        'Qamashi', 'Qarshi t.', 'Shahrisabz t.', "Yakkabog'",
    ),
    'Surxondaryo viloyati': (
        'Termiz sh.', 'Denov sh.', 'Angor', 'Bandixon', 'Boysun', 'Denov',
        "Jarqo'rg'on", 'Muzrabot', 'Oltinsoy', 'Qiziriq', "Qumqo'rg'on",
        'Sariosiyo', 'Sherobod', "Sho'rchi", 'Termiz t.', 'Uzun',
    ),
    'Xorazm viloyati': (
        'Urganch sh.', 'Xiva sh.', "Bog'ot", 'Gurlan', 'Hazorasp', "Qo'shko'pir",
        'Shovot', "Tuproqqal'a", 'Urganch t.', 'Xiva t.', 'Xonqa', 'Yangiariq',
        'Yangibozor',
    ),
    'Navoiy viloyati': (
        'Navoiy sh.', 'Zarafshon sh.', 'Karmana', 'Konimex', 'Navbahor', 'Nurota',
        'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi',
    ),
    'Jizzax viloyati': (
        'Jizzax sh.', 'Arnasoy', 'Baxmal', "Do'stlik", 'Forish', "G'allaorol",
        "Mirzacho'l", 'Paxtakor', 'Sharof Rashidov', 'Yangiobod', 'Zaafarobod',
        'Zarbdor', 'Zomin',
    ),
    'Sirdaryo viloyati': (
        'Guliston sh.', 'Shirin sh.', 'Yangiyer sh.', 'Boyovut', 'Guliston t.',
        'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo t.', 'Xovos',
    ),
    'Qoraqalpogʻiston Respublikasi': (
        'Nukus sh.', 'Amudaryo', 'Beruniy', "Bo'zatov", 'Chimboy', "Ellikqal'a",
        'Kegeyli', "Mo'ynoq", 'Nukus t.', "Qanliko'l", "Qorao'zak", "Qo'ng'irot",
        'Shumanay', 'Taxiatosh', "Taxtako'pir", "To'rtko'l", "Xo'jayli",
    ),
}

#: Tashkent metro stations. People describe where they want to live by
#: the nearest one at least as often as by district ("Bodomzor yaqinida").
METRO_STATIONS: tuple[str, ...] = (
    'Abdulla Qodiriy', 'Alisher Navoiy', 'Amir Temur Xiyoboni', 'Beruniy',
    'Bodomzor', "Buyuk Ipak Yo'li", 'Chilonzor', 'Chorsu', 'Choshtepa',
    "Do'stlik (Chkalov)", "G'afur G'ulom", 'Hamid Olimjon', 'Kosmonavtlar',
    'Mashinasozlar', 'Matonat (8-bekat)', "Milliy Bog'", "Ming O'rik", 'Minor',
    "Mirzo Ulug'bek", 'Mustaqillik Maydoni', 'Novza', "O'tkir", "O'zbekiston",
    'Olmazor', 'Olmos (4-bekat)', 'Oybek', 'Paxtakor', 'Pushkin', 'Qipchoq',
    'Qipchoq (10-bekat)', 'Qiyot (9-bekat)', "Qo'yliq (7-bekat)",
    'Rohat (5-bekat)', 'Sergeli', 'Shahriston', "Texnopark (Do'stlik-2)",
    'Tinchlik', 'Toshkent (Vokzal)', 'Turkiston', 'Tuzel (3-bekat)',
    "Xalqlar Do'stligi", 'Yangiobod (6-bekat)', 'Yashnobod (2-bekat)',
    'Yunus Rajabiy', 'Yunusobod',
)

#: Flat lookup: district -> the region it belongs to.
DISTRICT_TO_REGION: dict[str, str] = {
    district: region
    for region, districts in REGIONS.items()
    for district in districts
}

ALL_DISTRICTS: tuple[str, ...] = tuple(DISTRICT_TO_REGION)
ALL_REGIONS: tuple[str, ...] = tuple(REGIONS)
