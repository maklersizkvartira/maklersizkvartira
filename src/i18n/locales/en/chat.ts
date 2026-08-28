/**
 * Direct messaging between tenant and owner.
 *
 * English strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const chat = {
  list: {
    unknownPerson: 'User',
    roleTenant: 'Tenant',
    roleOwner: 'Owner',
    youPrefix: 'You:',
  },
  page: {
    subtitle: 'Reach the owner directly — no broker, no commission.',
  },

  notice: {
    title: 'In-app messaging is not available yet',
    body: 'Direct messages on the site are not available yet. Contact the owner by phone or on Telegram from the listing page.',
    legacyNote:
      'Messages written here previously were kept only in your browser and were never delivered to anyone.',
  },

  contact: {
    title: 'How to reach the owner',
    step1Title: 'Open the listing',
    step1Body: 'Find the apartment you like and go to its page.',
    step2Title: 'Call the owner',
    step2Body: 'The call button on the listing page connects you to the owner directly.',
    step3Title: 'Message on Telegram',
    step3Body: 'If the owner left a Telegram link, write to them there.',
  },

  safety: {
    title: 'Safe communication rule',
    body: 'Never transfer money to a card in advance, before you have seen the apartment in person and received the keys and documents.',
  },

  composer: {
    title: 'Draft your message',
    placeholder: 'Write what you want to tell the owner here...',
    disabledHint:
      'The send button does not work yet. Copy your text and send it to the owner on Telegram or by SMS.',
    quickTitle: 'Ready-made questions',
    quickHint: 'Tap a question to add it to your message.',
    quick: {
      viewing: 'Can I view the apartment today?',
      address: 'Please send the exact address and a landmark',
      contract: 'Will a rental contract be signed?',
      phone: 'Could you share your phone number?',
    },
  },

  actions: {
    browse: 'Browse listings',
    create: 'Post a listing',
  },

  toast: {
    ownerOnly: 'To post a listing, switch your profile role to "Owner".',
    unavailable:
      'Sending messages is not available yet. Call the owner from the listing page.',
  },
} as const;
