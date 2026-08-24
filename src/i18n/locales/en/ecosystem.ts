/**
 * Ecosystem preview page — English.
 */
export const ecosystem = {
  hero: {
    eyebrow: 'Company roadmap',
    title: 'Maklersiz Uy — a property super app',
    subtitle:
      'The road from a plain listings site to the largest property and living-services '
      + 'ecosystem in Uzbekistan.',
  },

  stageLabel: 'Stage {number}',
  roadmapTitle: 'Stages',

  status: {
    active: 'Live now',
    inProgress: 'In development',
    planned: 'Planned',
    future: 'Future ecosystem',
    vision: 'Long-term vision',
  },

  stages: {
    marketplace: {
      title: 'Rental marketplace and AI trust system',
      desc:
        'Broker-free apartment search, AI screening of every listing, a trust score and '
        + 'five-step owner verification.',
      badge: 'Active MVP',
    },
    profile: {
      title: 'Digital rental profile and reputation system',
      desc: 'Two-way reputation and a trust profile for both tenant and owner.',
      badge: 'Coming soon',
    },
    agreement: {
      title: 'Digital agreement and RentPay',
      desc:
        'A legally valid electronic rental agreement inside the platform, plus guaranteed '
        + 'deposit payments.',
      badge: 'Pilot stage',
    },
    services: {
      title: 'Moving, furniture and home services',
      desc:
        'Moving crews, a furniture marketplace, cleaning and internet installation through '
        + 'partner services.',
      badge: 'Ecosystem',
    },
    mortgage: {
      title: 'Mortgage and property super app',
      desc: 'Compare mortgage offers from banks and buy property on one platform.',
      badge: 'Super app',
    },
  },

  cta: {
    title: 'Try the current version',
    body: 'Search for an apartment, verify your documents, or post a listing for free.',
    button: 'Go to listings',
  },
} as const;
