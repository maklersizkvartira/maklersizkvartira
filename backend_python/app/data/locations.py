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
        'Chirchiq sh.', 'Angren sh.', 'Olmaliq sh.', "Yangiyo'l sh.", "Bo'stonliq",
        'Zangiota', 'Qibray', 'Parkent', 'Pskent', "Oqqurg'on", 'Bekobod',
        'Chinoz',
    ),
    'Samarqand viloyati': (
        'Samarqand sh.', "Kattaqo'rg'on sh.", 'Urgut', "Pastdarg'om", 'Payariq',
        "Bulung'ur", 'Jomboy', 'Ishtixon', 'Narpay', 'Toyloq', 'Samarqand t.',
    ),
    'Fargʻona viloyati': (
        "Farg'ona sh.", "Qo'qon sh.", "Marg'ilon sh.", 'Quvasoy sh.', 'Rishton',
        'Oltiariq', "Bag'dod", 'Buvayda', "Uchko'prik", 'Yozyovon', 'Beshariq',
    ),
    'Andijon viloyati': (
        'Andijon sh.', 'Xonobod sh.', 'Asaka', 'Shahrixon', 'Baliqchi', "Bo'ston",
        'Izboskan', 'Marhamat', "Oltinko'l", 'Paxtaobod', "Xo'jaobod",
    ),
    'Namangan viloyati': (
        'Namangan sh.', 'Chust', 'Kosonsoy', 'Pop', "To'raqo'rg'on", 'Uychi',
        "Uchqo'rg'on", 'Mingbuloq', 'Norin', "Yangiqo'rg'on",
    ),
    'Buxoro viloyati': (
        'Buxoro sh.', 'Kogon sh.', "G'ijduvon", 'Olot', "Qorako'l", 'Qorovulbozor',
        'Peshku', 'Romitan', 'Shofirkon', 'Vobkent', 'Buxoro t.',
    ),
    'Qashqadaryo viloyati': (
        'Qarshi sh.', 'Shahrisabz sh.', 'Kitob', "Yakkabog'", "G'uzor",
        'Dehqonobod', 'Koson', 'Nishon', 'Chiroqchi', 'Kasbi', 'Mirishkor',
        'Muborak',
    ),
    'Surxondaryo viloyati': (
        'Termiz sh.', 'Denov', 'Sherobod', 'Boysun', "Jarqo'rg'on", "Qumqo'rg'on",
        'Muzrabot', 'Oltinsoy', 'Sariosiyo', "Sho'rchi", 'Termiz t.',
    ),
    'Xorazm viloyati': (
        'Urganch sh.', 'Xiva sh.', 'Xonqa', "Qo'shko'pir", 'Gurlan', 'Yangibozor',
        'Shovot', 'Hazorasp', "Bog'ot",
    ),
    'Navoiy viloyati': (
        'Navoiy sh.', 'Zarafshon sh.', 'Karmana', 'Qiziltepa', 'Xatirchi',
        'Nurota', 'Uchquduq', 'Konimex', 'Tomdi',
    ),
    'Jizzax viloyati': (
        'Jizzax sh.', "Do'stlik", 'Forish', "G'allaorol", 'Sharof Rashidov',
        "Mirzacho'l", 'Paxtakor', 'Zomin', 'Zarbdor', 'Zaafarobod', 'Arnasoy',
    ),
    'Sirdaryo viloyati': (
        'Guliston sh.', 'Shirin sh.', 'Yangiyer sh.', 'Boyovut', 'Sayxunobod',
        'Sardoba', 'Mirzaobod', 'Oqoltin', 'Xovos', 'Sirdaryo t.', 'Guliston t.',
    ),
    'Qoraqalpogʻiston Respublikasi': (
        'Nukus sh.', "Qo'ng'irot", "To'rtko'l", 'Beruniy', 'Amudaryo', 'Chimboy',
        "Xo'jayli", "Mo'ynoq", "Taxtako'pir", "Ellikqal'a",
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
