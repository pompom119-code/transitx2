// Resolvers intentionally keep unverifiable fields empty. Connect an authorized
// Places / routing provider here later; never copy factual fields from the LLM.
export const placeResolver = {
  async resolvePlace(item) { return { ...item, verificationStatus: 'pending', address: null, coordinates: null, source: null } },
  async searchPlaces() { return [] },
}
export const foodResolver = {
  async resolveFood(item) { return { ...item, restaurantId: null, restaurantOptions: [], source: null } },
  async searchRestaurants() { return [] },
}
export const transportResolver = {
  async resolveTransport(from, to) { return { from, to, status: 'unresolved', mode: null, minutes: null, source: null } },
}

export async function resolveDraft(draft, providers = {}) {
  const places = providers.places || placeResolver
  const foods = providers.foods || foodResolver
  const transport = providers.transport || transportResolver
  const days = []
  for (const day of draft.days) {
    const items = []
    for (const item of day.items) {
      items.push(item.type === 'poi' ? await places.resolvePlace(item, draft.destination)
        : item.type === 'food' ? await foods.resolveFood(item, draft.destination) : { ...item })
    }
    const segments = []
    for (let i = 0; i < items.length - 1; i++) segments.push(await transport.resolveTransport(items[i], items[i + 1], draft.destination))
    days.push({ ...day, items, segments })
  }
  return { ...draft, days }
}
