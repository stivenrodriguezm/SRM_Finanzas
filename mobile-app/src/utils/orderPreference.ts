/** Ordena `items` según los ids guardados en `savedOrder`; los que no están ahí (nuevos) quedan
 * al final, en su orden original. Sin orden guardado, devuelve `items` tal cual. */
export const applySavedOrder = <T extends { _id: string }>(items: T[], savedOrder: string[]): T[] => {
  if (!savedOrder || savedOrder.length === 0) return items;
  const orderMap = new Map(savedOrder.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aIndex = orderMap.has(a._id) ? (orderMap.get(a._id) as number) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b._id) ? (orderMap.get(b._id) as number) : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
};

/** Nuevo array de ids a persistir después de un drag: el orden visible actual + los ids que
 * estaban guardados pero no aparecían en la lista visible (para no perder su posición relativa). */
export const mergeOrderAfterDrag = (visibleIds: string[], previousSavedOrder: string[]): string[] => {
  const missing = previousSavedOrder.filter((id) => !visibleIds.includes(id));
  return [...visibleIds, ...missing];
};
