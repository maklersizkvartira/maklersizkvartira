/**
 * Map view: chrome, popups, legend.
 *
 * Russian strings. Keys are added as the matching components are
 * migrated; the Uzbek file is the source of truth for the key shape.
 */
export const map = {
  page: {
    title: 'Поиск на карте',
    subtitle: 'Найдите квартиру по расположению',
    counter: 'На карте {count} объявлений',
    listCta: 'Открыть списком',
  },

  search: {
    placeholder: 'Поиск по адресу, улице или району',
  },

  filters: {
    district: 'Район',
    rooms: 'Комнаты',
    currency: 'Валюта',
    currencyUzs: 'Сум',
    currencyUsd: 'Доллар',
  },

  /** Районы Ташкента — названия берутся из `data/mockLocations`. */
  districts: {
    chilonzor: 'Чиланзар',
    yunusobod: 'Юнусабад',
    mirobod: 'Мирабад',
    mirzoUlugbek: 'Мирзо-Улугбек',
    olmazor: 'Алмазар',
    yakkasaroy: 'Яккасарай',
    sergeli: 'Сергели',
    shayxontohur: 'Шайхантахур',
    yashnobod: 'Яшнабад',
    uchtepa: 'Учтепа',
    bektemir: 'Бектемир',
    yangihayot: 'Янгихаёт',
  },

  me: {

    label: 'Вы здесь',

    cta: 'Показать меня на карте',

  },

  marker: {
    priceMillion: '{value} млн',
    label: '{title} — {price}',
  },

  panel: {
    metro: 'метро {station}',
    close: 'Закрыть карточку объявления',
  },

  state: {
    loadingMap: 'Карта загружается...',
    loadingListings: 'Объявления загружаются...',
    scriptError: {
      title: 'Не удалось загрузить карту',
      body:
        'Библиотека карты не загрузилась. Проверьте подключение к интернету '
        + 'или откройте объявления списком.',
    },
    listingsError: {
      title: 'Не удалось загрузить объявления',
    },
    empty: {
      title: 'В этом районе объявлений нет',
      body: 'Измените или сбросьте фильтры.',
    },
    noCoordinates: '{count} объявлений без координат не показаны на карте',
    noMapped: {
      title: 'Нет объявлений для показа на карте',
      body: 'У найденных объявлений не указаны точные координаты. Их можно посмотреть списком.',
    },
  },

  a11y: {
    map: 'Карта объявлений',
    resultList: 'Список объявлений на карте',
    zoomIn: 'Приблизить',
    zoomOut: 'Отдалить',
  },
} as const;
