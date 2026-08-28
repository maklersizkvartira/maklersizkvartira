# Fix White Screen Crash and Meta Tag Deprecation

The app crashes with a "white screen" because the `AIRecommended` component (and potentially others) tries to access `.length` on an `undefined` pool of listings. This happens when the API returns a response without a `data` field, and the code doesn't handle it gracefully. Additionally, there is a deprecated meta tag in `index.html`.

## Proposed Changes

### Frontend Core

#### [MODIFY] [AIRecommended.tsx](file:///Users/macbookair/Desktop/Maklersiz.uz/src/components/home/AIRecommended.tsx)
- Add null-safe checks for `pool`.
- Ensure `setPool` always receives an array.
- Add a check in the `useEffect` rotation logic to prevent crashing if `pool` is not yet loaded or is malformed.

#### [MODIFY] [TrustStats.tsx](file:///Users/macbookair/Desktop/Maklersiz.uz/src/components/home/TrustStats.tsx)
- Add null-safe checks for `featured` listings.
- Ensure the component doesn't crash if `featured` is undefined.

#### [MODIFY] [useAppStore.ts](file:///Users/macbookair/Desktop/Maklersiz.uz/src/stores/useAppStore.ts)
- Update `fetchFeatured`, `fetchMyListings`, and `fetchFavorites` to use null-safe assignment for the `data` field.

#### [MODIFY] [index.html](file:///Users/macbookair/Desktop/Maklersiz.uz/index.html)
- Replace deprecated `apple-mobile-web-app-capable` with `mobile-web-app-capable`.

## Verification Plan

### Manual Verification
1. Start the frontend: `npm run dev`.
2. Observe if the white screen crash is resolved.
3. Check the browser console for the `TypeError`.
4. Verify that the meta tag warning is gone.
5. Advise the user to start the backend (`npm run backend:dev`) to resolve the 404 errors.
