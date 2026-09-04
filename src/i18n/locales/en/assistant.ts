/** Uyiz AI assistant and its notifications. */
export const assistant = {
  mascot: {
    /** A product name: never translated. */
    name: 'AI',
    tagline: 'AI assistant',
    shortTagline: 'AI',
    open: 'AI',
    panelLabel: 'Chat with AI',
  },

  chat: {
    welcome:
      'Hello! I am Uyiz AI, the AI assistant of Uyiz 🏠\n\n'
      + 'I answer housing questions, filter matching listings out of our database, and can '
      + 'put you in touch with our team.\n\n'
      + 'For example:\n'
      + '• "I need an apartment in Chilonzor for up to 3 million"\n'
      + '• "Yunusobod, 2 rooms, for a student"\n'
      + '• "Which is better in winter, 2 or 3 rooms?"',
    welcomeNamed:
      'Hello, {name}. I am Uyiz AI, the AI assistant of Uyiz 🏠\n\n'
      + 'Ask me a housing question, or tell me what you need — district, room count, budget. '
      + 'I will filter the matching listings out of our database.',
    log: 'Conversation history',
    you: 'You',
    inputLabel: 'Message to Uyiz AI',
    inputPlaceholder: 'Chilonzor, up to 3 million...',
    inputThinking: 'Uyiz AI is thinking...',
    inputDisabled: 'Daily limit reached',
    send: 'Send message',
    thinking: 'Uyiz AI is preparing a reply',
    loadingHistory: 'Loading the conversation',
    reset: 'End and clear the conversation',
    close: 'Close the chat',
    quota: '{remaining}/{limit} left',
    quotaLabel: '{remaining} of today’s {limit} requests left',
    quotaWarning: 'You have {count} requests left today.',
    limitReached:
      'You have used all of today’s requests. Come back tomorrow or browse the listings yourself.',
    resultsTitle: 'Listings that match',
    /** What the assistant did, shown as a badge rather than left in prose. */
    actions: {
      addFavorite: 'Saved to favourites',
      removeFavorite: 'Removed from favourites',
      requestSupportCallback: 'Passed to our support team',
      myListings: 'Your listings opened',
      listingPerformance: 'Listing statistics measured',
      listFavorites: 'Favourites opened',
    },
    confirmYes: 'Yes',
    confirmNo: 'No',
    confirmHint: 'Waiting for your confirmation',
    viewAllResults: 'View all apartments',
    startFailed: 'Could not start the conversation. Please try again.',
    replyFailed: 'Could not get a reply. Please try again.',
    networkFailed: 'Network error. Check your internet connection.',
  },

  closeDialog: {
    title: 'End this conversation?',
    description:
      'Once it ends, a full summary is sent to the team and the chat history is cleared.',
    cancel: 'No, keep chatting',
    confirm: 'Yes, end it',
  },

  /**
   * The listing warning banner. It used to carry the verdict of an automatic check
   * that ran at publication; that check is gone, so the copy now talks about a
   * report an administrator has confirmed.
   */
  notice: {
    regionLabel: 'Warnings about your listings',
    title: 'Heads up! A report about your listing was confirmed',
    body: '"{title}" — {reason} Your reliability score has dropped as a result.',
    defaultReason: 'A moderator found the report justified.',
    fix: 'Edit',
    confirmDelete: 'Delete this listing permanently?',
  },
} as const;
