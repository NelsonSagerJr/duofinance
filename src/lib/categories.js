export const CATEGORIES = [
  { id: 'alimentacao', label: 'Alimentação', icon: 'restaurant' },
  { id: 'moradia', label: 'Moradia', icon: 'home' },
  { id: 'contas', label: 'Contas', icon: 'receipt_long' },
  { id: 'saude', label: 'Saúde', icon: 'medical_services' },
  { id: 'transporte', label: 'Transporte', icon: 'directions_car' },
  { id: 'lazer', label: 'Lazer', icon: 'celebration' },
  { id: 'pets', label: 'Pets', icon: 'pets' },
  { id: 'compras', label: 'Compras', icon: 'shopping_bag' },
  { id: 'outros', label: 'Outros', icon: 'more_horiz' },
]

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]
}
