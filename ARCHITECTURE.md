# Architecture: WebIFA Dexie

The goal of this project is to demonstrate the feasibility of a web application capable of loading large volumes of data into the browser via IndexedDB (Dexie), then browsing it with complex filters, sorting, and pagination — all with good performance.

---

## Table of contents

1. [Overview](#overview)
2. [Phase 1 — Fetch and storage in IndexedDB](#phase-1--fetch-and-storage-in-indexeddb)
3. [Phase 2 — User filters (filters)](#phase-2--user-filters-filters)
4. [Phase 3 — Internal filters (internalFilters)](#phase-3--internal-filters-internalfilters)
5. [Cache and page navigation](#cache-and-page-navigation)

---

## Overview

```
REST API
   │  (TanStack Query — single fetch per page)
   ▼
DataFetchRepository
   ├── <table>_data      ← full records, primary key only
   └── <table>_indexed   ← lightweight projection, all indexed fields
          │
          └── enrichIndexed() ← foreign field join (post-fetch)

User
   ├── filters           → IDs via Dexie queries → AND intersection
   ├── internalFilters   → IDs via Dexie compound index
   └── sort / page
          │
          ▼
   DataRepository.getPaginated()
          ├── effectiveFilterCache  (internalFilter × filteredIds intersection)
          └── filteredOrderCache    (sort + page slicing)
```

### Two stores per table

For each logical table, two IndexedDB object stores are created (`db.service.ts:37-39`):

```typescript
schema[`${table}_data`]    = 'id';              // Full record, primary key only
schema[`${table}_indexed`] = indexes.join(', '); // Lightweight projection, all declared indexes
```

**Example** — table `isolement` with indexes `["id", "+createdAt", "statut", "[statut+annee]", "[id+statut+annee]"]`:

| Store              | Content                              | Indexes                                  |
|--------------------|--------------------------------------|------------------------------------------|
| `isolement_data`   | `{ id, patient_id, statut, date, commentaire, ... }` | `id` only |
| `isolement_indexed`| `{ id, createdAt, statut, annee }`   | `id`, `createdAt`, `statut`, `[statut+annee]`, `[id+statut+annee]` |

`_data` is queried only to retrieve full records for display. `_indexed` is queried for everything else: filtering, sorting, searching.

---

## Phase 1 — Fetch and storage in IndexedDB

### 1.1 Paginated fetch from the API

`DataFetchRepository.fetchAndStore()` (`data-fetch.repository.ts:87`) iterates over all API pages and bulk-inserts them into IndexedDB.

TanStack Query acts as an HTTP cache: each page is fetched **only once** per session, even if `fetchAndStore` is called again.

```typescript
// data-fetch.repository.ts:104-113
const response = await this.queryClient.fetchQuery<PagedResponse>({
  queryKey: ['fetch', tableName, page],   // unique cache key per table+page
  queryFn:  () => fetch(`${url}?page=${page}`).then(r => r.json()),
  staleTime: Infinity,  // never stale
  gcTime:    Infinity,  // never evicted from cache
});
```

### 1.2 Extracting indexed fields

For each record, only the fields referenced in indexes are kept in `_indexed` (`data-fetch.repository.ts:115-132`).

```typescript
// Index definitions in the config:
// ["id", "+createdAt", "statut", "[statut+annee]"]
//
// extractIndexedFieldNames() → Set { "id", "createdAt", "statut", "annee" }

const picked = pick(record, indexedFields);
// record = { id: "abc", statut: "ouvert", annee: 2024, commentaire: "...", meta: {...} }
// picked = { id: "abc", statut: "ouvert", annee: 2024, createdAt: "2024-03-01" }
```

### 1.3 Multi-entry fields (multiEntry)

Some fields contain multiple values separated by a delimiter. They are stored as arrays so that Dexie can index each token individually (`data-fetch.repository.ts:122-129`).

```typescript
// Config: multiEntry: { isolement: { bacteries: "," } }
//
// API returns: { bacteries: "SARM,ERV" }
// Stored as:   { bacteries: ["SARM,ERV", "SARM", "ERV"] }
//                              ↑ original value  ↑ tokens
```

A filter `searchByExactValue("isolement", "bacteries", "SARM")` will thus match this record, even though the raw value is `"SARM,ERV"`.

### 1.4 Foreign field enrichment (enrichIndexed)

After all tables are loaded, `enrichIndexed()` (`data-fetch.repository.ts:174`) denormalizes foreign values into `_indexed` to enable sorting and filtering without on-the-fly joins.

```typescript
// foreignFields config for the "isolement" table:
// { "nom_patient": { foreignTable: "patient", foreignKey: "patient_id", property: "nom" } }

// Algorithm:
// 1. Build Map<id, record> for each foreign table (once)
// 2. For each isolement_indexed record, resolve the value:
//    record["nom_patient"] = patientMap.get(record["patient_id"])?.["nom"] ?? null
// 3. Write in bulk, 500 records at a time

// Before enrichment: { id: "abc", statut: "ouvert", patient_id: "p42", nom_patient: null }
// After enrichment:  { id: "abc", statut: "ouvert", patient_id: "p42", nom_patient: "Dupont" }
```

The `nom_patient` field can now be sorted or filtered directly in `_indexed`.

---

## Phase 2 — User filters (filters)

Filters are defined in the config and rendered as independent Angular components. Each one produces a list of matching IDs and publishes it in the linelist's `filterResults` signal.

### 2.1 Available filter types

| Type          | Dexie mechanism                          | Example usage                         |
|---------------|------------------------------------------|---------------------------------------|
| `text`        | `startsWithIgnoreCase()` on N fields    | Search by patient name                |
| `select`      | `equals()` or `anyOf()` (multi-select)  | Filter by status                      |
| `foreignKey`  | Autocomplete → `equals()` on FK         | Filter by linked patient              |
| `dateRange`   | `between()` (inclusive bounds)          | Filter by year or date range          |

### 2.2 Example: text filter

```typescript
// Config:
// { type: "text", key: "recherche", fields: ["nom_patient", "identifiant"] }

// data.repository.ts:246-263
async searchByText(tableName, fields, term) {
  // Parallel queries on each indexed field
  const results = await Promise.all(
    fields.map(field =>
      table.where(field).startsWithIgnoreCase(term).primaryKeys()
    )
  );
  // Union of results (OR between fields)
  const union = new Set<string>();
  for (const keys of results) keys.forEach(k => union.add(k));
  return [...union];
}

// "dup" → searches in "nom_patient" AND "identifiant" → union of found IDs
```

### 2.3 Example: multi-value select filter

```typescript
// Config:
// { type: "select", key: "statut", field: "statut", multiple: true,
//   options: [{label: "Open", value: "ouvert"}, {label: "Closed", value: "ferme"}] }

// data.repository.ts:302-307
async searchByAnyOf(tableName, field, values) {
  // values = ["ouvert", "ferme"]
  return table.where(field).anyOf(values).primaryKeys();
  // OR between selected values, within the same filter
}
```

### 2.4 Combining filters (AND)

The linelist combines all active filters by **intersection** (`linelist.component.ts:71-79`):

```typescript
readonly filteredIds = computed<string[] | null>(() => {
  const map = this.filterResults(); // Map<filterKey, string[]>
  if (map.size === 0) return null;
  const sets = [...map.values()];
  return sets.reduce((acc, ids) => {
    const lookup = new Set(ids);
    return acc.filter(id => lookup.has(id)); // AND between filters
  });
});
```

**Concrete example** with 2 active filters:

```
Filter "statut" = "ouvert"     → IDs: ["abc", "def", "ghi"]
Filter "recherche" = "Dup"     → IDs: ["def", "ghi", "xyz"]
                                        ↓  intersection
filteredIds                    → IDs: ["def", "ghi"]
```

---

## Phase 3 — Internal filters (internalFilters)

`internalFilters` are pre-computed filters that leverage Dexie **compound indexes**. They are displayed as a radio button group in the linelist and represent predefined business views (e.g. "Active cases 2024").

### 3.1 Configuration

```json
{
  "internalFilters": [
    {
      "name": "Active cases 2024",
      "index": "[statut+annee]",
      "indexWithFilter": "[id+statut+annee]",
      "value": { "statut": "ouvert", "annee": 2024 },
      "default": true
    }
  ]
}
```

Two compound indexes are required:
- `[statut+annee]` — used alone when no user filter is active.
- `[id+statut+annee]` — used to **cross** with user filter IDs.

### 3.2 Resolution in getPaginated

```typescript
// data.repository.ts:148-160
const filterVals = compoundValues("[statut+annee]", { statut: "ouvert", annee: 2024 });
// → ["ouvert", 2024]

if (filteredIds?.length) {
  // Cross: intersect user IDs with the compound index
  const compounds = filteredIds.map(id => [id, "ouvert", 2024]);
  // [["def", "ouvert", 2024], ["ghi", "ouvert", 2024]]
  effectiveFilteredIds = await indexedTable
    .where("[id+statut+annee]")
    .anyOf(compounds)
    .primaryKeys();
} else {
  // No user filter: direct query on the compound index
  effectiveFilteredIds = await indexedTable
    .where("[statut+annee]")
    .equals(["ouvert", 2024])
    .primaryKeys();
}
```

### 3.3 Key differences: filters vs internalFilters

| Aspect              | User filters (`filters`)                 | Internal filters (`internalFilters`)           |
|---------------------|------------------------------------------|------------------------------------------------|
| **Display**         | Input fields (text, select, date)        | Radio button group                             |
| **Evaluation**      | In-memory intersection (JS Set)          | Dexie compound index query                     |
| **Complexity**      | O(n) per filter                          | O(log n) via IndexedDB B-tree                  |
| **Combination**     | AND between all active filters           | Intersects with the full set of active filters |
| **Usage**           | Dynamic filters entered by the user      | Pre-optimized static business views            |

---

## Cache and page navigation

Changing page without changing filters or sort order should be **instantaneous**. To achieve this, `DataRepository` maintains two in-memory caches.

### Cache 1 — effectiveFilterCache

Memoizes the result of the intersection between user filters and the internalFilter (costly compound index query).

```typescript
// Cache key (data.repository.utils.ts:32-39):
// "isolement:[statut+annee]:{"statut":"ouvert","annee":2024}|abc,def,ghi"
//    ↑ table     ↑ internal index + values               ↑ user filter IDs (sorted)

// data.repository.ts:144-161
if (this.effectiveFilterCache?.key === effectiveCacheKey) {
  effectiveFilteredIds = this.effectiveFilterCache.effectiveFilteredIds; // cache hit
} else {
  effectiveFilteredIds = await indexedTable.where(...).anyOf(...).primaryKeys(); // compute
  this.effectiveFilterCache = { key: effectiveCacheKey, effectiveFilteredIds };  // store
}
```

**Invalidation**: the key changes as soon as the table, the selected internalFilter, or the set of filtered IDs changes.

### Cache 2 — filteredOrderCache

Memoizes the complete ordered list of matching IDs and slices it into pages.

```typescript
// Cache key (data.repository.utils.ts:21-23):
// "isolement:createdAt:DESC:abc,def,ghi"
//    ↑ table  ↑ column   ↑ dir  ↑ effective IDs (sorted)

// data.repository.ts:171-185
if (!cache || cache.key !== cacheKey || cache.pageSize !== pageSize) {
  // 1. Retrieve all IDs in sort order via Dexie
  const allOrderedIds = await indexedTable.orderBy(orderColumn).primaryKeys();

  // 2. Filter to keep only allowed IDs
  const allowedSet = new Set(effectiveFilteredIds);
  const orderedFilteredIds = allOrderedIds.filter(id => allowedSet.has(id));

  // 3. Pre-compute all pages
  const pages = new Map<number, string[]>();
  for (let p = 1; p <= Math.ceil(orderedFilteredIds.length / pageSize); p++) {
    const off = (p - 1) * pageSize;
    pages.set(p, orderedFilteredIds.slice(off, off + pageSize));
  }

  this.filteredOrderCache = { key: cacheKey, orderedFilteredIds, pageSize, pages };
}
```

### Page navigation (cache hit)

Once the caches are warm, changing page is O(1):

```typescript
// data.repository.ts:188-196
const pageIds = cache.pages.get(page) ?? []; // O(1) — lookup in pre-computed Map

// Retrieve full records from _data by their IDs
const recordMap = new Map(
  (await dataTable.where('id').anyOf(pageIds).toArray())
    .map(r => [r['id'], r])
);
// Preserve original ID order (sort order)
const rows = pageIds.map(id => recordMap.get(id));
```

### Unfiltered path

When no filter is active, the caches are bypassed entirely and native Dexie pagination is used (`data.repository.ts:206-231`):

```typescript
// Direct offset + limit on the sort index — no intersection needed
collection.offset((page - 1) * pageSize).limit(pageSize).primaryKeys()
```

### Summary: what invalidates each cache

| Event                              | effectiveFilterCache | filteredOrderCache |
|------------------------------------|:--------------------:|:------------------:|
| Page change                        | —                    | —                  |
| User filter change                 | ✓                    | ✓                  |
| internalFilter change              | ✓                    | ✓                  |
| Sort change (column/direction)     | —                    | ✓                  |
| Table change                       | ✓                    | ✓                  |

---

## Full flow — navigation example

```
1. Initial load
   └── fetchAndStore() → API pages 1..N → bulkPut into _data + _indexed
   └── enrichIndexed() → foreign joins → bulkPut into _indexed

2. User selects internalFilter "Active cases 2024"
   └── getPaginated(page=1, order=createdAt DESC, internalFilter={statut:ouvert, annee:2024})
       ├── effectiveFilterCache miss → WHERE [statut+annee] = ["ouvert", 2024] → 1 200 IDs
       ├── filteredOrderCache miss  → orderBy(createdAt).reverse() → filter → 1 200 ordered IDs
       │                           → pre-compute 120 pages of 10
       └── pages.get(1) → 10 IDs → _data.anyOf(10 IDs) → render

3. User navigates to page 5
   └── getPaginated(page=5, ...)
       ├── effectiveFilterCache HIT  → 1 200 IDs (unchanged)
       ├── filteredOrderCache HIT    → pages.get(5) → 10 IDs (O(1))
       └── _data.anyOf(10 IDs) → render

4. User adds text filter "Dup"
   └── searchByText() → 340 IDs → filterResults updated → filteredIds = 340 IDs
   └── getPaginated(page=1, filteredIds=[340 IDs], internalFilter=...)
       ├── effectiveFilterCache miss → WHERE [id+statut+annee].anyOf(340 tuples) → 87 IDs
       ├── filteredOrderCache miss  → sort + slice → 9 pages
       └── pages.get(1) → render

5. User navigates to pages 2, 3, 4…
   └── cache HIT every time → O(1)
```
