/** Shield AI assistant and its notifications. */
export const assistant = {
  mascot: {
    /** A product name: never translated. */
    name: 'Shield AI',
    tagline: 'Smart home search assistant',
    shortTagline: 'Smart assistant',
    open: 'Open the Shield AI assistant',
    panelLabel: 'Chat with Shield AI',
  },

  chat: {
    welcome:
      'Hello! I am the Shield AI assistant 🛡️\n\nFor example, try:\n'
      + '• "I need an apartment in Chilonzor for up to 3 million"\n'
      + '• "Yunusobod, 2 rooms, for a student"\n'
      + '• "Looking for a room to share"',
    welcomeNamed:
      'Hello, {name}! I am the Shield AI assistant 🛡️\n\nWhat kind of apartment or room are you looking for?',
    log: 'Conversation history',
    you: 'You',
    inputLabel: 'Message to Shield AI',
    inputPlaceholder: 'Chilonzor, up to 3 million...',
    inputThinking: 'Shield AI is thinking...',
    inputDisabled: 'Daily limit reached',
    send: 'Send message',
    thinking: 'Shield AI is preparing a reply',
    loadingHistory: 'Loading the conversation',
    reset: 'End and clear the conversation',
    close: 'Close the chat',
    quota: '{remaining}/{limit} left',
    quotaLabel: '{remaining} of today’s {limit} requests left',
    quotaWarning: 'You have {count} requests left today.',
    limitReached:
      'You have used all of today’s requests. Come back tomorrow or browse the listings yourself.',
    resultsTitle: 'Listings that match',
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

  notice: {
    regionLabel: 'AI warnings about your listings',
    title: 'Heads up! Your listing is not shown publicly',
    body: '"{title}" — {reason} If you do not edit it, the listing will be removed.',
    defaultReason: 'It appears to have been copied from another source.',
    fix: 'Edit',
    confirmDelete: 'Delete this listing permanently?',
  },
} as const;
