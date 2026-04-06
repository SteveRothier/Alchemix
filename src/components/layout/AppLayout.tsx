import { tierFromDiscoveryCount } from '../../lib/progression'
import {
  selectDiscoveryCount,
  useAlchemixStore,
} from '../../store/useAlchemixStore'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const discoveryCount = useAlchemixStore(selectDiscoveryCount)
  const tier = tierFromDiscoveryCount(discoveryCount)

  return (
    <div className={styles.shell}>
      <div className={styles.main}>
        <section className={styles.gameZone} aria-label="Zone de fusion">
          <p className={styles.placeholder}>Fusion — drag &amp; drop (à venir)</p>
        </section>
        <section className={styles.characterZone} aria-label="Personnage">
          <p className={styles.placeholder}>Personnage &amp; effets (à venir)</p>
        </section>
        <aside className={styles.quickStats} aria-label="Statistiques rapides">
          <p className={styles.statsLine}>
            Découvertes : {discoveryCount}
          </p>
          <p className={styles.statsLine}>
            Tier : {tier}/10
          </p>
        </aside>
      </div>
      <aside className={styles.inventory} aria-label="Inventaire">
        <header className={styles.inventoryHeader}>
          <h2 className={styles.inventoryTitle}>Inventaire</h2>
        </header>
        <p className={styles.placeholder}>Liste des fioles (à venir)</p>
      </aside>
    </div>
  )
}
