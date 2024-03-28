# WebIFA Dexie Line list tests

- `npm i` to install dependencies
- `ng serve --open` to start project
- Wait a few minutes for the database to fill up, enjoy


### Data

The data reflects what currently exists in the world AFP

This POC loads into an IDB at project start (see [db.ts](src/app/db/db.ts) populate method)
- 5 years of data
- 5000 areas
- 4 cases per year and per area
- between 0 and 2 specimen per case
- the cases and specimens each contain around 300 completed properties.

That's a total of 100,000 cases and around 150,000 specimens.

### Scenarios

#### Scenarios 1

- We load the first 1000 cases, then the others in the background.
- The fact that the data is not immediately available means that we must manage the arrival of new search results. In this scenario, the results are displayed progressively.


#### Scenarios 2
- We only load entirely a dataset for a given year
- The user is offered to switch between the different years available
- The filters are instantaneous, because we load all the data directly
- You cannot search in several years at the same time

### Filters refactor

In this POC, we completely change the way of searching for data. For this, we have created a table which allows us to match values with object ids. It is therefore used as a search engine.
The filter returns us an array of IDs which is then used in the filter of the data already loaded.

Three types of filters exist:
- Filter for numbers, by range, by batch or by value, (e.g. `1000-2000`, `1000,1001,10002`, `1000`)
- Full text filter, using the dexie `startWith...` method and having cut the data upstream in the index
- Direct filter, allowing a filter by equality directly on the data sets in memory
