export const STOREFRONT_LOCATION_EVENT = 'storefront:location';

export function publishStorefrontLocationChange(): void {
  window.dispatchEvent(new Event(STOREFRONT_LOCATION_EVENT));
}
