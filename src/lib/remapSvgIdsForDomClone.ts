/**
 * Après cloneNode d’un sous-arbre contenant du SVG, les id dupliqués cassent
 * url(#id). On renomme les id du clone et met à jour les références.
 */
export function remapSvgIdsInClonedSubtree(root: HTMLElement): void {
  const idEls = root.querySelectorAll<SVGElement | HTMLElement>('[id]')
  const map = new Map<string, string>()
  const tag = `g${Math.random().toString(36).slice(2, 10)}`

  idEls.forEach((node) => {
    const old = node.getAttribute('id')
    if (!old) return
    map.set(old, `${old}-${tag}`)
  })

  idEls.forEach((node) => {
    const old = node.getAttribute('id')
    const next = old ? map.get(old) : undefined
    if (next) node.setAttribute('id', next)
  })

  root.querySelectorAll('*').forEach((el) => {
    for (const attr of el.getAttributeNames()) {
      const val = el.getAttribute(attr)
      if (!val) continue
      let next = val
      for (const [oldId, newId] of map) {
        next = next.replaceAll(`url(#${oldId})`, `url(#${newId})`)
        next = next.replaceAll(`url('#${oldId}')`, `url('#${newId}')`)
        if (attr === 'href' || attr.endsWith(':href')) {
          if (next === `#${oldId}`) next = `#${newId}`
        }
      }
      if (next !== val) el.setAttribute(attr, next)
    }
  })
}
