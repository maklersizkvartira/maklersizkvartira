/**
 * Per-place editorial context for the English pack — one profile per region
 * and per Tashkent district.
 *
 * The English text is written, not translated. An expat or a relocating
 * professional reading these pages needs different anchors from a local
 * reader: which university the district is known for, which line the metro
 * station sits on, what the winter heating question is. So each `about`
 * below has to pass the same test the Uzbek file sets — cover the heading,
 * read the paragraph, and you should still be able to name the place.
 *
 * No numbers are invented anywhere here. Geography, campuses, bazaars and
 * metro lines survive a redeploy; a hard-coded rent would be wrong within the
 * month, so the live listings carry the prices instead.
 *
 * Place names keep their Latin-script Uzbek spelling, because that is what a
 * newcomer sees on a map and on a bus stop. Where an English exonym is far
 * better known, it is mentioned once inside the prose rather than replacing
 * the name a taxi driver would recognise.
 */

import type { PlaceProfile } from './types';

export const EN_REGION_PROFILES: Record<string, PlaceProfile> = {
  toshkent: {
    about:
      'Tashkent is the largest rental market in the country: twelve districts, three '
      + 'underground metro lines and a daily inflow of people who work in the capital but grew '
      + 'up elsewhere. The housing stock covers the whole range — Soviet-era panel blocks in '
      + 'Chilonzor and Uchtepa, new estates rising in Sergeli and Yangihayot, and mixed '
      + 'office-and-residential towers near the centre. Rents drop noticeably the further out '
      + 'you go, which is why most renters here treat the walk to the nearest metro station as '
      + 'more important than the name of the district. Before you commit to a flat, work out '
      + 'which line it sits on and how long the trip to work actually takes in rush hour.',
    highlights: [
      'Three metro lines',
      'Chorsu and Oloy bazaars',
      'National University of Uzbekistan',
      'Central business district',
      'New estates in Sergeli',
      'Tashkent International Airport',
    ],
  },

  'toshkent-viloyati': {
    about:
      'The region wraps around the capital, and demand for rentals largely follows that '
      + 'proximity: in Qibray, Zangiota and Yangiyoʻl the tenants are people who commute into '
      + 'Tashkent every morning, while in Olmaliq, Chirchiq and Angren they work at the mining, '
      + 'metallurgy and chemical plants. The housing splits along the same line — four- and '
      + 'five-storey blocks in the industrial towns, wide-courtyard houses in the district '
      + 'centres. Boʻstonliq is a different world again: around Chorvoq reservoir and the '
      + 'Chimyon slopes, renting tends to be seasonal or by the night. If you plan to commute '
      + 'into the capital, check how far the listing really is from the suburban train or the '
      + 'shared-taxi stand before you agree to anything.',
    highlights: [
      'Olmaliq mining and metallurgy plant',
      'Chirchiq industrial zone',
      'Chorvoq reservoir',
      'Chimyon mountain resort',
      'Suburban trains into Tashkent',
      'Orchards of Parkent and Boʻstonliq',
    ],
  },

  samarqand: {
    about:
      'Two things drive the rental market in Samarqand: students and tourism. When the academic '
      + 'year opens at the state university, the institute of foreign languages and the medical '
      + 'institute, one- and two-room flats around the campuses go fast. In high season, houses '
      + 'near Registon and Gur-e Amir turn into short-stay alternatives to hotels. The centre is '
      + 'mostly renovated low-rise stock from the last century, while the newer mahallas on the '
      + 'edge of town are dominated by modern apartment blocks. Kattaqoʻrgʻon and Urgut are '
      + 'markedly cheaper, but price in the daily commute before you decide.',
    highlights: [
      'Registon ensemble',
      'Samarqand State University campus',
      'Gur-e Amir mausoleum',
      'Urgut bazaar',
      'Tourist quarter of the old city',
      'Samarqand International Airport',
    ],
  },

  fargona: {
    about:
      'The Fargʻona Valley is the most densely populated part of Uzbekistan, and that shows up '
      + 'directly in the rental market: empty homes are scarce and a good listing closes '
      + 'quickly. In Fargʻona city, demand clusters around the state university and the oil '
      + 'refinery; in Margʻilon it comes from families tied to the silk workshops that still '
      + 'weave atlas and adras; in Qoʻqon it comes from traders. Much of the stock is '
      + 'courtyard houses and low-rise blocks, so a place with its own separate entrance is '
      + 'ordinary here rather than a luxury. The towns sit close together, and living in '
      + 'Quvasoy or Margʻilon while working in Fargʻona works out cheaper for many families.',
    highlights: [
      'Fargʻona State University',
      'Margʻilon silk workshops',
      'Yodgorlik silk factory',
      'Khudoyar Khan palace in Qoʻqon',
      'Fargʻona oil refinery',
      'Quvasoy industrial plants',
    ],
  },

  andijon: {
    about:
      'The clearest source of rental demand in Andijon is the UzAuto Motors plant in Asaka and '
      + 'the suppliers around it: shift workers usually want something close to the factory and '
      + 'available at short notice. The other half of the market is students at Andijon State '
      + 'University and the medical institute. Housing means mid-rise blocks in the centre and '
      + 'courtyard houses in the outer mahallas, and most flats are let to families on long '
      + 'terms. Rents in Xonobod and Asaka run below the city centre, but check the bus '
      + 'timetable before you rely on commuting.',
    highlights: [
      'UzAuto Motors plant in Asaka',
      'Andijon State University',
      'Andijon Medical Institute',
      'Bobur park',
      'Andijon central bazaar',
      'Xonobod industrial area',
    ],
  },

  namangan: {
    about:
      'Namangan has one of the youngest populations in the country and the rental market '
      + 'reflects it: students, newly married couples and people commuting in from nearby '
      + 'districts are the bulk of the tenants. Around the state university and the engineering '
      + 'and technology institute, one- and two-room flats disappear especially fast at the '
      + 'start of the academic year. The city has a long horticultural tradition, so the outer '
      + 'mahallas are full of houses with generous gardens. Chust, Pop and Kosonsoy are cheaper '
      + 'again, as long as the commute into the centre suits you.',
    highlights: [
      'Namangan State University',
      'Engineering and Technology Institute',
      'Chust knife-making workshops',
      'Namangan flower bazaar',
      'Kosonsoy reservoir',
      'Central bus station',
    ],
  },

  buxoro: {
    about:
      'In Buxoro — Bukhara on most English maps — the rental market clusters around the '
      + 'historic centre: houses near Lyabi Hauz and Poi Kalon often go on nightly or seasonal '
      + 'terms, because for visitors they are the alternative to a hotel. Long-term renters '
      + 'usually look further out, in the newer mahallas and around the state university. Part '
      + 'of the old town is protected low-rise courtyard housing: beautiful, but settle the '
      + 'heating and the state of repair before you sign. Kogon, built around the railway '
      + 'junction, and Gʻijduvon, known for its potters, are both considerably cheaper.',
    highlights: [
      'The Ark and Lyabi Hauz',
      'Bukhara State University',
      'Poi Kalon ensemble',
      'Kogon railway junction',
      'Gʻijduvon pottery workshops',
      'Guest-house quarter of the old town',
    ],
  },

  qashqadaryo: {
    about:
      'Gas shapes the rental market in Qashqadaryo. The fields and processing complexes at '
      + 'Muborak and Shoʻrtan bring in specialists on rotation, and they take monthly flats in '
      + 'Qarshi. The rest of the demand comes from students at Qarshi State University and from '
      + 'regional government staff. Shahrisabz works differently: around the Oqsaroy ruins and '
      + 'the historic centre, short-stay rentals aimed at visitors are far more common. The '
      + 'housing is mostly four- and five-storey blocks plus wide-courtyard houses, and prices '
      + 'fall quickly as you leave the centre.',
    highlights: [
      'Qarshi State University',
      'Shoʻrtan gas chemical complex',
      'Muborak gas processing plant',
      'Oqsaroy in Shahrisabz',
      'Qarshi central bazaar',
      'Regional multi-speciality hospital',
    ],
  },

  surxondaryo: {
    about:
      'Surxondaryo is the southernmost and hottest part of the country, so air conditioning and '
      + 'a shaded courtyard have a real effect on what a place costs. In Termiz, demand gathers '
      + 'around the border trade with Afghanistan, the freight terminals and the state '
      + 'university; logistics staff often want a few months rather than a year. In Denov and '
      + 'Sherobod the stock is almost entirely courtyard houses, many of them attached to lemon '
      + 'groves and greenhouses. Put summer electricity load and the water supply in writing — '
      + 'they are the two bills that surprise newcomers here.',
    highlights: [
      'Termiz State University',
      'Doʻstlik border bridge',
      'Termiz freight terminal',
      'Denov lemon groves',
      'Ruins of ancient Termiz',
      'Termiz International Airport',
    ],
  },

  xorazm: {
    about:
      'Xorazm has two poles. Urganch is the administrative and university town, so long-term '
      + 'flats around the state university and the regional hospitals are the norm there. Xiva '
      + 'is the tourist city, and many of the courtyard houses along the Ichan Qala walls have '
      + 'become guest houses. Traditional single-storey homes built around an inner courtyard '
      + 'make up a large share of the stock; apartment blocks are mainly a central Urganch '
      + 'phenomenon. Winters here are windy and genuinely cold, so ask exactly how the heating '
      + 'works while you are still standing in the flat.',
    highlights: [
      'Ichan Qala museum reserve',
      'Urganch State University',
      'Urganch International Airport',
      'Xiva guest-house quarter',
      'Urganch central bazaar',
      'Regional general hospital',
    ],
  },

  navoiy: {
    about:
      'Navoiy is a young city planned around industry, and its rental market is tied directly '
      + 'to the mining and metallurgy combine and the free economic zone. Engineers arriving on '
      + 'contracts and students at the mining institute take up one- and two-room flats quickly. '
      + 'Because the city was laid out to a plan, the stock is unusually uniform: orderly four- '
      + 'to nine-storey blocks along wide streets, with few courtyard houses. Zarafshon is a '
      + 'separate case — it is a mining town, and it is worth confirming access and residence '
      + 'arrangements through your employer in advance.',
    highlights: [
      'Navoiy mining and metallurgy combine',
      'Navoiy free economic zone',
      'Navoiy international cargo airport',
      'State Mining Institute',
      'Zarafshon mining town',
      'Central boulevard and bazaar',
    ],
  },

  jizzax: {
    about:
      'Jizzax has a compact rental market with two clear streams: students at the polytechnic '
      + 'institute and workers at the industrial zone on the edge of town. Because the city sits '
      + 'on the Tashkent–Samarqand road, short lets of a few months are also normal here. Most '
      + 'of the housing is four- and five-storey blocks in the centre and courtyard houses in '
      + 'the outer mahallas. Out towards Zomin the picture changes completely: the national park '
      + 'and the sanatoriums make renting seasonal, and prices rise in summer and at weekends.',
    highlights: [
      'Jizzax Polytechnic Institute',
      'Zomin National Park',
      'Jizzax industrial zone',
      'Tashkent–Samarqand highway',
      'Gʻallaorol district centre',
      'Regional central hospital',
    ],
  },

  sirdaryo: {
    about:
      'Sirdaryo is one of the smallest regions in the country and its rental market is scaled to '
      + 'match. In Guliston the demand comes from students at the state university and from '
      + 'regional government staff; in Shirin it comes from the thermal power station and the '
      + 'businesses around it. The cotton and grain farms nearby generate a steady stream of '
      + 'seasonal requests for a few months at a time. The stock is mainly low-rise blocks and '
      + 'courtyard houses, and because the rail link to Tashkent is convenient, some tenants '
      + 'here commute to the capital.',
    highlights: [
      'Guliston State University',
      'Sirdaryo thermal power station',
      'Yangiyer industrial plants',
      'Guliston central bazaar',
      'Rail link to Tashkent',
      'Regional medical association',
    ],
  },

  qoraqalpogiston: {
    about:
      'In Qoraqalpogʻiston — Karakalpakstan in English — almost the entire rental market sits in '
      + 'Nukus: the Berdaq Karakalpak State University, the republican hospitals and the '
      + 'government offices are all there. The Savitsky Museum and trips out towards the Aral '
      + 'Sea have created a distinct layer of short-term lets for visitors and researchers. Most '
      + 'homes are Soviet-era low- and mid-rise blocks or houses with large courtyards, and '
      + 'rents in Xoʻjayli and Toʻrtkoʻl are well below Nukus. The climate is dry and windy, so '
      + 'ask specifically about the water supply and the heating when you view a place.',
    highlights: [
      'Karakalpak State University',
      'Savitsky Museum',
      'Nukus International Airport',
      'Republican medical centre',
      'Nukus central bazaar',
      'Xoʻjayli railway station',
    ],
  },
};

export const EN_DISTRICT_PROFILES: Record<string, PlaceProfile> = {
  chilonzor: {
    about:
      'Chilonzor is the most populous district in Tashkent and the place where the city’s mass '
      + 'housing programme began. The backbone of the stock is four- to nine-storey panel blocks '
      + 'from the 1960s and 70s, arranged into numbered kvartals: cheaper than the centre, with '
      + 'green courtyards and playgrounds between the buildings. The oldest metro line runs '
      + 'straight through the district — Chilonzor, Novza and Mirzo Ulugʻbek stations put the '
      + 'centre about twenty minutes away. For students and young families this is often the '
      + 'first flat they rent; in the older buildings, check the plumbing, the wiring and the '
      + 'windows before you agree terms.',
    highlights: [
      'Chilonzor farmers’ market',
      'Chilonzor and Novza stations',
      'National Park',
      'Ippodrom shopping area',
      'Numbered kvartals',
    ],
  },

  yunusobod: {
    about:
      'Yunusobod is the northern and comparatively young part of Tashkent: most of it was built '
      + 'after the 1980s, and business centres and upmarket residential complexes have been '
      + 'added on top in recent years. Embassies, international organisations and large offices '
      + 'are concentrated here, so foreign staff make up a visible share of the rental market and '
      + 'prices run above the city average. The Yunusobod metro line connects the district to the '
      + 'centre and towards Tashkent City through Minor, Bodomzor and Shahriston. In the newer '
      + 'complexes, utilities and the management-company fee may be billed on top of the rent — '
      + 'establish that before you sign.',
    highlights: [
      'Yunusobod metro line',
      'Embassy quarter',
      'Tashkent TV Tower',
      'Minor Mosque',
      'Close to Tashkent City',
      'Olympic tennis courts',
    ],
  },

  mirobod: {
    about:
      'Mirobod is the part of the centre the railway runs through: Tashkent station, the hotels '
      + 'around it and Oloy bazaar are all in this district. The housing is genuinely mixed — '
      + 'mid-century low-rise buildings, later blocks and recent complexes can meet on the same '
      + 'street. Oybek, Kosmonavtlar and Toshkent stations are minutes apart, which makes living '
      + 'here without a car easy and the rent correspondingly high. Traffic and noise around the '
      + 'station are real, so pay attention to which way the windows face when you view.',
    highlights: [
      'Tashkent railway station',
      'Oloy bazaar',
      'Oybek and Kosmonavtlar stations',
      'Close to Sayilgoh street',
      'Central office district',
    ],
  },

  'mirzo-ulugbek': {
    about:
      'Mirzo Ulugʻbek is the academic east of Tashkent: the campus of the National University of '
      + 'Uzbekistan, the institutes of the Academy of Sciences and the residential blocks that '
      + 'grew up around them over decades. That makes students, researchers and lecturers the '
      + 'core of the rental market, and one-room flats and roommate listings close within days in '
      + 'the run-up to September. Most buildings are nine-storey blocks from the 1970s and 80s '
      + 'set in leafy courtyards, and Buyuk Ipak Yoʻli station runs straight into the centre. The '
      + 'streets by the botanical garden and the zoo are quieter, but the walk to the metro is '
      + 'longer.',
    highlights: [
      'National University of Uzbekistan',
      'Academy of Sciences institutes',
      'Buyuk Ipak Yoʻli station',
      'Botanical garden',
      'Tashkent Zoo',
      'Student campus',
    ],
  },

  olmazor: {
    about:
      'Olmazor is the north-west of the city, and for most people its name means two '
      + 'institutions: Tashkent State Technical University — which everyone still calls the '
      + 'Polytechnic — and the Tashkent Medical Academy. Between them they keep demand for cheap '
      + 'one-room flats and roommate shares alive all year. The stock is mostly mid-rise Soviet '
      + 'housing with mature trees in the courtyards, and rents sit well below the centre. The '
      + 'terminus of the oldest metro line is here, so you will usually get a seat on the train, '
      + 'but the ride into the centre takes about half an hour.',
    highlights: [
      'Tashkent State Technical University',
      'Tashkent Medical Academy',
      'Olmazor terminus station',
      'Student halls district',
      'Older blocks with green courtyards',
    ],
  },

  yakkasaroy: {
    about:
      'Yakkasaroy is small in area but one of the closest districts to the centre: you can walk '
      + 'from the Anhor canal to Shota Rustaveli street without much effort. The housing comes in '
      + 'two layers — older low-rise buildings on the quiet streets, and modern complexes along '
      + 'the wider roads. With the Paxtakor stadium, cafés, private clinics and Mustaqillik '
      + 'square close by, finding somewhere to park usually turns out to be a bigger question '
      + 'than the rent itself. Prices match the other central districts, but for most tenants '
      + 'not spending an hour a day commuting justifies the difference.',
    highlights: [
      'Paxtakor central stadium',
      'Close to Mustaqillik square',
      'Anhor canal embankment',
      'Shota Rustaveli street',
      'Walkable central location',
    ],
  },

  sergeli: {
    about:
      'Sergeli has become the fastest-building part of Tashkent: new residential estates have '
      + 'gone up across the south one after another, so this is where you can rent a flat in a '
      + 'new building for less than an old one costs in the centre. The overground metro line '
      + 'runs into the city centre directly through Sergeli and Qipchoq stations. The population '
      + 'skews young and family-heavy; in some estates the kindergartens, schools and shops open '
      + 'a while after the buildings do, so check that first. Before you rent, pin down which '
      + 'estate the flat is in and how many minutes it really is on foot to the station.',
    highlights: [
      'Sergeli and Qipchoq stations',
      'Overground metro line',
      'New residential estates',
      'Young family neighbourhoods',
      'Low rent per room',
    ],
  },

  shayxontohur: {
    about:
      'Shayxontohur is the old city of Tashkent: the blue dome of Chorsu bazaar, the Koʻkaldosh '
      + 'madrasa and the Hazrati Imom complex are all here. The housing is just as distinctive — '
      + 'traditional mahalla houses on narrow lanes stand alongside apartment blocks on Navoiy '
      + 'street. Chorsu and Gʻafur Gʻulom stations put both the centre and the bazaar minutes '
      + 'away, which makes the district particularly convenient for anyone whose work is trade. '
      + 'If you are renting in a mahalla house, make your first question whether the entrance is '
      + 'your own or the courtyard is shared with the owners.',
    highlights: [
      'Chorsu bazaar',
      'Koʻkaldosh madrasa',
      'Hazrati Imom complex',
      'Chorsu and Gʻafur Gʻulom stations',
      'Old city mahallas',
    ],
  },

  yashnobod: {
    about:
      'Yashnobod is the eastern district where industry and housing sit side by side: Tashkent '
      + 'International Airport, the engineering works and the large Qoʻyliq bazaar are all '
      + 'within it. Rents run below the centre, so the district is picked by shift workers, '
      + 'airport and logistics staff and families whose living comes from the bazaar. Most of '
      + 'the housing is Soviet-era blocks built around the factories, with courtyard houses in '
      + 'the outer mahallas. On the streets nearest the airport you will hear the aircraft — '
      + 'find the address on a map before you view.',
    highlights: [
      'Tashkent International Airport',
      'Qoʻyliq bazaar',
      'Mashinasozlar metro station',
      'Doʻstlik metro station',
      'Industrial belt',
    ],
  },

  uchtepa: {
    about:
      'Uchtepa is the west of the city, and most people know it through Farhod bazaar: the '
      + 'trade, workshops and warehouses around the market generate much of the local rental '
      + 'demand. The stock is almost entirely Soviet panel and brick blocks, which puts rents '
      + 'among the lowest in Tashkent. Beruniy and Tinchlik stations link the district to the '
      + 'centre on a single line, and buses and shared taxis run towards Chilonzor. In the older '
      + 'buildings it is standard to ask whether the lift, the pipes and the wiring have been '
      + 'replaced before you sign anything.',
    highlights: [
      'Farhod bazaar',
      'Beruniy metro station',
      'Tinchlik metro station',
      'Soviet-era kvartals',
      'Among the lowest rents in the city',
    ],
  },

  bektemir: {
    about:
      'Bektemir is the smallest district in Tashkent: it sits on the Chirchiq river at the '
      + 'south-eastern edge of the city and was a separate town for much of its history. There '
      + 'are few apartment blocks here — most people live in low-rise houses with gardens, and '
      + 'rents are among the cheapest in the capital. The district borders industrial plants and '
      + 'warehouse land, yet the residential part is one of the quietest corners of the city. '
      + 'Commuting means the ring-line stations and the buses, so measure the door-to-door time '
      + 'to your workplace before you decide.',
    highlights: [
      'Chirchiq riverside',
      'Ring-line metro stations',
      'Low-rise houses with gardens',
      'Industrial and warehouse zone',
      'Cheapest rents in the capital',
    ],
  },

  yangihayot: {
    about:
      'Yangihayot is the newest district in Tashkent — it was separated from Sergeli in 2020 and '
      + 'is growing almost entirely through new construction. As a result, most of what comes up '
      + 'for rent is in complexes handed over only a few years ago: new lifts, new pipes, new '
      + 'windows and courtyards planned with parking in mind. The residents are mainly young '
      + 'families and people who have moved to the capital, and in some kvartals the schools, '
      + 'kindergartens and shops are not fully open yet. The overground metro and the ring-line '
      + 'stations make getting into the centre straightforward, but check in the listing which '
      + 'station the flat is actually near.',
    highlights: [
      'Yangihayot metro station',
      'Recently built complexes',
      'Ring-line stations',
      'Young family district',
      'Modern courtyards and parking',
    ],
  },
};
