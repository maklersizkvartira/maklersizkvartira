/**
 * Map view: chrome, popups, legend.
 *
 * English strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const map = {
  page: {
    title: 'Search on the map',
    subtitle: 'Find an apartment by location',
    counter: '{count} listings on the map',
    listCta: 'Open the list view',
  },

  search: {
    placeholder: 'Search by address, street or district',
  },

  filters: {
    district: 'District',
    rooms: 'Rooms',
    currency: 'Currency',
    currencyUzs: 'So‘m',
    currencyUsd: 'Dollar',
  },

  /** Tashkent districts — names come from `data/mockLocations`. */
  districts: {
    chilonzor: 'Chilonzor',
    yunusobod: 'Yunusobod',
    mirobod: 'Mirobod',
    mirzoUlugbek: 'Mirzo Ulug‘bek',
    olmazor: 'Olmazor',
    yakkasaroy: 'Yakkasaroy',
    sergeli: 'Sergeli',
    shayxontohur: 'Shayxontohur',
    yashnobod: 'Yashnobod',
    uchtepa: 'Uchtepa',
    bektemir: 'Bektemir',
    yangihayot: 'Yangihayot',
  },

  marker: {
    priceMillion: '{value}M',
    label: '{title} — {price}',
  },

  panel: {
    metro: '{station} metro station',
    close: 'Close the listing card',
  },

  state: {
    loadingMap: 'Loading the map...',
    loadingListings: 'Loading listings...',
    scriptError: {
      title: 'The map could not be loaded',
      body:
        'The map library failed to load. Check your internet connection '
        + 'or open the listings as a list.',
    },
    listingsError: {
      title: 'The listings could not be loaded',
    },
    empty: {
      title: 'No listings in this area',
      body: 'Change the filters or clear them.',
    },
    noCoordinates: '{count} listings without coordinates are not shown on the map',
    noMapped: {
      title: 'Nothing to show on the map',
      body: 'The listings found have no exact coordinates. You can still view them as a list.',
    },
  },

  a11y: {
    map: 'Listings map',
    resultList: 'List of listings shown on the map',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },
} as const;
