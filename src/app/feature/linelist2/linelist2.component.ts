import { ChangeDetectionStrategy, Component, computed, effect, OnInit, signal } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { RouterOutlet } from "@angular/router";
import { AsyncPipe, DatePipe, JsonPipe, KeyValuePipe } from "@angular/common";
import { Case, db } from "../../db/db";
import { isArray } from "lodash";
import { Dropdown } from "flowbite";

@Component({
  selector: 'app-linelist',
  standalone: true,
  imports: [RouterOutlet, FormsModule, JsonPipe, KeyValuePipe, AsyncPipe, DatePipe],
  templateUrl: './linelist2.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Linelist2Component implements OnInit {

  protected year: number = 2024;
  protected items: Case[] = [];
  protected itemsFiltered: Case[] = [];
  protected itemsForView: Case[] = [];

  protected dataView = signal<Case[]>([]);
  protected displayLoader = signal(false);
  protected currentPage = signal<number>(1);
  protected total = signal<string>('...');
  protected allDataAvailable = signal(false);
  protected newDataAvailable = signal(false);
  protected filterActive = computed(() => {
    const idsToPreserve = this.idsToPreserve();
    const directFilters = this.directFilter();
    return (idsToPreserve instanceof Map || directFilters instanceof Map)
  })

  private orderingField = signal('created');
  private orderingDirection = signal('desc');
  private idsToPreserve = signal<Map<string, boolean> | null>(null);
  private directFilter = signal<Map<string, any> | null>(null);

  constructor() {
    // effect(() => {
    //   if (this.displayLoader()) {
    //     this.total.set('...');
    //   }
    // }, { allowSignalWrites: true });
  }

  async ngOnInit() {

    await this.loadYear();
  }

  protected async loadYear() {


    this.displayLoader.set(true);

    const orderingField = this.orderingField();
    const orderingDirection = this.orderingDirection();
    const itemsToProcess = 1000;

    console.timeLog('data', 'Create Query');

    this.items = await db.cases.where('year').equals(this.year).sortBy(orderingField);

    console.timeLog('data', 'Data available');

    await this.directFilteringItems();
    this.allDataAvailable.set(true);

  }

  /**
   * Direct Filtering
   * @param updateViews
   * @protected
   */
  protected async directFilteringItems(updateViews: boolean = true,): Promise<void> {

    this.itemsFiltered = this.items;

    const directFilters = this.directFilter();

    if (directFilters instanceof Map) {

      for (let [key, value] of directFilters) {
        if (isArray(value)) {
          this.itemsFiltered = this.itemsFiltered.filter(item => value.includes(item[key]));
        } else {
          this.itemsFiltered = this.itemsFiltered.filter(item => item[key] == value);
        }
      }
    }

    await this.idsFilteringItems(updateViews);
  }

  /**
   * Search Engine Filtering
   * @param updateViews
   * @protected
   */
  protected async idsFilteringItems(updateViews: boolean = true): Promise<void> {

    const idsToPreserve = this.idsToPreserve();

    if (idsToPreserve instanceof Map) {
      this.itemsFiltered = this.items.filter(item => idsToPreserve?.has(item.id) ?? false);
    }

    await this.computeTotal(updateViews);
  }

  protected async computeTotal(updateViews: boolean = true): Promise<void> {

    const idsToPreserve = this.idsToPreserve();
    const directFilters = this.directFilter();

    if (updateViews) {
      this.itemsForView = this.itemsFiltered;
      await this.paginateItems();
    } else if (this.itemsForView.length !== this.itemsFiltered.length) {

      if(this.itemsForView.length === 0) {
        this.itemsForView = this.itemsFiltered;
        await this.paginateItems();
      } else {
        this.newDataAvailable.set(true);
      }
    }

    if (idsToPreserve instanceof Map || directFilters instanceof Map) {
      this.total.set(this.itemsFiltered.length.toString());
    } else {
      db.cases.where('year').equals(this.year).count().then(total => {
        this.total.set(total.toString());
      });
    }
  }

  protected async paginateItems(): Promise<void> {
    this.displayLoader.set(true);
    const currentPage = this.currentPage();
    let casesInViews = this.itemsForView.slice((currentPage - 1) * 10, currentPage * 10);
    console.timeLog('data', 'Data Paginated');
    await this.mergeRelations(casesInViews);
  }

  protected async mergeRelations(casesInViews: Case[]): Promise<void> {

    for (const currentCase of casesInViews) {
      currentCase.specimens = await db.specimens.where('case_id').equals(currentCase.id).toArray();
      currentCase.area = await db.areas.get(currentCase.area_id);
    }

    await this.updateViews(casesInViews);
  }

  protected async updateViews(cases: Case[]): Promise<void> {
    this.dataView.set(cases);
    this.displayLoader.set(false);
  }


  async searchFullText(query: string, properties: string[], relationTable: string | null = null) {

    this.displayLoader.set(true);

    if (query) {

      // Go back to first page
      this.currentPage.set(1);

      // Init query
      let searchEngineQuery = await db.searchEngine
        .where('value')
        .startsWithIgnoreCase(query);

      // Precise search

      searchEngineQuery = searchEngineQuery.filter((result) => {

        let propertyNameMatch = true;
        if (properties) {
          propertyNameMatch = properties.includes(result.property);
        }

        return propertyNameMatch;
      });

      const searchEngineResults = await searchEngineQuery.toArray();

      const ids = new Map();

      if (relationTable) {

        const relationsFounds = await db.table(relationTable)
          .where('fk_id')
          .anyOf(searchEngineResults.map(result => result.object_id))
          .toArray();

        for (const relation of relationsFounds) {
          ids.set(relation['reference_id'], true);
        }
      } else {
        for (const searchEngineResult of searchEngineResults) {
          ids.set(searchEngineResult.object_id, true);
        }
      }

      this.idsToPreserve.set(ids);
      this.directFilteringItems();
      return
    }

    this.idsToPreserve.set(null);
    this.directFilteringItems();


  }

  async searchDirect(select: HTMLSelectElement, propertyName: string) {

    this.displayLoader.set(true);
    let query: string[] | string | null = null;

    if (select.multiple) {

      query = [];
      const options = select && select.options;
      let opt;

      for (var i = 0, iLen = options.length; i < iLen; i++) {
        opt = options[i];

        if (opt.selected) {
          query.push(opt.value || opt.text);
        }
      }
    } else {
      query = select.value;
    }


    if (query) {
      const directFilter = new Map();
      directFilter.set(propertyName, query);

      // Go back to first page
      this.currentPage.set(1);
      this.directFilter.set(directFilter)
      this.directFilteringItems();
      return
    }

    this.directFilter.set(null);
    this.directFilteringItems();
  }

  async searchByRange(query: string, properties: string[], relationTable: string | null = null) {

    this.displayLoader.set(true);

    let searchEngineQuery;

    if (query) {

      if(query.indexOf('-') !== -1) {
        const range = query.split('-').filter(n => n).map(n => Number(n));

        if(range.length !== 2) {
          alert('A range must only contain two values, example: 1000-2000');
          this.displayLoader.set(false);
          return;
        }

        searchEngineQuery = await db.searchEngine
          .where('value')
          .between(Number(range[0]), Number(range[1]));
      } else if(query.indexOf(',') !== -1) {

        const series = query.split(',').filter(n => n).map(n => Number(n));

        searchEngineQuery = await db.searchEngine
          .where('value')
          .anyOf(series);

      } else {
        searchEngineQuery = await db.searchEngine
          .where('value')
          .equals(Number(query));
      }

      // Go back to first page
      this.currentPage.set(1);

      // Precise search
      searchEngineQuery = searchEngineQuery.filter((result) => {

        let propertyNameMatch = true;
        if (properties) {
          propertyNameMatch = properties.includes(result.property);
        }

        return propertyNameMatch;
      })


      const searchEngineResults = await searchEngineQuery.toArray();

      const ids = new Map();

      if (relationTable) {

        const relationsFounds = await db.table(relationTable)
          .where('fk_id')
          .anyOf(searchEngineResults.map(result => result.object_id))
          .toArray();

        for (const relation of relationsFounds) {
          ids.set(relation['case_id'], true);
        }
      } else {
        for (const searchEngineResult of searchEngineResults) {
          ids.set(searchEngineResult.object_id, true);
        }
      }

      this.idsToPreserve.set(ids);
      this.directFilteringItems();
      return
    }

    this.idsToPreserve.set(null);
    this.directFilteringItems();


  }

  changeYear(year: number, yearSelector: HTMLElement, yearDropdown: HTMLElement) {

    const drp = new Dropdown(yearDropdown, yearSelector);
    drp.hide();

    this.year = year;
    this.loadYear();


  }

  async changePage(update: number): Promise<void> {
    this.currentPage.set(this.currentPage() + update);
    await this.paginateItems();
  }

  updateNewData(): void {
    this.currentPage.set(1);
    this.newDataAvailable.set(false);
    this.directFilteringItems();
  }
}
