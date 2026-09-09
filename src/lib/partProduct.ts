import type { IPhoneModel } from '@/data/iphoneModels'
import type { Product } from '@/types'

export type PartKind = 'display' | 'battery'

/** Builds a fully-typed Product from an iPhone model's display/battery part data. */
export function buildPartProduct(model: IPhoneModel, partKind: PartKind): Product {
  const part = partKind === 'display' ? model.display : model.battery
  return {
    id: `part-${partKind}-${model.id}`,
    name: part.name,
    category: 'Replacement Parts',
    subcategory: partKind === 'display' ? 'Displays' : 'Batteries',
    model: model.name,
    price: part.price,
    images: [part.image],
    description: part.description,
    specifications: part.specifications,
    compatibility: [model.name],
    stock: part.stock,
    rating: partKind === 'display' ? 4.9 : 4.8,
    reviewsCount: partKind === 'display' ? 12 : 24,
    warranty: '6-Month Replacement Warranty',
  }
}
