/** Liga a configuração do Cemita (restaurant.ts + menu.ts) às funções de SEO (lib/seoCore.ts). */
import { menu } from './menu'
import { isPlaceholder, restaurant } from './restaurant'
import type { SeoRestaurant } from '../lib/seoCore'

export const seoRestaurant: SeoRestaurant = {
  fullName: restaurant.fullName,
  description: restaurant.description,
  address: restaurant.address,
  hours: restaurant.hours,
  contact: restaurant.contact,
  social: restaurant.social,
  deliveryPayments: restaurant.deliveryPayments,
  orderUrl: isPlaceholder(restaurant.order.url) ? null : restaurant.order.url,
}
export const seoMenu = menu
