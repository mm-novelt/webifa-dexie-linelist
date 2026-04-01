# Architecture : WebIFA Dexie

L'objectif du projet est de démontrer la faisabilité d'une application web capables de charger un volume important de données dans le navigateur via IndexedDB (Dexie), puis de les parcourir avec des filtres complexes, un tri et une pagination — le tout avec de bonnes performances.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Phase 1 — Fetch et stockage en IndexedDB](#phase-1--fetch-et-stockage-en-indexeddb)
3. [Phase 2 — Filtres utilisateur (filters)](#phase-2--filtres-utilisateur-filters)
4. [Phase 3 — Filtres internes (internalFilters)](#phase-3--filtres-internes-internalfilters)
5. [Cache et navigation entre les pages](#cache-et-navigation-entre-les-pages)

---

## Vue d'ensemble

```
API REST
   │  (TanStack Query — fetch unique par page)
   ▼
DataFetchRepository
   ├── <table>_data      ← enregistrements complets, clé primaire uniquement
   └── <table>_indexed   ← projection légère, tous les champs indexés
          │
          └── enrichIndexed() ← jointure des champs étrangers (post-fetch)

Utilisateur
   ├── filters           → IDs via requêtes Dexie → intersection AND
   ├── internalFilters   → IDs via index composé Dexie
   └── tri / page
          │
          ▼
   DataRepository.getPaginated()
          ├── effectiveFilterCache  (intersection internalFilter × filteredIds)
          └── filteredOrderCache    (tri + découpage en pages)
```

### Deux stores par table

Pour chaque table logique, deux object stores IndexedDB sont créés (`db.service.ts:37-39`) :

```typescript
schema[`${table}_data`]    = 'id';              // Enregistrement complet, clé primaire seule
schema[`${table}_indexed`] = indexes.join(', '); // Projection légère, tous les index déclarés
```

**Exemple** — table `isolement` avec les index `["id", "+createdAt", "statut", "[statut+annee]", "[id+statut+annee]"]` :

| Store              | Contenu                              | Index                                    |
|--------------------|--------------------------------------|------------------------------------------|
| `isolement_data`   | `{ id, patient_id, statut, date, commentaire, ... }` | `id` seulement |
| `isolement_indexed`| `{ id, createdAt, statut, annee }`   | `id`, `createdAt`, `statut`, `[statut+annee]`, `[id+statut+annee]` |

`_data` est interrogé uniquement pour récupérer les enregistrements complets à afficher. `_indexed` est interrogé pour tout le reste : filtrage, tri, recherche.

---

## Phase 1 — Fetch et stockage en IndexedDB

### 1.1 Fetch paginé depuis l'API

`DataFetchRepository.fetchAndStore()` (`data-fetch.repository.ts:87`) parcourt toutes les pages de l'API et les insère en bulk dans IndexedDB.

TanStack Query sert de cache HTTP : chaque page n'est fetchée **qu'une seule fois** par session, même si `fetchAndStore` est rappelé.

```typescript
// data-fetch.repository.ts:104-113
const response = await this.queryClient.fetchQuery<PagedResponse>({
  queryKey: ['fetch', tableName, page],   // clé de cache unique par table+page
  queryFn:  () => fetch(`${url}?page=${page}`).then(r => r.json()),
  staleTime: Infinity,  // jamais périmé
  gcTime:    Infinity,  // jamais évincé du cache
});
```

### 1.2 Extraction des champs indexés

Pour chaque enregistrement, seuls les champs référencés dans les index sont conservés dans `_indexed` (`data-fetch.repository.ts:115-132`).

```typescript
// Définitions d'index dans la config :
// ["id", "+createdAt", "statut", "[statut+annee]"]
//
// extractIndexedFieldNames() → Set { "id", "createdAt", "statut", "annee" }

const picked = pick(record, indexedFields);
// record = { id: "abc", statut: "ouvert", annee: 2024, commentaire: "...", meta: {...} }
// picked = { id: "abc", statut: "ouvert", annee: 2024, createdAt: "2024-03-01" }
```

### 1.3 Champs multi-entrées (multiEntry)

Certains champs contiennent plusieurs valeurs séparées par un délimiteur. Ils sont stockés sous forme de tableau pour que Dexie puisse indexer chaque token individuellement (`data-fetch.repository.ts:122-129`).

```typescript
// Config : multiEntry: { isolement: { bacteries: "," } }
//
// API renvoie : { bacteries: "SARM,ERV" }
// Stocké comme : { bacteries: ["SARM,ERV", "SARM", "ERV"] }
//                                ↑ valeur originale  ↑ tokens
```

Un filtre `searchByExactValue("isolement", "bacteries", "SARM")` retrouve ainsi cet enregistrement, même si la valeur brute est `"SARM,ERV"`.

### 1.4 Enrichissement des champs étrangers (enrichIndexed)

Après le chargement de toutes les tables, `enrichIndexed()` (`data-fetch.repository.ts:174`) dénormalise les valeurs étrangères dans `_indexed` pour permettre le tri et le filtrage sans jointure à la volée.

```typescript
// Config foreignFields pour la table "isolement" :
// { "nom_patient": { foreignTable: "patient", foreignKey: "patient_id", property: "nom" } }

// Algorithme :
// 1. Construit Map<id, record> pour chaque table étrangère (une seule fois)
// 2. Pour chaque enregistrement isolement_indexed, résout la valeur :
//    record["nom_patient"] = patientMap.get(record["patient_id"])?.["nom"] ?? null
// 3. Écrit en bulk par lots de 500

// Avant enrichissement : { id: "abc", statut: "ouvert", patient_id: "p42", nom_patient: null }
// Après enrichissement : { id: "abc", statut: "ouvert", patient_id: "p42", nom_patient: "Dupont" }
```

Le champ `nom_patient` peut maintenant être trié ou filtré directement dans `_indexed`.

---

## Phase 2 — Filtres utilisateur (filters)

Les filtres sont définis dans la config et rendus comme des composants Angular indépendants. Chacun produit une liste d'IDs correspondants et la publie dans le signal `filterResults` du linelist.

### 2.1 Types de filtres disponibles

| Type          | Mécanisme Dexie                          | Exemple d'usage                       |
|---------------|------------------------------------------|---------------------------------------|
| `text`        | `startsWithIgnoreCase()` sur N champs   | Recherche par nom de patient          |
| `select`      | `equals()` ou `anyOf()` (multi-select)  | Filtre par statut                     |
| `foreignKey`  | Autocomplete → `equals()` sur FK        | Filtre par patient lié                |
| `dateRange`   | `between()` (borne inclusive)           | Filtrer par année ou plage de dates   |

### 2.2 Exemple : filtre texte

```typescript
// Config :
// { type: "text", key: "recherche", fields: ["nom_patient", "identifiant"] }

// data.repository.ts:246-263
async searchByText(tableName, fields, term) {
  // Requêtes parallèles sur chaque champ indexé
  const results = await Promise.all(
    fields.map(field =>
      table.where(field).startsWithIgnoreCase(term).primaryKeys()
    )
  );
  // Union des résultats (OR entre champs)
  const union = new Set<string>();
  for (const keys of results) keys.forEach(k => union.add(k));
  return [...union];
}

// "dup" → cherche dans "nom_patient" ET "identifiant" → union des IDs trouvés
```

### 2.3 Exemple : filtre select multi-valeurs

```typescript
// Config :
// { type: "select", key: "statut", field: "statut", multiple: true,
//   options: [{label: "Ouvert", value: "ouvert"}, {label: "Fermé", value: "ferme"}] }

// data.repository.ts:302-307
async searchByAnyOf(tableName, field, values) {
  // values = ["ouvert", "ferme"]
  return table.where(field).anyOf(values).primaryKeys();
  // OR entre les valeurs sélectionnées, dans le même filtre
}
```

### 2.4 Combinaison des filtres (AND)

Le linelist combine tous les filtres actifs par **intersection** (`linelist.component.ts:71-79`) :

```typescript
readonly filteredIds = computed<string[] | null>(() => {
  const map = this.filterResults(); // Map<filterKey, string[]>
  if (map.size === 0) return null;
  const sets = [...map.values()];
  return sets.reduce((acc, ids) => {
    const lookup = new Set(ids);
    return acc.filter(id => lookup.has(id)); // AND entre filtres
  });
});
```

**Exemple concret** avec 2 filtres actifs :

```
Filtre "statut" = "ouvert"     → IDs: ["abc", "def", "ghi"]
Filtre "recherche" = "Dup"     → IDs: ["def", "ghi", "xyz"]
                                        ↓  intersection
filteredIds                    → IDs: ["def", "ghi"]
```

---

## Phase 3 — Filtres internes (internalFilters)

Les `internalFilters` sont des filtres pré-calculés qui exploitent des **index composés** Dexie. Ils s'affichent sous forme de groupe de radio-boutons dans le linelist et représentent des vues métier prédéfinies (ex. : "Cas actifs 2024").

### 3.1 Configuration

```json
{
  "internalFilters": [
    {
      "name": "Cas actifs 2024",
      "index": "[statut+annee]",
      "indexWithFilter": "[id+statut+annee]",
      "value": { "statut": "ouvert", "annee": 2024 },
      "default": true
    }
  ]
}
```

Deux index composés sont nécessaires :
- `[statut+annee]` — utilisé seul quand aucun filtre utilisateur n'est actif.
- `[id+statut+annee]` — utilisé pour **croiser** avec les IDs des filtres utilisateur.

### 3.2 Résolution dans getPaginated

```typescript
// data.repository.ts:148-160
const filterVals = compoundValues("[statut+annee]", { statut: "ouvert", annee: 2024 });
// → ["ouvert", 2024]

if (filteredIds?.length) {
  // Croisement : intersecte les IDs utilisateur avec l'index composé
  const compounds = filteredIds.map(id => [id, "ouvert", 2024]);
  // [["def", "ouvert", 2024], ["ghi", "ouvert", 2024]]
  effectiveFilteredIds = await indexedTable
    .where("[id+statut+annee]")
    .anyOf(compounds)
    .primaryKeys();
} else {
  // Pas de filtre utilisateur : requête directe sur l'index composé
  effectiveFilteredIds = await indexedTable
    .where("[statut+annee]")
    .equals(["ouvert", 2024])
    .primaryKeys();
}
```

### 3.3 Différences clés : filters vs internalFilters

| Aspect              | Filtres utilisateur (`filters`)          | Filtres internes (`internalFilters`)           |
|---------------------|------------------------------------------|------------------------------------------------|
| **Affichage**       | Champs de saisie (texte, select, date)   | Groupe de radio-boutons                        |
| **Évaluation**      | Intersection en mémoire (Set JS)         | Requête sur index composé Dexie                |
| **Complexité**      | O(n) par filtre                          | O(log n) via B-tree IndexedDB                  |
| **Combinaison**     | AND entre tous les filtres actifs        | Intersecte avec l'ensemble des filtres actifs  |
| **Usage**           | Filtres dynamiques saisis par l'utilisateur | Vues métier statiques pré-optimisées        |

---

## Cache et navigation entre les pages

Changer de page sans changer les filtres ni le tri doit être **instantané**. Pour ça, `DataRepository` maintient deux caches en mémoire.

### Cache 1 — effectiveFilterCache

Mémoïse le résultat de l'intersection entre les filtres utilisateur et l'internalFilter (requête coûteuse sur index composé).

```typescript
// Clé de cache (data.repository.utils.ts:32-39) :
// "isolement:[statut+annee]:{"statut":"ouvert","annee":2024}|abc,def,ghi"
//    ↑ table     ↑ index interne + valeurs               ↑ IDs filtres utilisateur (triés)

// data.repository.ts:144-161
if (this.effectiveFilterCache?.key === effectiveCacheKey) {
  effectiveFilteredIds = this.effectiveFilterCache.effectiveFilteredIds; // cache hit
} else {
  effectiveFilteredIds = await indexedTable.where(...).anyOf(...).primaryKeys(); // calcul
  this.effectiveFilterCache = { key: effectiveCacheKey, effectiveFilteredIds };  // mise en cache
}
```

**Invalidation** : la clé change dès que la table, l'internalFilter sélectionné, ou l'ensemble des IDs filtrés change.

### Cache 2 — filteredOrderCache

Mémoïse la liste ordonnée complète des IDs correspondants et la découpe en pages.

```typescript
// Clé de cache (data.repository.utils.ts:21-23) :
// "isolement:createdAt:DESC:abc,def,ghi"
//    ↑ table  ↑ colonne  ↑ sens  ↑ IDs effectifs (triés)

// data.repository.ts:171-185
if (!cache || cache.key !== cacheKey || cache.pageSize !== pageSize) {
  // 1. Récupère tous les IDs dans l'ordre de tri via Dexie
  const allOrderedIds = await indexedTable.orderBy(orderColumn).primaryKeys();

  // 2. Filtre pour ne garder que les IDs autorisés
  const allowedSet = new Set(effectiveFilteredIds);
  const orderedFilteredIds = allOrderedIds.filter(id => allowedSet.has(id));

  // 3. Pré-calcule toutes les pages
  const pages = new Map<number, string[]>();
  for (let p = 1; p <= Math.ceil(orderedFilteredIds.length / pageSize); p++) {
    const off = (p - 1) * pageSize;
    pages.set(p, orderedFilteredIds.slice(off, off + pageSize));
  }

  this.filteredOrderCache = { key: cacheKey, orderedFilteredIds, pageSize, pages };
}
```

### Navigation entre les pages (cache hit)

Une fois les caches chauds, changer de page est O(1) :

```typescript
// data.repository.ts:188-196
const pageIds = cache.pages.get(page) ?? []; // O(1) — lookup dans Map pré-calculée

// Récupère les enregistrements complets depuis _data par leurs IDs
const recordMap = new Map(
  (await dataTable.where('id').anyOf(pageIds).toArray())
    .map(r => [r['id'], r])
);
// Respecte l'ordre original des IDs (ordre de tri)
const rows = pageIds.map(id => recordMap.get(id));
```

### Chemin sans filtre

Quand aucun filtre n'est actif, on bypasse entièrement les caches et on utilise la pagination native Dexie (`data.repository.ts:206-231`) :

```typescript
// Directement offset + limit sur l'index de tri — aucune intersection nécessaire
collection.offset((page - 1) * pageSize).limit(pageSize).primaryKeys()
```

### Résumé : ce qui invalide chaque cache

| Événement                          | effectiveFilterCache | filteredOrderCache |
|------------------------------------|:--------------------:|:------------------:|
| Changement de page                 | —                    | —                  |
| Changement de filtre utilisateur   | ✓                    | ✓                  |
| Changement d'internalFilter        | ✓                    | ✓                  |
| Changement de tri (colonne/sens)   | —                    | ✓                  |
| Changement de table                | ✓                    | ✓                  |

---

## Flux complet — exemple de navigation

```
1. Chargement initial
   └── fetchAndStore() → API pages 1..N → bulkPut dans _data + _indexed
   └── enrichIndexed() → jointures étrangères → bulkPut dans _indexed

2. Utilisateur sélectionne internalFilter "Cas actifs 2024"
   └── getPaginated(page=1, order=createdAt DESC, internalFilter={statut:ouvert, annee:2024})
       ├── effectiveFilterCache miss → WHERE [statut+annee] = ["ouvert", 2024] → 1 200 IDs
       ├── filteredOrderCache miss  → orderBy(createdAt).reverse() → filtrer → 1 200 IDs ordonnés
       │                           → pré-calcul des 120 pages de 10
       └── pages.get(1) → 10 IDs → _data.anyOf(10 IDs) → affichage

3. Utilisateur passe à la page 5
   └── getPaginated(page=5, ...)
       ├── effectiveFilterCache HIT  → 1 200 IDs (inchangé)
       ├── filteredOrderCache HIT    → pages.get(5) → 10 IDs (O(1))
       └── _data.anyOf(10 IDs) → affichage

4. Utilisateur ajoute un filtre texte "Dup"
   └── searchByText() → 340 IDs → filterResults mis à jour → filteredIds = 340 IDs
   └── getPaginated(page=1, filteredIds=[340 IDs], internalFilter=...)
       ├── effectiveFilterCache miss → WHERE [id+statut+annee].anyOf(340 tuples) → 87 IDs
       ├── filteredOrderCache miss  → tri + découpage → 9 pages
       └── pages.get(1) → affichage

5. Utilisateur navigue page 2, 3, 4…
   └── cache HIT à chaque fois → O(1)
```
