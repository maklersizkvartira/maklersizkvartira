/**
 * English long-form editorial: the six guides and the four help pages.
 *
 * These are the only written pages on the site. Everything else — district
 * landings, category pages, listing metadata — is assembled from the taxonomy
 * by `copy.en.ts`, so the templates there have to stay generic. This file is
 * where the site is allowed to be specific: what an Uzbek lease actually says
 * about the deposit, which scam is running this season, what a student should
 * settle with a flatmate before signing.
 *
 * The slugs, dates and section structure are shared with the Uzbek pack so the
 * three languages stay one site rather than three. The prose is not: it is
 * written for someone reading in English, which usually means someone new to
 * the country, so it explains the local practice instead of assuming it.
 *
 * Two constraints govern the text and are worth stating so the next editor
 * keeps them:
 *
 *  - No invented figures. Not one price, not one listing count, not one
 *    "87% of tenants". Rents move faster than a static file is redeployed, so
 *    the pricing guide describes the forces that set a price and lets the live
 *    listings show the number.
 *  - The product is rental only. Nothing here discusses buying or selling
 *    property, and the guides should never drift there.
 *
 * The two legal pages (`foydalanish-shartlari`, `maxfiylik-siyosati`) are a
 * plain-language summary written for a reader, not a contract drafted by a
 * lawyer, and each says so in its own text. They deliberately name no company
 * registration number, address or licence.
 */

import type { Article, HelpArticle } from './types';

export const EN_ARTICLES: Article[] = [
  {
    slug: 'maklersiz-uy-topish',
    title: 'How to rent from the owner, with no agent involved',
    summary:
      'How to reach the actual owner of a flat, and how to tell in the first phone call that '
      + 'the person you are speaking to is an agent.',
    publishedAt: '2025-11-18',
    updatedAt: '2026-06-12',
    readingMinutes: 6,
    h1: 'Renting without an agent, and spotting one on the first call',
    intro:
      'In Tashkent and in every regional city, the search usually starts the same way: you open '
      + 'a list of adverts, scroll through dozens of flats, call one of them — and the person on '
      + 'the other end is not the owner but a middleman. He takes you to the flat, shows you the '
      + 'keys, and then asks for a fee that often equals a month’s rent. That money pays for no '
      + 'repairs and no paperwork; it is charged purely for knowing a phone number. Reaching the '
      + 'owner directly is entirely possible: it takes starting the search in the right place and '
      + 'knowing a handful of simple signals. Below are those signals, and the practical order of '
      + 'events from the first viewing to the handshake.',
    sections: [
      {
        heading: 'Set three limits before you start looking',
        paragraphs: [
          'Most of the time lost in a flat search is lost to a vague brief: "somewhere cheaper '
            + 'and nicer". You view fifteen places, none of them feels right, and by the end you '
            + 'are tired enough to accept the first thing that comes along — which is exactly the '
            + 'flat people move out of a few months later. So write down three limits before you '
            + 'open a single listing.',
          'The first is money, and it is not just the monthly rent. The month you move in almost '
            + 'always costs double, because a deposit is normally paid on top of the first '
            + 'month. The second is geography, measured in travel time rather than district '
            + 'names: how long it takes you door to door matters more than a neighbourhood’s '
            + 'reputation. The third is the term. Six months and a year rarely carry the same '
            + 'price, and owners are noticeably more willing to negotiate for a longer '
            + 'commitment.',
        ],
        bullets: [
          'Total cash needed to move: rent, deposit and the first month of utilities.',
          'Door-to-door minutes to work or campus, on foot and by transport.',
          'How many months you need, and whether the price is fixed for that term.',
          'Whether the place has to be furnished, or you are bringing your own furniture.',
          'Children, pets or a flatmate — say so on the first call, not at the viewing.',
        ],
      },
      {
        heading: 'How to tell who actually posted the listing',
        paragraphs: [
          'An agent’s advert usually gives itself away; you only need to know where to look. An '
            + 'owner photographs their own flat once, thoroughly: the rooms, the kitchen, the '
            + 'bathroom, the entrance, the view from the window. An agent’s photos tend to show '
            + 'the two best corners and nothing else — no stairwell, no courtyard — because the '
            + 'point is not to show you the flat, it is to make you call.',
          'The writing tells you as much as the pictures. An owner writes "my flat is free from '
            + 'the first, long term preferred". An agent writes "we have many options in our '
            + 'database", "tell us the area and we will pick something for you". A missing '
            + 'address, or even a missing landmark, is another reliable sign: an owner has no '
            + 'reason to hide which street the flat is on.',
          'Checking by phone is easier still. Ask the things only an owner would know: whose name '
            + 'is on the ownership document, whether the meters are installed, who the '
            + 'neighbours are, when the flat was last redecorated. An agent answers in '
            + 'generalities or says "you will see when you get there". An owner answers without '
            + 'hesitating, because it is their flat.',
        ],
        bullets: [
          'One phone number appears on dozens of adverts across unrelated districts.',
          'The photos are attractive but there is no wide shot, no stairwell, no courtyard.',
          'The text talks about a "database", "options", "we will select something for you".',
          'No address is given, and the landmark is left as "we will tell you later".',
          'The price is far below similar flats nearby — usually bait rather than a bargain.',
        ],
      },
      {
        heading: 'What to ask on the first call',
        paragraphs: [
          'The first conversation should not take more than five minutes, but those five minutes '
            + 'save you half the wasted journeys. Go through the questions calmly, one after '
            + 'another — this is not being difficult, it is ordinary practice, and a reasonable '
            + 'owner expects it.',
          'Pay particular attention to what the price includes. "Utilities separate" can mean '
            + 'very different things: in some buildings only water and gas, in others the '
            + 'building-management fee, the internet and winter heating as well. Settle that on '
            + 'the phone and the end of the month holds no surprises.',
        ],
        bullets: [
          'Whose name is on the ownership document, and who will sign the contract?',
          'What is included: water, gas, electricity, heating, management fee, internet?',
          'How much is the deposit, and in what circumstances is it returned in full?',
          'How long is the term, and can the rent rise inside it?',
          'Who is living there now, and from what date is it free?',
        ],
      },
      {
        heading: 'What to look at during the viewing',
        paragraphs: [
          'View the flat twice if you can, once in daylight and once in the evening. Daylight '
            + 'tells you about the light, the damp and the view; the evening tells you whether '
            + 'the stairwell is lit, who gathers in the courtyard and how much you hear through '
            + 'the walls. On upper floors, test the water pressure yourself: open the tap and '
            + 'count how long the hot water takes to arrive.',
          'Heating deserves its own question in Uzbekistan. Whether the building is on central '
            + 'heating, has a gas boiler, or relies on electric heaters changes the winter bills '
            + 'completely. Electrical capacity matters for the same reason: in older buildings, '
            + 'running an air conditioner, a washing machine and a heater at once will trip the '
            + 'breaker.',
        ],
        bullets: [
          'Water pressure and hot water — open the tap yourself rather than taking their word.',
          'The type of heating, and what the bills looked like last winter.',
          'Windows, the door lock, damp patches in the bathroom, stains on the ceiling.',
          'Mobile signal and internet — check on your own phone while you are standing there.',
          'The stairwell, the lift, the courtyard, parking, and a word with a neighbour.',
        ],
      },
      {
        heading: 'Money changes hands only after the contract',
        paragraphs: [
          'There is no exception to this rule. Until you have seen the flat with your own eyes, '
            + 'seen the ownership document and signed a written contract, you send nobody any '
            + 'money — not to "hold it for you", not to "keep the keys aside". A request for '
            + 'payment up front is the opening move of the most common fraud there is.',
          'When you do pay, take a receipt, or at minimum have the words "received" and a '
            + 'signature written on the contract itself. The deposit belongs in its own clause: '
            + 'how much it is, what it can be withheld for, and how many days after you leave it '
            + 'comes back. Writing that takes a minute and removes most of the arguments that '
            + 'happen at move-out.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is it realistic to rent without an agent at all?',
        a:
          'Yes, because most owners would rather let the place themselves — they do not want to '
          + 'give away a percentage either. What matters is searching where owners post their '
          + 'own adverts, and asking in the first conversation whose name is on the ownership '
          + 'document.',
      },
      {
        q: 'What if the agent introduces himself as the owner?',
        a:
          'It comes out when the contract is signed: the document is in someone else’s name and '
          + 'you are told "the owner will come later". Stop there. Never hand over money for a '
          + 'deal the owner is not part of and for which no power of attorney is shown.',
      },
      {
        q: 'The owner is asking for a deposit — is that normal?',
        a:
          'Yes. A deposit is standard practice in Uzbekistan and it is not an agent’s fee: it is '
          + 'security against damage and it comes back if nothing is damaged. The only condition '
          + 'is that the amount and the terms of its return are written into the contract.',
      },
    ],
  },

  {
    slug: 'ijara-shartnomasi-tekshirish',
    title: 'The rental contract: what to check before you sign',
    summary:
      'Which clauses a rental contract must contain, how the deposit should be written, and '
      + 'what to document before you move out.',
    publishedAt: '2025-12-04',
    updatedAt: '2026-07-21',
    readingMinutes: 7,
    h1: 'What to check before you sign a rental contract',
    intro:
      'In Uzbekistan, renting often begins with a verbal agreement: "you seem decent, I trust '
      + 'you", and the money changes hands. The problem is that trust only works while both '
      + 'sides remember the same thing. Six months later the owner says heating was on your '
      + 'account, you say it was included in the rent — and both of you sincerely believe you '
      + 'are right. A written contract is not there to guard against dishonesty; it is there to '
      + 'remove that gap in memory. Below is what an ordinary rental contract should contain, '
      + 'how to write the deposit clause, and how to close down the move-out arguments before '
      + 'they start.',
    sections: [
      {
        heading: 'Why it has to be in writing',
        paragraphs: [
          'A written contract protects both sides, and sometimes it protects the owner more than '
            + 'the tenant: if something is damaged or the rent is late, a verbal agreement leaves '
            + 'nothing to point at. So an owner who offers you a contract is not being '
            + 'suspicious — they are being serious.',
          'Print two copies, have both signed by both parties, and each of you keeps one. '
            + 'Initialling the bottom of every page is a useful habit too: it removes any later '
            + 'argument about a page being swapped. Photograph the signed contract on your '
            + 'phone — paper gets lost, photographs do not.',
        ],
      },
      {
        heading: 'The clauses that must be there',
        paragraphs: [
          'A good rental contract does not need to be long. Two pages is plenty, as long as each '
            + 'of the questions below has a clear one-sentence answer. If a clause is missing, '
            + 'you can write it in by hand and have both parties sign in the margin — that is a '
            + 'perfectly valid practice.',
          'Give particular attention to whether the price is fixed. A vague line like "the rent '
            + 'may change in line with the market" gives the owner the right to raise it in any '
            + 'month they like. Replace it with a term and a firm condition: the rent does not '
            + 'change for the duration of the contract.',
        ],
        bullets: [
          'The parties: full names, passport details and contact numbers.',
          'The exact address of the property, the number of rooms and the floor area.',
          'The monthly rent, the date it is due and how it is paid.',
          'How long the rent is fixed for.',
          'Who pays which utilities — each one listed separately.',
          'The deposit: the amount, the grounds for withholding it, the deadline for return.',
          'The term of the contract and how it is extended.',
          'How many days’ notice either side must give before ending it.',
          'Who lives in the flat: family members, a flatmate, pets.',
          'Who repairs what when something breaks.',
        ],
      },
      {
        heading: 'The deposit: the clause that causes the most arguments',
        paragraphs: [
          'A deposit is the owner’s security against future damage, not rent paid in advance. '
            + 'The distinction matters: plenty of tenants live the last month "out of the '
            + 'deposit" and end up in a row about it. Write it down explicitly — either the '
            + 'deposit counts as the final month’s rent, or it is returned separately.',
          'The second thing to pin down is what it can be withheld for. A general phrase like '
            + '"in the event of damage" is not enough, because an owner may count an old mark on '
            + 'the wall as damage. Stating that fair wear and tear — the kitchen wall dulling '
            + 'over time, for instance — is not damage closes off half the dispute in advance.',
          'The third is timing. "Returned after you move out" can stretch into months. Put a '
            + 'number on it: how many days after the keys are handed back, and by what method.',
        ],
      },
      {
        heading: 'Utilities and meter readings',
        paragraphs: [
          'On the day you move in, write down the water, gas and electricity meter readings and '
            + 'photograph each meter. It takes a minute and it stops the previous tenant’s '
            + 'arrears from becoming yours. Attaching the readings to the contract is the safest '
            + 'version of the same thing.',
          'Apartment buildings usually carry a management or owners’ association fee, and in '
            + 'houses the rubbish collection and water may be billed separately. Name each one in '
            + 'the contract: a single line saying "utilities are the tenant’s responsibility" '
            + 'turns into unexpected bills later.',
        ],
      },
      {
        heading: 'The inventory, and moving out',
        paragraphs: [
          'If the flat is furnished, make an inventory: fridge, washing machine, air '
            + 'conditioner, gas hob, furniture — with a few words on the condition of each. Have '
            + 'both parties sign it, and photograph every room on the day you move in. When you '
            + 'leave, those photographs are the strongest evidence you have.',
          'Agree the exit procedure in advance too: how much notice you give, what state the '
            + 'flat is handed back in, and who receives the keys. A month’s notice is generally '
            + 'considered enough, but only if the contract says so. On the day you hand back the '
            + 'keys, record the final meter readings again and get a short receipt confirming '
            + 'the deposit was returned.',
        ],
        bullets: [
          'On move-in: photographs of every room and the readings from all three meters.',
          'An appliance list — model, condition, confirmed working.',
          'The notice period required before moving out.',
          'A receipt or written confirmation when the deposit comes back.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does the contract have to be notarised?',
        a:
          'For an ordinary long-term let, most people use a simple written contract. Notarisation '
          + 'adds weight and is worth considering for large sums or long terms. For your own '
          + 'situation, ask a qualified lawyer.',
      },
      {
        q: 'What if the owner does not want a contract?',
        a:
          'Ask why. Sometimes it is only habit, and a one-page agreement settles it. If you are '
          + 'refused outright, treat that as a serious warning sign — do not leave a deposit on '
          + 'a flat like that.',
      },
      {
        q: 'If I leave before the term ends, do I lose the deposit?',
        a:
          'That depends on what the contract says, which is why you read the early-termination '
          + 'clause before signing. Many contracts provide that the deposit is returned in full '
          + 'if you give a month’s notice.',
      },
    ],
  },

  {
    slug: 'toshkent-ijara-narxlari',
    title: 'What sets the rent in Tashkent',
    summary:
      'How district, distance to the metro, floor, furnishing, building type and season move '
      + 'the rent — explained by the factors, without invented figures.',
    publishedAt: '2026-01-27',
    updatedAt: '2026-07-03',
    readingMinutes: 6,
    h1: 'What sets the rent in Tashkent',
    intro:
      'There is not a single price figure in this article, and that is deliberate. Rents in '
      + 'Tashkent shift with the season, the district and even which side of the street a '
      + 'building stands on; any number written down here would be wrong within a month. What is '
      + 'genuinely useful is knowing what pushes a price up and what pulls it down. Then, when '
      + 'you look at a list of adverts, you are working from reasons rather than a feeling that '
      + 'something is "expensive" — and when you talk to the owner you understand why the figure '
      + 'is what it is. Below are the six factors that actually operate in this market.',
    sections: [
      {
        heading: 'District and distance from the centre',
        paragraphs: [
          'Tashkent is not one uniform market. The parts of Mirobod, Yakkasaroy and Shayxontohur '
            + 'that adjoin the centre have always been the most expensive, because the offices, '
            + 'institutions and services are concentrated there. Chilonzor, Yunusobod and Mirzo '
            + 'Ulugʻbek form the middle band, while the outer mahallas of Sergeli, Bektemir and '
            + 'Yashnobod are usually cheaper.',
          'But the district name on its own means very little. Two flats at opposite ends of the '
            + 'same district can differ sharply, because what really counts is the landmark. A '
            + 'flat near a big bazaar, an international school or a major business centre costs '
            + 'more than an identical one on the edge of the same district.',
          'So it is better to start the search from the place you go to every day rather than '
            + 'from a district, and widen outwards from there. Very often a flat one station '
            + 'further out is noticeably cheaper while the journey barely changes.',
        ],
      },
      {
        heading: 'The metro and real travel time',
        paragraphs: [
          'Proximity to the metro is one of the steadiest price factors in Tashkent. A flat ten '
            + 'minutes’ walk from a station always costs more than one twenty minutes away, even '
            + 'when both are on the same street. Because the city is covered by three '
            + 'underground lines and the overground ring line, the station name in an advert is '
            + 'often a more precise landmark than the district.',
          'That makes places far from the metro but close to a main bus route an interesting '
            + 'niche: the rent is lower than around the stations, while the actual journey is '
            + 'sometimes no worse. Do not rely on a "near the metro" filter alone — measure the '
            + 'real trip once, in rush hour, yourself.',
        ],
        bullets: [
          'Walking time to the station — if the advert states it, take it into account.',
          'Which line: a straight run into the centre, or a change on the way.',
          'The real journey time at peak hour, not the ideal one on the map.',
          'Whether there is a bazaar, a clinic and a school nearby.',
        ],
      },
      {
        heading: 'Building type: Soviet stock and new construction',
        paragraphs: [
          'Tashkent’s housing falls into two broad layers. The first is the Soviet-era panel and '
            + 'brick blocks: lower ceilings, compact rooms, but often an excellent location, '
            + 'because those neighbourhoods grew up around the metro and the infrastructure. The '
            + 'second is the recent complexes: lifts, gated courtyards, parking and modern '
            + 'layouts.',
          'New buildings usually cost more, though the gap is not always a gap in comfort. A new '
            + 'complex may carry a higher management fee, and the infrastructure around it may '
            + 'not be finished yet. A well-renovated flat in the older stock often gives better '
            + 'value for the money and the time.',
          'Brick buildings hold heat better than panel ones, and you feel that in the winter '
            + 'bills. If the advert does not say which the building is, ask when you go to view.',
        ],
      },
      {
        heading: 'Floor, condition and furnishing',
        paragraphs: [
          'The ground floor and the top floor are almost always cheaper. The ground floor brings '
            + 'noise, damp and security questions; the top floor brings the roof and the summer '
            + 'heat. Middle floors are the most sought after, especially in buildings with a '
            + 'lift. The fourth and fifth floors of a walk-up, by contrast, pull the price down '
            + 'noticeably.',
          'Condition and furnishing are the biggest upward force on price. A fully furnished flat '
            + 'with appliances costs considerably more than an empty one, because the tenant can '
            + 'live there from the day they arrive. If you already own furniture, looking for an '
            + 'unfurnished place is logically cheaper — there are simply fewer of them.',
        ],
        bullets: [
          'The floor, and whether the building has a lift.',
          'Condition: recently renovated, average, or tired.',
          'Appliances: fridge, washing machine, air conditioner, hob.',
          'Type of heating — central, gas boiler or electric.',
          'A separate bathroom and toilet, a balcony, a storage room.',
        ],
      },
      {
        heading: 'Season and the terms of the deal',
        paragraphs: [
          'The Tashkent rental market has a distinct season. Late August and September are the '
            + 'busiest weeks of the year: the academic year begins, students and families from '
            + 'the regions look at the same time, choice narrows and owners do not move on price. '
            + 'Midwinter is the opposite: fewer adverts, but every owner has been waiting longer '
            + 'and there is more room to negotiate.',
          'The terms themselves also move the number. A long commitment, a record of paying on '
            + 'time and an offer to pay several months up front often bring the rent down. Pets, '
            + 'a large household or a short term push it up. All of it is open to discussion — '
            + 'the figure in the advert is where the conversation starts, not where it ends.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why are there no actual prices on this page?',
        a:
          'Because they change quickly and any figure written here would soon be wrong. To see '
          + 'what people are really asking today, open the listings and sort by price — that is '
          + 'more accurate than any average.',
      },
      {
        q: 'Is it acceptable to negotiate the rent down?',
        a:
          'Yes, particularly if you are committing for a long term or the advert has been up for '
          + 'a while. Open the conversation politely and with a concrete offer: a year-long term, '
          + 'say, or a payment date that suits the owner.',
      },
      {
        q: 'When is the best time to look?',
        a:
          'Outside the August–September rush if you can manage it. In the winter months there is '
          + 'less choice, but also less competition, and terms are easier to agree.',
      },
    ],
  },

  {
    slug: 'ijarada-firibgarlikdan-saqlanish',
    title: 'Rental scams and how to avoid them',
    summary:
      'The main rental fraud schemes seen in Uzbekistan, and the practical way to recognise '
      + 'each one before you lose anything.',
    publishedAt: '2026-02-19',
    updatedAt: '2026-08-01',
    readingMinutes: 7,
    h1: 'How rental fraud works, and how to stay out of it',
    intro:
      'Almost every rental scam depends on one thing: haste. Someone is worn out from searching, '
      + 'sees a cheap advert, feels the fear that somebody else will take it — and in that exact '
      + 'moment transfers money in advance. The schemes change, the channels change, but the '
      + 'mechanism has not moved in a decade. Below are the five schemes most often seen in '
      + 'Uzbekistan and the signal that gives each one away. None of them is sophisticated: keep '
      + 'the single rule of never paying before you have seen the flat and checked the '
      + 'ownership document, and most of them cannot touch you.',
    sections: [
      {
        heading: 'Payment up front, before you have seen anything',
        paragraphs: [
          'The most widespread scheme. The advert is attractive, the price is below the market, '
            + 'the photos are good. The person tells you they are "out of town at the moment" or '
            + '"abroad" and asks for a small sum to hold the flat. Once it is sent, the number '
            + 'goes dead.',
          'The power of this one is psychological: the sum is deliberately small, because people '
            + 'think hard about large amounts and wave through small ones as "hardly a risk". The '
            + 'fraudster collects that small amount from hundreds of people.',
          'The rule is simple: no payment until you have seen the flat with your own eyes and met '
            + 'the owner face to face. "Reserving it", "holding the keys", "confirming the '
            + 'agreement" are all the same request wearing different clothes.',
        ],
      },
      {
        heading: 'Photographs of somebody else’s flat',
        paragraphs: [
          'The second scheme uses pictures lifted from the internet or from another advert. The '
            + 'flat looks lovely and either does not exist or is in a different city entirely. '
            + 'Sometimes the photos are of a real flat — just not one the advertiser has any '
            + 'right to let.',
          'Checking is easy. Look at whether the furniture, the direction of the windows and the '
            + 'light are consistent, and whether the rooms plausibly belong to one flat. Pictures '
            + 'as clean as a magazine cover, with no trace of anyone living there and not one '
            + 'personal object in sight, deserve suspicion. The most reliable test is video: ask '
            + 'the owner for a live video call and a walk through the flat in real time. A '
            + 'fraudster almost never can.',
        ],
        bullets: [
          'The photos look staged, with no sign that anyone lives there.',
          'No stairwell, no courtyard, no view from the window.',
          'A live video call is refused, or an excuse appears.',
          'The same photos turn up on another advert with a different address.',
        ],
      },
      {
        heading: '"Agency services" and selling you a list',
        paragraphs: [
          'Here the money is asked for the list, not the flat: "pay the fee and we will give you '
            + 'the owners’ numbers from our database". Once you pay you receive numbers that are '
            + 'out of date or have been sold to everyone else as well. You call — the flats are '
            + 'long gone, and the money does not come back.',
          'Sometimes it is dressed up as a "contract processing charge", a "site service fee" or '
            + 'a "listing access fee". None of these is normal practice. Searching for a place to '
            + 'rent is free for the tenant: money goes to the owner, after you have seen the '
            + 'flat, and on the basis of a contract.',
        ],
      },
      {
        heading: 'A deposit handed over for the keys',
        paragraphs: [
          'This one is subtler, because the person really does meet you. They take you to the '
            + 'flat, show you round, even put the keys in your hand — and ask for the deposit on '
            + 'the spot. But no contract is signed, no ownership document is produced and no '
            + 'receipt is given. When you come back the next day the lock may have been changed, '
            + 'or somebody else may be living there.',
          'There is one defence: money only after a signed contract and a sight of the ownership '
            + 'document. Check whose name is on it and compare it with the passport. If a '
            + 'relative is letting the flat rather than the owner, ask for the power of attorney. '
            + 'This is not rudeness — it is routine, and an honest owner is not offended by it.',
        ],
      },
      {
        heading: 'Subletting a flat the "owner" only rents',
        paragraphs: [
          'In the sublet scheme, someone genuinely rents a flat for a short period, then presents '
            + 'themselves as the owner and lets it to several people at once. They take a deposit '
            + 'and a month’s rent from each and disappear. The people who paid are left facing '
            + 'the actual owner.',
          'This is exactly why the document check matters. The name given as the owner in the '
            + 'contract has to match the name on the ownership document. If it does not, that '
            + 'person’s right to sublet has to be confirmed in writing. A one-minute check makes '
            + 'the entire scheme unworkable.',
        ],
        bullets: [
          'The name on the document and the name on the contract are the same.',
          'A passport is shown and it matches the person named on the document.',
          'If the owner is not there in person, there is a power of attorney.',
          'The neighbours recognise the person showing you round — it is worth asking.',
        ],
      },
      {
        heading: 'If you have already been defrauded',
        paragraphs: [
          'First, preserve everything: the messages, a picture of the advert, the phone number, '
            + 'the payment receipt or transfer confirmation. Take the screenshots immediately — '
            + 'the advert and the account can be deleted within hours.',
          'Then report it to the police, and at the same time flag the advert on the platform '
            + 'with the report button. That second step is the one people skip, and it is the one '
            + 'that protects the next person: a flagged advert goes to moderation and the number '
            + 'behind it is checked against every other listing.',
        ],
      },
    ],
    faq: [
      {
        q: 'Should I pay something up front to reserve a flat?',
        a:
          'No. Any "reservation" payment made before you have seen the property is dangerous. A '
          + 'real owner invites you to view and settles the money question at the meeting, with a '
          + 'contract.',
      },
      {
        q: 'What if the owner refuses to show the ownership document?',
        a:
          'Treat it as a serious warning sign. Seeing the name on the document is a basic check, '
          + 'not a demand to photograph every page of a passport. If you are refused, do not take '
          + 'the deal further.',
      },
      {
        q: 'What do I do if I spot a suspicious advert?',
        a:
          'Press the report button on the listing page and write a line about what looks wrong. '
          + 'Moderators review it, and the phone number is checked against the other adverts it '
          + 'appears on.',
      },
    ],
  },

  {
    slug: 'talabalar-uchun-kvartira-tanlash',
    title: 'A student’s guide to choosing a place to rent',
    summary:
      'Close to campus or close to the metro, halls or a rented flat, and what to settle with a '
      + 'flatmate before you move in.',
    publishedAt: '2026-04-08',
    updatedAt: '2026-06-30',
    readingMinutes: 5,
    h1: 'Choosing a flat as a student: campus, metro and flatmates',
    intro:
      'The week before term starts is the most frantic point in the Uzbek rental year. Thousands '
      + 'of students arrive from the regions at the same time, adverts close within a day, and '
      + 'decisions made in a hurry shape the whole academic year. Most people end up regretting '
      + 'the same thing: they judged the flat on price alone and left the travel time and the '
      + 'flatmate question to sort themselves out. What follows deals with those two questions '
      + 'and the practical decisions attached to them — from the trade-off between being near '
      + 'campus and being near the metro, to the things you and a flatmate should agree on the '
      + 'first day.',
    sections: [
      {
        heading: 'Close to campus, or close to the metro',
        paragraphs: [
          'The first instinct is to get as close to the university as possible. That is '
            + 'reasonable, but it is not always the best answer. Demand in the streets around a '
            + 'faculty building is high, so prices are high and choice is narrow. A flat a few '
            + 'stations away but close to the metro is often cheaper, and the real journey is '
            + 'only a few minutes longer.',
          'In Tashkent this is especially noticeable. Flats around the student campus, the part '
            + 'of Yunusobod where the institutes sit, or near the teaching buildings in Chilonzor '
            + 'are gone quickly in September. Districts a few stations along the same metro line, '
            + 'meanwhile, still have options.',
          'Before you decide, establish one thing: how many days a week you have classes, and at '
            + 'what hours. If you are in a lecture hall every morning, proximity matters. If you '
            + 'are there three days a week and only in the afternoon, a cheaper and quieter flat '
            + 'may serve you better.',
        ],
        bullets: [
          'Real door-to-lecture-hall time, allowing for the morning traffic.',
          'The journey home: is the same route comfortable after dark.',
          'Whether there is somewhere to eat, a shop and a library nearby.',
          'Internet speed — for remote classes and online exams.',
        ],
      },
      {
        heading: 'Halls or a rented flat',
        paragraphs: [
          'Halls of residence are usually cheaper and organisationally simpler: the place is '
            + 'allocated through the university, utilities are not billed separately, and there '
            + 'is security on the door. In exchange, places are limited, the internal rules are '
            + 'strict and personal space is more or less absent.',
          'Renting costs more but gives you freedom and somewhere quiet to study, especially when '
            + 'shared. For many students the middle option turns out to be the right one: two or '
            + 'three people taking a flat together, or renting a single room in a larger flat. '
            + 'The latter means sharing the kitchen and bathroom, but the price sits close to '
            + 'halls.',
        ],
      },
      {
        heading: 'Choosing a flatmate matters more than choosing the flat',
        paragraphs: [
          'You can put up with a bad flat for a year; a month with the wrong flatmate is hard '
            + 'work. So knowing someone is not enough to qualify them — being friends and living '
            + 'together are quite different things. The best test is to sit down calmly before '
            + 'you move in and talk openly about daily habits.',
          'Establish three things above all: who sleeps when, how often guests come round, and '
            + 'how money is handled. Those three account for most of the conflicts in shared '
            + 'flats. Raising them may feel awkward, but it is far easier than the argument three '
            + 'months in.',
        ],
      },
      {
        heading: 'What to agree with a flatmate in advance',
        paragraphs: [
          'Do not leave the agreement verbal. A note on your phone is enough — what matters is '
            + 'that you have both seen the same words. It is also better to have both flatmates '
            + 'named in the rental contract, so that the responsibility and the rights are '
            + 'shared equally.',
          'Pay particular attention to what happens if someone leaves. If your flatmate moves out '
            + 'after six months, who covers the remaining months and who finds a replacement — '
            + 'saying it out loud in advance removes an extremely awkward conversation later.',
        ],
        bullets: [
          'How rent and utilities are split, who collects the money and on what date.',
          'Who paid the deposit and who gets it back at the end.',
          'How the rooms are allocated: does the larger room pay more.',
          'When guests and relatives can visit, and for how long.',
          'The cleaning rota and shared shopping — who buys what.',
          'What happens if one of you leaves before the term is up.',
        ],
      },
      {
        heading: 'Talking to the owner as a student',
        paragraphs: [
          'Some owners are wary of letting to students, usually over noise and reliable payment. '
            + 'The way through it is openness: say from the start how many of you there are, '
            + 'where you study and how the rent will be paid. A parental guarantee or an offer to '
            + 'pay a few months up front often settles the matter.',
          'Be equally clear about the term. The academic year runs from September to June and '
            + 'many students go home for the summer. If you intend to leave the flat over the '
            + 'summer, say so at the outset and have it written into the contract — otherwise '
            + 'three months of rent can turn into a debt.',
        ],
      },
    ],
    faq: [
      {
        q: 'Where should a student look for a flatmate?',
        a:
          'There is a dedicated flatshare section, with the option to filter by gender. Adverts '
          + 'there are posted both by students looking for someone to share with and by owners '
          + 'looking for a flatmate for a room.',
      },
      {
        q: 'The owner is asking for my parents’ guarantee — is that normal?',
        a:
          'Yes, it is common practice and it is not a judgement on you. Usually a parent’s '
          + 'contact number and confirmation by phone is enough.',
      },
      {
        q: 'Can I keep the flat empty over the summer?',
        a:
          'Only if the owner agrees and it is written into the contract. Otherwise you will be '
          + 'asked to pay for the empty months too, so settle this before you sign.',
      },
    ],
  },

  {
    slug: 'uy-egasi-uchun-elon-yozish',
    title: 'How to write a listing that gets calls',
    summary:
      'For owners: which photographs you need, what belongs in the description, what to '
      + 'disclose up front, and why verification helps.',
    publishedAt: '2026-05-14',
    updatedAt: '2026-07-16',
    readingMinutes: 6,
    h1: 'For owners: how to write a listing that gets calls',
    intro:
      'Two identical flats, the same district, the same price. One is let within a week; the '
      + 'other sits empty for a month. The difference is almost never the flat — it is the '
      + 'listing. A tenant looks at dozens of adverts a day and gives each one a few seconds: '
      + 'glances at the photo, checks the price, reads the first two lines, moves on. If those '
      + 'few seconds do not give a clear picture of your flat, the advert sinks. Writing a good '
      + 'one is not difficult work; it is an hour of care, and that hour usually buys back weeks '
      + 'of an empty flat.',
    sections: [
      {
        heading: 'Photographs are ninety per cent of the listing',
        paragraphs: [
          'Take the pictures in daylight, on a bright day. Turn the lights on, open the curtains, '
            + 'clear away the clutter — this is not renovation, it is basic preparation. Shoot '
            + 'each room from the doorway, from a corner: the room reads as larger and the layout '
            + 'is easier to understand. A phone camera is entirely sufficient, as long as your '
            + 'hand is steady.',
          'The commonest mistake is posting only the two prettiest shots. A tenant is suspicious '
            + 'of what they have not been shown and will not even open the advert. Show every '
            + 'room, the kitchen, the bathroom, the balcony and the stairwell — including the '
            + 'tired parts. Hide them and the tenant arrives, sees them, is annoyed and leaves, '
            + 'and you have wasted the afternoon.',
        ],
        bullets: [
          'Daylight, lights on, curtains open.',
          'Every room, the kitchen, the bathroom, the balcony — leave nothing out.',
          'The view from the window, the stairwell and the courtyard.',
          'Photos taken on the same day, and all of the same flat.',
          'Never reuse pictures from another advert — the checks pick that up.',
        ],
      },
      {
        heading: 'Make the title specific',
        paragraphs: [
          'A title is not the first sentence of the advert, it is its address. "Wonderful flat, '
            + 'hurry" carries no information at all. Put the three things that matter into it '
            + 'instead: the number of rooms, a landmark, and the flat’s main selling point — the '
            + 'district or metro station, and one concrete attribute such as "furnished" or '
            + '"recently renovated".',
          'Capital letters, exclamation marks and the word "URGENT" never help. They are the '
            + 'house style of agent adverts and they make a tenant suspicious. A plain, calm, '
            + 'precise title gets opened more often.',
        ],
      },
      {
        heading: 'The description: what the tenant wants to know',
        paragraphs: [
          'Write the description in the order the tenant asks their questions, not in the order '
            + 'that suits you. Put the essentials in the first two lines: where it is, how many '
            + 'rooms, whether it is furnished, who it suits. The rest of the detail can follow.',
          'You do not need long, flowery text. Ten or fifteen precise lines work better than a '
            + 'hundred lines of praise. Generic words like "has everything", "cosy" and '
            + '"European renovation" say nothing — replace them with facts: which appliances are '
            + 'there, how it is heated, what floor it is on.',
        ],
        bullets: [
          'A landmark: metro station, bazaar, school or a main street.',
          'Rooms, floor area, which floor of how many, and whether there is a lift.',
          'The furniture and appliances, listed.',
          'Type of heating, internet, parking.',
          'Who it is offered to: a family, students, a flatshare — say so plainly.',
          'The date it is free from, and the minimum term.',
        ],
      },
      {
        heading: 'The price, and what it covers',
        paragraphs: [
          'An advert with no price is barely opened. "Negotiable" does not save the tenant time; '
            + 'it simply sends them to the next listing. Put a real figure in — the negotiation '
            + 'will happen anyway.',
          'Alongside the price, say what it covers: are utilities included, who pays the building '
            + 'management fee, is the internet separate. State the deposit in the advert as well. '
            + 'That information cuts out pointless calls, and the people who do ring are the ones '
            + 'who already accept your terms.',
        ],
      },
      {
        heading: 'What to disclose in advance',
        paragraphs: [
          'Hiding a drawback buys a short-term advantage and costs you in the long run. If the '
            + 'flat is on the ground floor, if there is no lift, if the heating is electric only, '
            + 'if there is construction on the next street — write it down. That kind of openness '
            + 'builds trust, and the people who come to view are the ones who have already '
            + 'accepted those conditions.',
          'Set out your terms up front too: are pets allowed, how many people may live there, '
            + 'what your position on smoking is. Settling these in the advert is better than an '
            + 'uncomfortable conversation with someone standing in your hallway.',
        ],
      },
      {
        heading: 'Verification and answering quickly',
        paragraphs: [
          'Confirming your phone number and having your identity and ownership document checked '
            + 'gives the listing a trust badge. That matters to tenants, because they are wary of '
            + 'fraud and open verified adverts first. The check is free and you do it once.',
          'The last point is small and important: response time. Someone hunting for a flat calls '
            + 'several owners in a day and goes to view whoever answers first. Making a habit of '
            + 'calling back a missed number, even hours later, changes the outcome of a listing '
            + 'noticeably. And once the flat is let, close the advert straight away — it saves '
            + 'other people’s time and protects your reputation.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does it cost anything to post a listing?',
        a:
          'No. Posting, editing and verifying a listing are all free for the owner. No commission '
          + 'is taken from you at any point.',
      },
      {
        q: 'Can everyone see my phone number?',
        a:
          'No. The number is shown only to signed-in users and only on the full listing page. '
          + 'That stops automated scrapers from harvesting it.',
      },
      {
        q: 'Why is nobody looking at my listing?',
        a:
          'It is usually one of three things: too few or poor photos, no price, or a description '
          + 'that is too generic. Fixing those three normally brings a listing back to life.',
      },
    ],
  },

  {
    slug: 'zakladka-va-depozit',
    title: 'The deposit: when you get all of it back',
    summary:
      'What the zakladka is for, what a landlord may lawfully withhold, and how photographs '
      + 'taken on move-in day become your evidence on the day you leave.',
    publishedAt: '2026-03-05',
    updatedAt: '2026-08-11',
    readingMinutes: 8,
    h1: 'The rental deposit: how it is paid, what it covers and how it comes back',
    intro:
      'The most argued-over money in any tenancy is the deposit — the zakladka, as it is called '
      + 'in Uzbekistan. It is neither rent nor an agent’s fee, yet it is the payment that hurts '
      + 'most in the month you move in, and it is the one that turns into a row on the day you '
      + 'move out. The reason is almost always the same: the zakladka is agreed verbally. "I will '
      + 'give it back if you do not damage anything," someone says, both sides nod — and a year '
      + 'later it emerges that they understood the word "damage" entirely differently. For the '
      + 'landlord it covers the mark on the wall and the scrape on the door; for the tenant it '
      + 'covers only things that are actually broken. What follows sets out why a deposit is '
      + 'taken, how to write it into the contract, what to do on the day you get the keys, and '
      + 'what to do if the money does not come back. This is general practical guidance rather '
      + 'than legal advice: where the situation is tangled or the sum is large, talk to a lawyer.',
    sections: [
      {
        heading: 'What the deposit is, and what it is not',
        paragraphs: [
          'The zakladka is the landlord’s security. It is money held in advance against damage '
            + 'that may happen, an unpaid utility bill, or a flat abandoned before the term is '
            + 'up. The important part is that it is not the landlord’s income. If the flat is '
            + 'undamaged and nothing is owed, it has to come back in full — that is not a favour, '
            + 'it is an ordinary condition of the deal.',
          'The first misunderstanding starts here. Many tenants treat the deposit as "the last '
            + 'month’s rent" and stop paying a month before they leave. The landlord treats it as '
            + 'untouchable security and expects that month to be paid like any other. Each of '
            + 'them is right in their own terms, because nobody ever wrote it down. One sentence '
            + 'in the contract — does the deposit count as the final month, or is it returned '
            + 'separately — closes the argument entirely.',
          'The second misunderstanding comes from confusing the deposit with an agent’s '
            + 'commission. What a broker takes is a fee for a service and it does not come back; '
            + 'the zakladka is returnable money and it is handed to the owner of the flat and to '
            + 'nobody else. If the person asking you for a "deposit" is not the owner and holds '
            + 'no written authority from them, that is already a completely different '
            + 'conversation.',
        ],
        bullets: [
          'The deposit is returnable security, not part of the rent.',
          'It goes only to the owner, or to a representative holding a power of attorney.',
          'The amount and the terms of its return belong in the contract.',
          'When you hand the money over, take a receipt or a signed note on the contract itself.',
        ],
      },
      {
        heading: 'How the deposit clause should be written',
        paragraphs: [
          'The clause does not need to be long — four or five sentences will do, provided each of '
            + 'them is precise. A general phrase such as "withheld in the event of damage" means '
            + 'nothing in practice, because nothing marks where damage begins. List instead what '
            + 'money may be withheld for, and add a separate sentence saying that fair wear and '
            + 'tear does not count as damage.',
          'The second essential is timing. "Returned after you leave" can stretch into months '
            + 'without anyone having broken the agreement. Put a number on it: how many days from '
            + 'the day you hand the flat back, and by what method. If it is coming by transfer, '
            + 'the card or account number belongs in the contract too.',
          'If a ready-made contract is missing one of these clauses, you can write it in by hand '
            + 'and have both parties sign in the margin. The rest of the contract is dealt with '
            + 'in the separate guide to checking a rental agreement before you sign.',
        ],
        bullets: [
          'The amount of the deposit, in figures and in words.',
          'Whether it counts as the final month’s rent or is returned separately.',
          'The circumstances in which it may be withheld, set out as a list.',
          'A separate sentence stating that fair wear and tear is not damage.',
          'How many days after handover it is returned, and by what method.',
          'A requirement that every sum withheld be justified in writing.',
        ],
      },
      {
        heading: 'Move-in day decides the argument in advance',
        paragraphs: [
          'The outcome of the argument on the day you leave is settled on the day you arrive. '
            + 'When you take the keys, photograph every room on your phone — not attractively, '
            + 'but completely: the walls, the corners of the ceiling, the floor, the marks beside '
            + 'the doors, the seals in the bathroom, the inside of the kitchen cupboards, the '
            + 'window frames. Phone photographs carry the date automatically, and that date is '
            + 'what makes them evidence later. Add a short video as well: one walk through the '
            + 'flat, room by room, is enough.',
          'Alongside the photographs, draw up an inventory. List the furniture and appliances by '
            + 'name and write a word or two on the condition of each: fridge works, door seal '
            + 'worn; air conditioner works, no remote; edge of the kitchen table chipped. Print '
            + 'two copies, have both sides sign, and attach it to the contract.',
          'The third job is the meters. Write down the water, gas and electricity readings and '
            + 'photograph them so the digits are legible: an outgoing tenant’s debt is very often '
            + 'taken out of the next tenant’s deposit.',
        ],
        bullets: [
          'A dated photograph of every room, the bathroom and the kitchen.',
          'One walk-through video — a minute or two is plenty.',
          'A signed inventory showing the condition of the appliances.',
          'All three meter readings — written down and photographed.',
          'Separate photographs of existing faults and damage, with nothing left out.',
        ],
      },
      {
        heading: 'What a landlord may withhold',
        paragraphs: [
          'The list of things that can justify keeping part of the deposit is shorter than people '
            + 'expect. Real damage, meaning something broken rather than ordinary wear from use; '
            + 'unpaid rent, or unpaid kommunal — the utility bills for electricity, gas, water '
            + 'and refuse; leaving before the term in breach of the notice the contract sets out; '
            + 'and failing to hand the flat back in the state agreed, for instance leaving it '
            + 'uncleaned or full of things you did not take with you.',
          'Fair wear and tear is not damage. Paint that has dulled with time, a thin patch in the '
            + 'flooring where people walk, a tap washer that has given up, a blown bulb, a door '
            + 'lock that has loosened naturally — none of that is the tenant’s fault. This '
            + 'boundary is the one that gets argued about, which is exactly why it is worth '
            + 'writing into the contract.',
          'The sum withheld has to be justified as well. Not a rough "that will cost something to '
            + 'repair", but something specific: which item, what repairing or replacing it cost, '
            + 'and a receipt or at least a written estimate from a tradesman. Asking for that '
            + 'account is entirely reasonable and it is not rude.',
        ],
        bullets: [
          'Counts as damage: a broken window, a holed door, a burnt surface, a missing appliance.',
          'Does not count: dulled paint, worn flooring, a perished tap washer.',
          'Debts: unpaid rent, an open utility account, the building-management fee.',
          'A written justification for every sum withheld, with a receipt where possible.',
        ],
      },
      {
        heading: 'Handover day: how to give the flat back',
        paragraphs: [
          'Prepare for the handover a day in advance. Clean the flat and put the small things '
            + 'right yourself — changing a blown bulb or taking out a nail you hammered in costs '
            + 'you an hour, and costs considerably more on the landlord’s account. Do not leave '
            + 'things behind: to the landlord they are rubbish, and taking rubbish away is '
            + 'another expense.',
          'Hand the flat back with the landlord present. Take the inventory, walk through room by '
            + 'room together and check the entries one by one. Write down and photograph the '
            + 'final meter readings, and show the paid utility receipts. At the moment you hand '
            + 'over the keys, get a short receipt from the landlord: the flat was accepted on '
            + 'this date, in this condition, with no claims outstanding.',
          'If the deposit is returned the same day, confirm in writing that you received it; if '
            + 'it is to be transferred later, the receipt should state how much is coming back '
            + 'and by what date.',
        ],
      },
      {
        heading: 'What to do if the deposit does not come back',
        paragraphs: [
          'The first step is not a row but a written approach. Message the landlord: the date you '
            + 'handed the flat back, the clause of the contract the money is due under, the '
            + 'amount, and the date by which you expect it. It matters that it is in writing, '
            + 'because a phone call cannot be evidence afterwards. Most cases are settled at this '
            + 'stage.',
          'If there is no answer, or money continues to be withheld without justification, gather '
            + 'everything in one place: the contract, the inventory, the move-in and move-out '
            + 'photographs, the meter readings, payment receipts and the correspondence. From '
            + 'there you can send a formal written claim and, if it comes to it, go to court. '
            + 'This is the moment when those dated photographs from move-in day decide how strong '
            + 'your case is.',
          'It is worth saying again: this article is general practical guidance, not legal '
            + 'advice. If the sum is significant or the two sides cannot agree, take advice from '
            + 'a lawyer before you start — one consultation usually costs less than months of '
            + 'correspondence.',
        ],
      },
    ],
    faq: [
      {
        q: 'How much is a deposit usually?',
        a:
          'That is a matter of agreement and it varies with the flat, the term and the '
          + 'conditions — we quote no figures. What matters is that the amount is written into '
          + 'the contract and the terms of its return are spelt out.',
      },
      {
        q: 'Can I live out the last month against the deposit?',
        a:
          'Only if the contract says so. Otherwise the landlord counts it as unpaid rent, and '
          + 'this is one of the commonest disputes there is. Settle that clause before you sign.',
      },
      {
        q: 'What if the landlord withholds money for an old mark on the wall?',
        a:
          'Dated photographs from the day you moved in answer that in a minute. If the mark was '
          + 'there when you arrived, it is either fair wear and tear or a pre-existing condition, '
          + 'and it is no grounds for withholding anything.',
      },
    ],
  },

  {
    slug: 'kvartirani-korish-checklist',
    title: 'Viewing a flat: a thirty-minute checklist',
    summary:
      'What to check in your first half hour inside a flat: water pressure, the fuse board, '
      + 'heating, damp, mobile signal — and which documents to ask for.',
    publishedAt: '2026-04-22',
    updatedAt: '2026-07-29',
    readingMinutes: 7,
    h1: 'Viewing a flat: a checklist for the half hour you spend inside',
    intro:
      'A viewing is usually over very quickly. The landlord opens the door, says "living room, '
      + 'kitchen", you nod, you are out in ten minutes and you sit in the car saying it seemed '
      + 'fine. Three months later you discover that the flat is cold in winter, that the water '
      + 'pressure drops in the evening, and that the damp patch in the bathroom grows a little '
      + 'every week. Nearly all of that could have been established in that same half hour — you '
      + 'only needed to know what to look at, and to turn a few taps on yourself. The list below '
      + 'is written for exactly that: copy it onto your phone and open it when you go to view. '
      + 'Asking questions is not impertinent — a normal landlord sees it every day and thinks '
      + 'nothing of it.',
    sections: [
      {
        heading: 'Three minutes of preparation before you go',
        paragraphs: [
          'Take three things with you: a phone with a full battery, a phone charger and a small '
            + 'torch. The charger is for testing sockets — you plug it into one socket in each '
            + 'room and watch that it charges. The torch is for looking behind cupboards, into '
            + 'the ventilation shafts and under the pipes in the bathroom; damp usually starts in '
            + 'exactly those places you cannot see.',
          'Choose your time as well. Go in daylight if you can — artificial light hides the state '
            + 'of the walls and the ceiling. If the flat is a serious candidate, a second visit '
            + 'in the evening is worth the journey: whether the stairwell is lit, what goes on in '
            + 'the courtyard, whether you hear the neighbours — those questions only answer '
            + 'themselves after dark.',
        ],
        bullets: [
          'A charger — for testing the sockets.',
          'A torch — for under the pipes, behind cupboards and into the ceiling corners.',
          'This list on your phone, and an empty note to write the answers into.',
          'Someone with you, rather than going alone, if you can arrange it.',
        ],
      },
      {
        heading: 'Water, drains and the bathroom',
        paragraphs: [
          'Water comes first, because it is the most expensive and the most disruptive thing to '
            + 'put right. Go into the bathroom and open the tap fully: what is the pressure, is '
            + 'the flow steady, how many seconds until the hot water arrives. Then open the '
            + 'kitchen tap at the same time — how far the pressure falls with both running '
            + 'matters especially on upper floors. Look at the colour too: a yellowish first few '
            + 'seconds means old pipework.',
          'Testing the drains is easy: fill the basin and let it out. If the water goes slowly or '
            + 'gurgles back, that is the sign of a standing problem. Flush the lavatory, wait for '
            + 'the cistern to fill and check that it is not running. Take the torch under the '
            + 'pipes: a dried stain, a white salt trace or rust tells you there is a slow leak.',
          'The water heater is a question of its own. If the flat has a gas water heater — a '
            + 'kolonka, as they are known here — light it and ask when it was last serviced. Be '
            + 'careful with anything involving gas appliances: a suspicious smell, or an old unit '
            + 'that has never been maintained, is more than an inconvenience.',
        ],
        bullets: [
          'Open the bathroom and kitchen taps together and watch the pressure.',
          'How many seconds the hot water takes, and whether it stays steady.',
          'Fill the basin and let it out — see how quickly it drains.',
          'Is the cistern running, and is there damp or rust under the pipes.',
          'If there is a gas water heater — does it work, and when was it last checked.',
        ],
      },
      {
        heading: 'Electricity: the fuse board, the sockets and the capacity',
        paragraphs: [
          'Ask to see the fuse board. It is not an odd request: one look at it tells you a great '
            + 'deal about the state of the flat. New breakers, tidy wiring and labelled circuits '
            + 'are a good sign. A tangle of wires, old-fashioned fuses and joints wrapped in '
            + 'insulating tape will become your problem later.',
          'Test the sockets with your charger — at least one in every room. While you are at it, '
            + 'count them: in older buildings one socket to a room is normal, and in daily life '
            + 'that turns into a forest of extension leads. Press the light switches too, and '
            + 'check that there are bulbs in the fittings and that they work.',
          'The most important question is capacity. In older buildings it is common for the '
            + 'breaker to trip when an air conditioner, a washing machine and an electric heater '
            + 'run at once. Ask the landlord directly: can those three run together, and when was '
            + 'the wiring last renewed. The tone of the answer often tells you more than the '
            + 'answer itself.',
        ],
      },
      {
        heading: 'Heating, windows and damp',
        paragraphs: [
          'Heating is a subject of its own in Uzbekistan, because it changes the winter kommunal '
            + '— the utility bills — completely. Establish whether the building is on central '
            + 'heating, heated by a gas boiler, or reliant on electric heaters, even if you are '
            + 'viewing in July. Then ask the second question straight away: what the bills came '
            + 'to for this flat last winter. It is not an awkward thing to ask; it is your own '
            + 'future expense.',
          'Open and close the windows. Do they shut without sticking, are the seals intact, does '
            + 'a draught come through the frames. Old wooden windows hold heat badly and you feel '
            + 'it in the first cold week. Look carefully at the wall beside the window and the '
            + 'sill below it: dark speckled patches, bubbled paint or lifting wallpaper are signs '
            + 'of damp.',
          'You can smell damp as well. If you notice a musty smell in the first seconds inside, '
            + 'do not ignore it — especially on the ground floor and on the top floor. A freshly '
            + 'painted patch of ceiling, or one room with new wallpaper, is often a covered-up '
            + 'leak. Do not be shy about asking: has water come through here, and when was it '
            + 'repaired.',
        ],
        bullets: [
          'The type of heating, and last winter’s bills for this flat.',
          'Do the windows shut tightly, and are the seals intact.',
          'Damp in the ceiling corners, under the window and on the bathroom wall.',
          'Freshly painted single patches — ask what is underneath them.',
          'The smell of the flat — the first few seconds tell you most.',
        ],
      },
      {
        heading: 'Signal, the stairwell and the neighbours',
        paragraphs: [
          'Check the mobile signal there and then, on your own phone, in each room and '
            + 'particularly in the bedroom and the bathroom. In thick-walled buildings and in '
            + 'semi-basement flats the signal can disappear where you least expect it. Settle the '
            + 'internet question on the same visit: which provider reaches the building, is the '
            + 'cable already in or are you bringing your own, and what speed is available.',
          'Step out into the stairwell and stand there for a minute. Is it kept clean, does the '
            + 'light work, does the entrance door lock, does the lift run and what state is it '
            + 'in. Then go out into the courtyard: is there somewhere to park, where are the '
            + 'bins, what is the playground like. None of this ever appears in a listing, and you '
            + 'live with all of it every day.',
          'If you can, exchange a word with a neighbour. Asking someone on the stairs whether the '
            + 'water is good in this building and whether it gets cold in winter is completely '
            + 'normal, and it usually produces the most honest answer you will get. At the same '
            + 'time you find out whether the person showing you the flat really is from this '
            + 'building.',
        ],
      },
      {
        heading: 'Documents, and the questions to put to the landlord',
        paragraphs: [
          'If you like the flat, raise the paperwork before you leave. Ask to see the ownership '
            + 'document and the landlord’s passport, and check that the name is the same on both. '
            + 'If a relative or an acquaintance is showing the flat on the owner’s behalf, they '
            + 'should hold a power of attorney. That check takes a minute and stops most fraud '
            + 'schemes right there in the hallway.',
          'Ask the money questions at the same time: what the price includes, who pays the '
            + 'utilities, how much the zakladka — the security deposit — is and in what '
            + 'circumstances it comes back in full, how many months the contract runs and whether '
            + 'the rent can change inside that term. Write the answers into the note on your '
            + 'phone: after three viewings in one day, the terms blur together by the evening.',
          'And the last rule, which is never broken: on the day of the viewing, without seeing '
            + 'the ownership document and without a signed contract, you give nobody money. '
            + 'However convincing the offer to "hold it for you" sounds, the answer is the same.',
        ],
        bullets: [
          'The ownership document and the passport — do the names match.',
          'If the owner is not there in person — is there a power of attorney.',
          'What the price includes, and who pays the utilities.',
          'The amount of the deposit and the terms of its return.',
          'The term, whether the rent is fixed, and the notice required to leave.',
          'The date the flat is free from, and when the keys are handed over.',
        ],
      },
    ],
    faq: [
      {
        q: 'How many times should I view a flat?',
        a:
          'Twice, if it is a serious candidate: once in daylight and once in the evening. '
          + 'Daylight shows you the light, the damp and the condition of the place; the evening '
          + 'shows you the stairwell, the noise and what the courtyard is like.',
      },
      {
        q: 'Is it rude to turn the taps on myself?',
        a:
          'No, it is completely ordinary practice and landlords are used to it. If anything, '
          + 'resistance to being checked is itself a warning sign.',
      },
      {
        q: 'I like it but I want to think — can I reserve it?',
        a:
          'Only by signing a contract. Transferring money on the day of the viewing to "reserve" '
          + 'a flat is the single most common fraud request, so do not agree to it.',
      },
    ],
  },

  {
    slug: 'sherik-bilan-yashash',
    title: 'Sharing a flat: what to agree before you move in',
    summary:
      'How rent and utilities get split, the rules on guests and cleaning, whose name goes on '
      + 'the contract, and what happens when a flatmate leaves halfway through.',
    publishedAt: '2026-06-03',
    updatedAt: '2026-08-14',
    readingMinutes: 6,
    h1: 'Sharing a flat: the things to settle before you move in',
    intro:
      'Moving in with a flatmate usually starts very easily. Two people who know each other '
      + 'halve the rent, say they are sure they will get along, take the keys, and for a week '
      + 'everything is excellent. The trouble starts in the second month, and it is almost never '
      + 'about anything large: who did not wash up, who brought a guest to stay for three days, '
      + 'why the kommunal — the utility bills — did not come out evenly this time. Each of those '
      + 'is trivial on its own, but they accumulate until people can no longer live together. '
      + 'The cause is always the same: nobody sat down and talked at the beginning. What follows '
      + 'is a list of the questions worth spending an hour on before you move in. The '
      + 'conversation can feel awkward, but it goes far more easily than the argument three '
      + 'months later.',
    sections: [
      {
        heading: 'Choosing a flatmate: knowing someone is not enough',
        paragraphs: [
          'Being friends and living together are two different things. Someone who is excellent '
            + 'company in a café may turn out to play music at two in the morning, leave the '
            + 'washing-up until tomorrow, or have six people round every week. The reverse is '
            + 'equally true: to somebody else, you are that person. So base the choice on whether '
            + 'your daily habits fit together, not on how much you like each other.',
          'The simplest test is one calm conversation before you move. Get three things straight: '
            + 'who sleeps and wakes when, how often guests come, and how money will be handled. '
            + 'As the student guide on this site puts it, those same three questions account for '
            + 'most of the conflicts in shared flats.',
          'If you are moving in with someone you do not know, hold the first meeting somewhere '
            + 'other than the flat, and invite them to a viewing with you if you can. How a '
            + 'person inspects a flat, what they ask and how they talk to the landlord tells you '
            + 'more about living with them than an hour of conversation.',
        ],
      },
      {
        heading: 'Money: how the rent and the utilities are split',
        paragraphs: [
          'The commonest way to split the rent is straight down the middle. That is fair when the '
            + 'rooms are the same, but in most flats they are not. A large room with a balcony '
            + 'costing exactly what a small one looking onto the courtyard costs feels odd, and '
            + 'by the second month that equality has turned into resentment. Discuss the '
            + 'difference openly at the outset: paying a little more for the bigger room is '
            + 'entirely ordinary practice.',
          'Utilities work differently, and splitting them evenly is usually right, because you '
            + 'both use the water, the gas and the electricity. Agree one thing only: who '
            + 'collects and who pays. The arrangement that works best is for one person to pay '
            + 'all the bills each month and post the receipts in a shared chat, with the other '
            + 'transferring their share the same day. That is a great deal healthier than the fog '
            + 'of "we will settle up later".',
          'Fix the payment date as well, and set it a day or two before the rent is due to the '
            + 'landlord. If your flatmate is paid after the rent falls due, find that out in '
            + 'advance: it is not an insoluble problem, but it becomes one if it is a surprise '
            + 'every month.',
        ],
        bullets: [
          'How the rent is split: evenly, or by the size of the room.',
          'Who collects, who pays, and where the receipts are kept.',
          'Which day of the month the money changes hands.',
          'Who paid the deposit, and who gets it back at the end.',
          'Shared purchases — cleaning things, bulbs, the internet — who buys them.',
          'What happens if one of you is late: agree that in advance too.',
        ],
      },
      {
        heading: 'Whose name is on the contract',
        paragraphs: [
          'This is the question that gets overlooked most often. Usually one person signs the '
            + 'contract and the other simply lives there. That leaves every responsibility — '
            + 'payment, damage, the term — with the person who signed, and the other with no '
            + 'rights at all: the landlord can say at any point that this person is not on the '
            + 'contract.',
          'The right approach is for both flatmates to be named. Then you are tenants on equal '
            + 'terms and each of you can deal with the landlord directly. Landlords know '
            + 'perfectly well that the contract should state who lives in the flat, and this '
            + 'usually meets no resistance at all.',
          'If for some reason only one person is signing, at least get the landlord’s written '
            + 'consent to the second person living there, and put your own money arrangement in '
            + 'writing separately. That arrangement does not bind the landlord, but it makes '
            + 'matters clear between the two of you.',
        ],
      },
      {
        heading: 'Daily life: guests, cleaning and quiet hours',
        paragraphs: [
          'Most disputes come not from big questions but from small habits, so a handful of '
            + 'simple rules are worth agreeing at the start. Guests come first: is staying the '
            + 'night normal, how many people can be invited, can a relative from the regions stay '
            + 'for a week. Without an answer agreed in advance, the very first instance turns '
            + 'into a tense conversation.',
          'Make a cleaning rota — written down, not verbal. Be clear who cleans the shared areas, '
            + 'meaning the kitchen, the bathroom and the hallway, and in which week. Washing-up '
            + 'works the same way: the simplest and most effective rule is that everyone washes '
            + 'up after themselves straight away. "I will do it later" has never worked anywhere.',
          'Talk about quiet hours too, particularly if one of you leaves for work in the morning '
            + 'and the other has evening classes. After what time music and phone calls happen '
            + 'through headphones — that one sentence saves a great deal of sleep. And finally, '
            + 'food: is everything in the fridge shared, or does everyone keep their own. Say it '
            + 'out loud, because that is a source of arguments as well.',
        ],
        bullets: [
          'Guests: for how long, how often, and is notice given.',
          'The cleaning rota and the list of shared areas.',
          'The washing-up rule — the simplest one is the best one.',
          'Quiet hours and the headphone rule.',
          'The fridge: a shared shelf and a personal shelf.',
          'Smoking, pets, and habits that reach beyond the flat.',
        ],
      },
      {
        heading: 'If one of you leaves mid-term',
        paragraphs: [
          'This is the most painful situation in a flatshare and it happens more often than '
            + 'people expect: a job changes, family circumstances change, a student transfers to '
            + 'another city. If it has not been discussed in advance, the person left behind is '
            + 'alone with the whole rent and has a week to find a new flatmate — on the worst '
            + 'possible terms.',
          'So agree three things beforehand. First, notice: how many days ahead the person '
            + 'leaving has to say so. Second, who finds the replacement, and whether you both '
            + 'have to approve them. Third, who covers the rent on the empty room until someone '
            + 'is found. Those three remove most of the uncomfortable conversations entirely.',
          'Settle the deposit here as well. If one person put the money up and that is the person '
            + 'leaving, how does their share come back: is it collected from the new flatmate, or '
            + 'set against the sum the landlord returns at the end. The general rules on deposits '
            + 'are covered in detail in a separate article.',
        ],
      },
      {
        heading: 'Write the agreement down',
        paragraphs: [
          'Put everything you agree in one place. It does not have to be a formal document: a '
            + 'shared note on your phones, or a single message in the chat, is enough. What '
            + 'matters is that you have both seen the same words, so that six months later there '
            + 'is no argument about what was agreed.',
          'This arrangement does not replace the contract with the landlord — it only governs '
            + 'things between the two of you. Responsibility towards the landlord still rests '
            + 'with the people named in the contract. Where money or liability are involved, '
            + 'remember that what is described here is common practice rather than legal advice, '
            + 'and take a lawyer’s view on your own situation.',
        ],
      },
    ],
    faq: [
      {
        q: 'Where can I find a flatmate?',
        a:
          'There is a section built for flatshares: both people looking for someone to share '
          + 'with and owners looking for a flatmate for a room post there. It is also possible '
          + 'to filter by gender.',
      },
      {
        q: 'Do we both have to sign the contract?',
        a:
          'You do not have to, but it is the right way to do it. Otherwise all the '
          + 'responsibility sits with whoever signed, and the other person has no formally '
          + 'recognised right to live in the flat.',
      },
      {
        q: 'If my flatmate stops paying, who does the landlord chase?',
        a:
          'The person named in the contract. If they signed alone, the whole sum is theirs to '
          + 'find. That is precisely why both names belong on the contract.',
      },
    ],
  },

  {
    slug: 'kommunal-tolovlar',
    title: 'Utility bills in a rented flat: who pays for what',
    summary:
      'Which services are metered, which are charged per person, what "utilities separate" '
      + 'actually means, and how not to inherit somebody else’s debt.',
    publishedAt: '2026-02-11',
    updatedAt: '2026-08-18',
    readingMinutes: 7,
    h1: 'Utility bills in a rented flat: how they are calculated and divided',
    intro:
      'Everyone talks about the rent; almost nobody talks about the kommunal — the utility bills '
      + '— until the first winter statement arrives. That is the point at which many tenants '
      + 'realise that the short phrase "utilities separate" in the advert looked a great deal '
      + 'more innocent than it was. In Uzbekistan utilities are calculated by several different '
      + 'mechanisms: part of it by meter reading, part by the number of people living in the '
      + 'flat, part by floor area. Without knowing that difference you cannot even check the '
      + 'figure that turns up at the end of the month. No tariffs appear below — they change, '
      + 'and they differ by location. What is set out instead is how the system works, what to '
      + 'agree with the landlord, and what to do so that the previous tenant’s debt does not '
      + 'become yours.',
    sections: [
      {
        heading: 'Metered and unmetered services',
        paragraphs: [
          'The easiest way to look at utility charges is in two groups. The first is what you pay '
            + 'by meter: electricity, natural gas and mains water each have their own meter, and '
            + 'the bill follows what you used. In this group, using less shows up directly on the '
            + 'statement, which is exactly why it is worth making sure the meter is working.',
          'The second group is the charges that have nothing to do with consumption. Refuse '
            + 'collection is usually calculated by the number of people living in the flat, while '
            + 'the shared services in a block — cleaning the stairwell, the lift, the upkeep of '
            + 'the courtyard — are normally charged by floor area and collected through the '
            + 'building management or the residents’ association. These arrive whether you are '
            + 'living in the flat or away for a month.',
          'The distinction matters in practice, because the two groups are negotiated '
            + 'differently. Metered services almost always fall to the tenant, since the tenant '
            + 'is the one consuming them. Standing charges attached to the property itself more '
            + 'often stay with the landlord. In reality each agreement settles this for itself, '
            + 'which is why it needs to be pinned down in writing rather than by word of mouth.',
        ],
        bullets: [
          'By meter: electricity, gas, mains water.',
          'Per person: refuse collection, as a rule.',
          'By floor area: the building-management or association fee, the lift, shared areas.',
          'Separate contracts of their own: internet, cable television, security.',
          'Heating — central, from a gas boiler, or on the electricity bill, by building type.',
        ],
      },
      {
        heading: 'What "utilities separate" actually means',
        paragraphs: [
          'It is the most ambiguous phrase in any advert. Some landlords use it to mean that only '
            + 'the electricity and the water are on your account; others fold the '
            + 'building-management fee, the refuse charge, the internet and the winter heating '
            + 'into it as well. Both have written the truth as they see it, because the phrase is '
            + 'not a standard — it is only a habit.',
          'So open the phrase up on the very first call. "What do you include in the utilities?" '
            + 'is an entirely reasonable question and a normal landlord answers it in a minute. '
            + 'Then take the answer service by service: electricity, gas, water, refuse, building '
            + 'management, internet, heating. Seven names, seven answers, and the subject is '
            + 'closed.',
          'The split you agree should go into the contract service by service. A single sentence '
            + 'saying "utilities are the tenant’s responsibility" turns into an unexpected bill '
            + 'in winter, particularly in buildings without central heating, where the heating '
            + 'lands on the electricity account and the winter statement looks nothing like the '
            + 'summer one.',
        ],
      },
      {
        heading: 'Reading the meters and submitting the figures',
        paragraphs: [
          'Reading a meter looks simple, but there are a few catches. On most meters the last '
            + 'digit or digits are a different colour — usually in a red frame — and they are the '
            + 'decimal part. Only the whole number is submitted. Most electricity meters are '
            + 'digital now and cycle through several figures on the display; if the tariff is '
            + 'split into time zones, there is a separate figure for each zone.',
          'There are several ways to submit a reading: through the supplier’s mobile app or '
            + 'online account, at payment terminals and in payment apps, or through the building '
            + 'management. Some modern meters transmit the reading themselves, in which case '
            + 'nothing is asked of you at all. Ask the landlord which arrangement applies here — '
            + 'it differs from flat to flat.',
          'A good habit: photograph all three meters on the same day each month. It takes a '
            + 'minute, and if a dispute arises you have a year of history in your hand. Keep the '
            + 'photographs in their own album on your phone, and post them in the shared chat '
            + 'with the landlord as you go.',
        ],
        bullets: [
          'The digits in the red frame are decimals — they are not submitted.',
          'Three separate readings: electricity, gas and water.',
          'Which channel the reading goes through, and on which days of the month.',
          'A photograph on the same day each month — the easiest protection against a dispute.',
          'The meter seals intact — check that on the day you move in.',
        ],
      },
      {
        heading: 'How landlords and tenants usually divide it',
        paragraphs: [
          'Common practice in Uzbekistan is that the tenant pays for what the tenant consumes: '
            + 'electricity, gas, water and refuse. Charges that belong to the property and arrive '
            + 'regardless of who lives there — the building-management or residents’ association '
            + 'fee, contributions to a major-repairs fund and the like — more often stay with the '
            + 'landlord. But this is custom rather than law: the parties can agree otherwise, and '
            + 'that is entirely normal.',
          'The internet stands apart. In some flats the cable is already in and the contract is '
            + 'in the landlord’s name, in which case the tenant usually reimburses the monthly '
            + 'charge. In others the tenant brings in a provider of their own. The second case '
            + 'may involve installation work, so get the landlord’s permission in advance.',
          'Heating is a conversation of its own. In buildings on central heating the charge is '
            + 'usually calculated on a different basis and may not sit inside what the advert '
            + 'calls "utilities" at all. In flats with a gas boiler the heating lands on the gas '
            + 'bill; in flats with electric heaters it lands entirely on the electricity bill, '
            + 'and you notice it in winter. That is why asking about last winter’s bills is one '
            + 'of the most useful questions at a viewing.',
        ],
      },
      {
        heading: 'Not inheriting somebody else’s debt',
        paragraphs: [
          'This is the commonest unpleasant surprise: you move in, the first bill arrives, and '
            + 'the figure has nothing to do with what you used, because it carries a debt left by '
            + 'the previous tenant. Formally the debt attaches to the account, which is to say to '
            + 'the flat, and who ran it up is of no interest to the supplier.',
          'To avoid it, do two things before you move in. First, ask the landlord to show you the '
            + 'most recent receipts for each service, or the account balance in the app: a clear '
            + 'account is visible on the screen. Second, on the day you take the keys, write down '
            + 'all three meter readings, photograph them, and attach them to the contract or at '
            + 'the very least confirm them in writing with the landlord.',
          'One short sentence in the contract helps too: that any utility debt accrued up to the '
            + 'date of signature remains the landlord’s. That sentence settles the question of '
            + 'who owes what in a moment.',
        ],
        bullets: [
          'Check that each service is clear of debt before you move in.',
          'All three readings on the day you get the keys — written down and photographed.',
          'A clause in the contract drawing the line by date.',
          'The meter seals intact and the meters working.',
          'Ask about the internet and cable accounts as well.',
        ],
      },
      {
        heading: 'Moving out: closing the accounts behind you',
        paragraphs: [
          'Closing the utilities when you leave is in your own interest, because an unpaid debt '
            + 'is usually taken out of the deposit. On the last day, write down and photograph '
            + 'all three meter readings again, pay the final bills and keep the receipts. Send '
            + 'the landlord a copy as well.',
          'Go through those readings together when you hand the flat back, and write them into '
            + 'the receipt: these figures on this date, nothing owed. Any bill that arrives after '
            + 'that is not yours, and you hold the document that proves it.',
          'The absence of tariffs in this article is deliberate: they change, and the right place '
            + 'to get a current figure is the supplier’s own source. The divisions and procedures '
            + 'described here are common practice, and they are not a substitute for legal '
            + 'advice.',
        ],
      },
    ],
    faq: [
      {
        q: 'Who normally pays the utilities — the landlord or the tenant?',
        a:
          'In common practice the tenant pays for the services they consume — electricity, gas, '
          + 'water and refuse — while the building-management fee more often stays with the '
          + 'landlord. It is not a legal obligation but a matter of agreement, so put it in the '
          + 'contract.',
      },
      {
        q: 'What do I do if an old debt surfaces after I move in?',
        a:
          'Photographs of the meters on the day you took the keys, and the contract clause '
          + 'drawing the line by date, settle it. Without them the matter becomes a written '
          + 'negotiation with the landlord and the proof is harder to assemble.',
      },
      {
        q: 'Can I find out in advance what the utilities will cost in winter?',
        a:
          'Not exactly, but you can ask the landlord to show you last winter’s bills, and that '
          + 'is the most reliable guide there is. The type of heating matters a great deal too: '
          + 'a flat that relies on electric heaters has a noticeably higher winter bill.',
      },
    ],
  },
];

export const EN_HELP: HelpArticle[] = [
  {
    slug: 'savol-javob',
    title: 'How the platform works',
    summary:
      'From the search to the keys and from the listing to the agreement: the full procedure '
      + 'for tenants and for owners.',
    h1: 'How the platform works',
    intro:
      'Maklersiz Uy is a listings board. Owners post their own adverts here and tenants find '
      + 'them directly. There is no middleman in between and no commission. Both sides of the '
      + 'process are explained below, end to end.',
    sections: [
      {
        heading: 'For tenants: from the search to the keys',
        paragraphs: [
          'You can browse, filter and sort listings without registering. Signing in is required '
            + 'only to see the owner’s phone number — that restriction exists to keep automated '
            + 'programmes from harvesting the numbers.',
          'Narrow the search by area, category, price range, number of rooms and metro station. '
            + 'Save the listings you like and compare a few side by side. After that you call the '
            + 'owner yourself, view the flat and make the agreement directly with them.',
        ],
        bullets: [
          'Searching and browsing listings — no account needed.',
          'Seeing the phone number — after signing in.',
          'Comparing several options through your saved list.',
          'The call, the viewing and the contract — directly with the owner.',
        ],
      },
      {
        heading: 'For owners: from the listing to the agreement',
        paragraphs: [
          'Register and confirm your phone number. Then, in the "Post a listing" section, enter '
            + 'the property type, the address, the number of rooms, the price and the photos. The '
            + 'listing passes an automatic check and is published.',
          'You can edit a listing at any time, hide it temporarily or delete it altogether. '
            + 'Closing the listing once the flat is let is simply good manners: it stops tenants '
            + 'wasting their time calling about a property that is no longer available.',
        ],
      },
      {
        heading: 'Checks and trust badges',
        paragraphs: [
          'Every listing goes through an automatic check before it is published: duplicated '
            + 'photos, agent-style wording and prices that do not fit the market are flagged. '
            + 'Users can also report any listing with a single tap, and a reported listing goes '
            + 'to a moderator.',
          'An owner can additionally verify their identity and their ownership document. Verified '
            + 'listings carry a badge. The badge is not a guarantee of the property’s quality — '
            + 'it only means the person who posted it has been checked.',
        ],
      },
      {
        heading: 'What is free',
        paragraphs: [
          'All of it. Searching, browsing, getting a phone number, posting a listing and having '
            + 'it verified are free for tenants and owners alike. The platform takes no '
            + 'commission, agency fee or service charge.',
          'If somebody asks you for money "for the site", "to process the contract" or "for '
            + 'access to the database", they do not work here. Report that listing immediately.',
        ],
      },
      {
        heading: 'If something goes wrong',
        paragraphs: [
          'Any problem with a listing — wrong information, photos of a different flat, an agent, '
            + 'a demand for money — is reported with the report button. Keep a screenshot of the '
            + 'correspondence too, if you can.',
          'The platform is not a party to the rental agreement, so it cannot settle a dispute '
            + 'between the two sides over money or contract terms. It does act against listings '
            + 'and accounts that break the rules, and in serious cases we recommend going to the '
            + 'police.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },

  {
    slug: 'xavfsizlik',
    title: 'Safety rules',
    summary:
      'The simple rules for viewing a flat and paying a deposit — most of them take about a '
      + 'minute each.',
    h1: 'Staying safe at the viewing and at the payment',
    intro:
      'Most rental problems come from a handful of simple rules not being followed. The rules '
      + 'are not about distrusting anyone; they are about documenting, in advance, the things '
      + 'that are hard to prove afterwards. Each one takes a few minutes.',
    sections: [
      {
        heading: 'While you are calling and messaging',
        paragraphs: [
          'Keep the conversation on the platform and the phone, and leave the important '
            + 'agreements in writing. Ask in the first conversation whose name is on the '
            + 'ownership document and who will sign the contract: that single question saves a '
            + 'great deal of time.',
          'Never send anyone a copy of your passport, your bank card number or an SMS code. None '
            + 'of it is needed to rent a flat. If you are asked for any of it, end the '
            + 'conversation and report the listing.',
        ],
      },
      {
        heading: 'When you go to view',
        paragraphs: [
          'Go in daylight if you can, and take someone with you rather than going alone. Tell '
            + 'someone close to you where you are going and who with, and send them the address. '
            + 'This is not excessive caution — it is ordinary habit.',
          'At the flat, look at the ownership document yourself and compare the name on it with '
            + 'the passport. If the person showing you round is not the owner, ask for their '
            + 'written authority. Do not rush the agreement: you are entitled to a day to think '
            + 'about it, and an honest owner understands that.',
        ],
        bullets: [
          'Go in daylight and, if possible, with someone else.',
          'Send the address to someone close to you beforehand.',
          'Compare the ownership document with the passport.',
          'Photograph every room and the meter readings.',
          'Never make a decision under pressure.',
        ],
      },
      {
        heading: 'Rules about paying',
        paragraphs: [
          'Do not transfer any money before you have seen the flat — no advance payment, no '
            + '"reservation" fee, nothing "to hold the keys". That request is the most common '
            + 'opening of a fraud.',
          'Pay after the contract is signed, and take a receipt. The deposit amount, the grounds '
            + 'for withholding it and the deadline for returning it should be written clearly '
            + 'into the contract. Get written confirmation for every sum paid in cash.',
        ],
      },
      {
        heading: 'Reporting a suspicious listing',
        paragraphs: [
          'Every listing page has a report button. One tap is enough, and a few words of '
            + 'explanation will do. A reported listing goes to a moderator, and the phone number '
            + 'is checked against the other listings it appears on.',
          'You do not need firm evidence to be suspicious. Flagging something that struck you as '
            + 'odd may protect the person who comes after you, and a report that turns out to be '
            + 'mistaken harms nobody.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },

  {
    slug: 'foydalanish-shartlari',
    title: 'Terms of use',
    summary:
      'The rules for posting listings, prohibited behaviour, how moderation works and what the '
      + 'platform’s role is — in plain language.',
    h1: 'Terms of use',
    intro:
      'The rules for using the platform are set out below in plain language. Visiting and using '
      + 'the site means you accept them. This text is written as a general explanation and does '
      + 'not replace legal advice — for your own situation, consult a qualified lawyer.',
    sections: [
      {
        heading: 'What the platform does and does not do',
        paragraphs: [
          'Maklersiz Uy is a listings board. The platform displays adverts posted by owners and '
            + 'lets users find them. It does nothing else.',
          'The platform is not a party to the rental agreement. It does not let property, does '
            + 'not rent property, does not draw up contracts, does not take payments and does not '
            + 'act as an intermediary between the parties. The contract is made solely between '
            + 'the owner and the tenant, and responsibility for its terms rests with those two '
            + 'parties.',
          'The platform takes no commission, agency fee or service charge. Anyone who asks you '
            + 'for money on the platform’s behalf is breaking the rules and should be reported.',
        ],
      },
      {
        heading: 'Rules for posting listings',
        paragraphs: [
          'A listing may only be posted by the owner of the property or by a person authorised to '
            + 'let it. The information in the listing must be accurate, and the photographs must '
            + 'be of that property and taken recently.',
          'Once the property is let, or the listing is no longer relevant, it should be closed. '
            + 'Posting the same property repeatedly, or deleting and reposting a listing to push '
            + 'it artificially to the top, counts as a breach of the rules.',
        ],
        bullets: [
          'Only real, existing properties that are actually available to rent.',
          'Photographs must be of that property and not taken from elsewhere.',
          'The price and terms must be stated accurately and truthfully.',
          'One property, one listing.',
          'Close the listing once the property is let.',
        ],
      },
      {
        heading: 'Prohibited behaviour',
        paragraphs: [
          'The following is strictly prohibited and leads to the listing being removed, and to '
            + 'the account being blocked if it is repeated.',
        ],
        bullets: [
          'Offering intermediary services and charging a fee for them.',
          'Presenting yourself as the owner, or entering false information.',
          'Demanding money before the viewing or before the contract.',
          'Using another person’s photographs, text or phone number.',
          'Adverts for goods, services or promotions unrelated to renting.',
          'Abuse, discrimination, threats and sharing personal data without consent.',
          'Automated harvesting of data from the site and reselling it.',
        ],
      },
      {
        heading: 'Moderation and account suspension',
        paragraphs: [
          'Listings pass an automatic check, and user reports are reviewed by a moderator. A '
            + 'listing that breaks the rules may be sent back for editing or removed.',
          'For repeated or serious breaches, an account is suspended temporarily or closed '
            + 'permanently. If you believe a decision is unfounded, you can appeal and explain '
            + 'the circumstances.',
        ],
      },
      {
        heading: 'Limits of responsibility',
        paragraphs: [
          'The user who posts a listing is responsible for the accuracy of what it says. The '
            + 'platform cannot physically inspect every property and is not responsible for '
            + 'contract terms, payments or disputes between the parties. Viewing the property, '
            + 'checking the ownership document and signing a written contract therefore remain '
            + 'each user’s own responsibility.',
          'These rules may be updated from time to time; the date of the last update is shown at '
            + 'the foot of the page. Once more, for clarity: this page is a general explanation '
            + 'and does not replace legal advice.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },

  {
    slug: 'maxfiylik-siyosati',
    title: 'Privacy policy',
    summary:
      'What data is collected and why, who can see your phone number, and how to delete your '
      + 'account.',
    h1: 'Privacy policy',
    intro:
      'This page explains in plain language what data is collected, why it is needed and how you '
      + 'can control it. The text is written as a general explanation and does not replace legal '
      + 'advice.',
    sections: [
      {
        heading: 'What data is collected',
        paragraphs: [
          'Registration asks for your phone number and your name. If you are an owner, your '
            + 'listings — address, price, description and photographs — are stored as well. '
            + 'Beyond that, simple account-related data such as your saved listings and your '
            + 'search preferences is kept.',
          'General statistics about visits are collected anonymously: which pages were opened, '
            + 'the approximate region and the type of device. This data is not used to identify '
            + 'anyone and is not linked to an individual user.',
        ],
        bullets: [
          'Phone number and name — to create the account and to make contact possible.',
          'Listing data — to publish it on the site.',
          'Saved listings and preferences — for your own convenience.',
          'Anonymous visit statistics — to improve the site.',
        ],
      },
      {
        heading: 'Why it is needed',
        paragraphs: [
          'The phone number serves two purposes: protecting the account, and connecting tenants '
            + 'with owners. Verifying the number substantially reduces fake and duplicate '
            + 'accounts.',
          'Data is not sold to third parties for advertising. It is used only to operate the '
            + 'platform, to keep it secure and to detect breaches of the rules. Information may '
            + 'be provided to the authorities where the law requires it.',
        ],
      },
      {
        heading: 'Who can see your phone number',
        paragraphs: [
          'An owner’s phone number is shown only on the full listing page and only to signed-in '
            + 'users. It is not displayed in search results, on listing pages or to visitors who '
            + 'are not signed in.',
          'That restriction is deliberate: it protects numbers from bulk scrapers and from '
            + 'advertising spam. If you write your number into the body of the listing text, the '
            + 'protection does not apply — so keep it out of the description.',
        ],
      },
      {
        heading: 'Cookies and statistics',
        paragraphs: [
          'The site uses small files in your browser to remember that you are signed in and to '
            + 'keep your preferences. Without them you would have to sign in again every time.',
          'Visit statistics are kept in aggregated form. You can restrict these files through '
            + 'your browser settings, though some conveniences of the site may stop working if '
            + 'you do.',
        ],
      },
      {
        heading: 'Deleting your account and requesting your data',
        paragraphs: [
          'In your account settings you can change your name and contact details at any time, and '
            + 'hide or delete your listings.',
          'If you ask for your account to be deleted entirely, your listings are removed from the '
            + 'site and your personal data is erased. Certain technical records may be retained '
            + 'for a limited period for security reasons and where the law requires it. You can '
            + 'also request a copy of the data held about you.',
        ],
      },
    ],
    updatedAt: '2026-08-01',
  },
];
