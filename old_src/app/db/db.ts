// db.ts
import Dexie, { Table } from 'dexie';
import { faker } from "@faker-js/faker";
import { sample as _sample } from 'lodash';
import "dexie-export-import";
import { signal } from '@angular/core';

export const populateStep = signal<string | null>(null);

export interface Case {
  id: string;
  bid: string,
  area_id: string,
  area?: Area | null,
  age: number,
  patientName: string,
  adeq: string,
  year: number,
  specimens: Specimen[]
  finalResult: string,
  created: string,
  [key: string]: any,
}

interface CaseRelation {
  reference_id: string,
  fk_id: string,
}

interface SearchEngine {
  object_id: string,
  property: string,
  value: string | number,
}

export interface Area {
  id: string,
  name: string,
  created: string,
}

export interface Specimen {
  id: string,
  bid: string,
  case_id: string,
  case?: Case | null,
  labSerial: number,
  specimenResult: string,
  created: string,
}

interface PopulateYearParams {
  year: number;
  areaCount: number;
  casesPerArea: number;
  maxSpecimens: number;
}

export class AppDB extends Dexie {

  cases!: Table<Case, string>;
  casesRelation!: Table<CaseRelation, string>;
  areas!: Table<Area, string>;
  specimens!: Table<Specimen, string>;
  searchEngine!: Table<SearchEngine, string>;

  constructor() {
    super('webifa-dexie');
    console.log('Construct DB');
    this.version(2).stores({
      cases: 'id,bid,year,adeq,created',
      casesRelation: '++id,reference_id,fk_id',
      areas: 'id,name,created',
      specimens: 'id,bid,case_id,created',
      searchEngine: '++id,property,value',
    });

    // Données initiales rapides — dans la versionchange transaction, pas de setTimeout possible
    this.on('populate', async () => {
      await this.populateAreas(1000);
      await this.populateYear({ year: 2025, areaCount: 1000, casesPerArea: 5000, maxSpecimens: 1 });
    });

    // Populate en arrière-plan — on('ready') s'exécute hors transaction, setTimeout est sûr
    // this.on('ready', () => this.backgroundPopulate());
  }

  // private async backgroundPopulate(): Promise<void> {
  //   const areasCount = await db.areas.count();
  //   const count2023 = await db.cases.where('year').equals(2023).count();
  //   if (areasCount >= 10000 && count2023 > 0) return; // Déjà peuplé
  //
  //   (async () => {
  //     await this.populateAreas(10000);
  //     for (const year of [2023, 2024]) {
  //       const yearCount = await db.cases.where('year').equals(year).count();
  //       if (yearCount === 0) {
  //         await this.populateYear({ year, areaCount: 10000, casesPerArea: 4, maxSpecimens: 2 });
  //       }
  //     }
  //     populateStep.set(null);
  //   })();
  // }

  private async populateAreas(count: number): Promise<void> {
    const existingCount = await db.areas.count();
    if (existingCount >= count) return;

    populateStep.set('areas');
    const areasToInsert: Area[] = [];
    const searchIndexes: SearchEngine[] = [];

    for (let i = existingCount + 1; i <= count; i++) {
      const area: Area = {
        id: 'area_' + i,
        name: faker.location.city(),
        created: faker.date.anytime().getTime().toString(),
      };
      areasToInsert.push(area);
      this.index(area.id, 'area.name', area.name).forEach(idx => searchIndexes.push(idx));
    }

    await db.areas.bulkAdd(areasToInsert);
    await db.searchEngine.bulkAdd(searchIndexes);
    console.log(`Areas populated: ${count}`);
  }

  async populateYear(params: PopulateYearParams): Promise<void> {
    const { year, areaCount, casesPerArea, maxSpecimens } = params;

    console.log(`Populate year ${year} — areas: ${areaCount}, cases/area: ${casesPerArea}, max specimens: ${maxSpecimens}`);

    // Génération des cases, specimens et index
    populateStep.set(`${year} — cases`);
    const casesToInsert: Case[] = [];
    const specimensToInsert: Specimen[] = [];
    const caseRelationsToInsert: CaseRelation[] = [];
    const searchIndexes: SearchEngine[] = [];
    let currentLabSerial = 0;

    for (let j = 1; j <= casesPerArea; j++) {

      populateStep.set(`${year} — cases ${j} / ${casesPerArea}`);

      const randomAreaIndex = faker.number.int({ min: 1, max: areaCount });
      const area = await db.areas.get('area_' + randomAreaIndex);

      if(!area) {
        throw new Error(`Area ${randomAreaIndex} not found`);
      }

      const createdDate = faker.date.between({
        from: year + '-01-01T00:00:00.000Z',
        to: year + '-12-31T23:59:59.000Z',
      }).getTime();

      const caseBid = 'AFG/' + year + '/' + j.toString().padStart(8, '0');

      const afpCase: Case = {
        id: 'case_' + year + '_' + j,
        bid: caseBid,
        area_id: 'area_'+randomAreaIndex,
        patientName: faker.person.fullName(),
        age: faker.number.int({ min: 18, max: 80 }),
        year,
        specimens: [],
        adeq: _sample(adeq) as string,
        finalResult: _sample(finalResult) as string,
        created: createdDate.toString(),
      } as Case;

      for (let ii = 0; ii < 200; ii++) {
        afpCase['field_' + ii] = faker.lorem.word();
      }

      casesToInsert.push(afpCase);
      caseRelationsToInsert.push({ reference_id: afpCase.id, fk_id: area.id } as CaseRelation);

      this.index(afpCase.id, 'case.area.name', area.name).forEach(idx => searchIndexes.push(idx));
      this.index(afpCase.id, 'case.bid', afpCase.bid).forEach(idx => searchIndexes.push(idx));
      this.index(afpCase.id, 'case.year', afpCase.year).forEach(idx => searchIndexes.push(idx));
      this.index(afpCase.id, 'case.finalResult', afpCase.finalResult).forEach(idx => searchIndexes.push(idx));
      this.index(afpCase.id, 'case.patientName', afpCase.patientName).forEach(idx => searchIndexes.push(idx));
      this.index(afpCase.id, 'case.age', afpCase.age).forEach(idx => searchIndexes.push(idx));
      this.index(afpCase.id, 'case.adeq', afpCase.adeq).forEach(idx => searchIndexes.push(idx));

      const specimensCount = faker.number.int({ min: 0, max: maxSpecimens });
      for (let z = 1; z <= specimensCount; z++) {
        currentLabSerial++;
        const specimen: Specimen = {
          id: 'specimen_' + year + '_' + j + '_' + z,
          bid: afpCase.bid + '/' + z.toString().padStart(2, '0'),
          case_id: afpCase.id,
          labSerial: currentLabSerial,
          specimenResult: _sample(finalResult) as string,
          created: afpCase.created,
        } as Specimen;

        this.index(afpCase.id, 'case.specimen.bid', specimen.bid).forEach(idx => searchIndexes.push(idx));
        this.index(afpCase.id, 'case.specimen.labSerial', specimen.labSerial).forEach(idx => searchIndexes.push(idx));
        this.index(afpCase.id, 'case.specimen.specimenResult', specimen.specimenResult).forEach(idx => searchIndexes.push(idx));

        specimensToInsert.push(specimen);
      }
    }

    populateStep.set(`${year} — inserting cases`);
    await db.cases.bulkAdd(casesToInsert);
    populateStep.set(`${year} — inserting specimens`);
    await db.specimens.bulkAdd(specimensToInsert);
    populateStep.set(`${year} — inserting relations`);
    await db.casesRelation.bulkAdd(caseRelationsToInsert);
    populateStep.set(`${year} — populating search indexes`);
    await db.searchEngine.bulkAdd(searchIndexes);

    populateStep.set(null);
  }

  private explodeStringForIndexing(separator: string, value: string): string[] {

    const valuesToIndex: string[] = [];

    if(value.indexOf(separator) !== -1 ) {
      value = value.split(separator).map(val => {
        valuesToIndex.push(val.trim());
      }).join(' ');
    }

    value.split(' ').map(val => {
      valuesToIndex.push(val.trim());
    });

    return valuesToIndex;
  }

  private index(objectId: string, propertyName: string, value: string | number): SearchEngine[] {

    let valuesToIndex: Array<string | number> = [];

    valuesToIndex.push(value);

    // Split by space, comma and backSlash
    if (typeof value === 'string') {

      if(value.indexOf('/') !== -1 ) {
        valuesToIndex = valuesToIndex.concat(this.explodeStringForIndexing('/', value));
      } else if(value.indexOf(',') !== -1 ) {
        valuesToIndex = valuesToIndex.concat(this.explodeStringForIndexing(',', value));
      } else {
        value.split(' ').map(val => {
          valuesToIndex.push(val.trim());
        });
      }
    }

    return valuesToIndex.map((valueToIndex) => {
      return {
        object_id: objectId,
        property: propertyName,
        value: valueToIndex
      } as SearchEngine;
    });
  }
}

export const db = new AppDB();


export const adeq = [
  'ADEQ',
  'INADEQ',
  'PENDING',
  'UNKNOWN'
];

export const finalResult = [
  'SL1',
  'PV2+_nOPV2_not-tested, UNDER PROCESS',
  'NSL2, UNDER PROCESS',
  'SL1 DISCORDANT, UNDER PROCESS',
  'VDPV1',
  'aVDPV3',
  'SL2 DISCORDANT, UNDER PROCESS',
  'WPV1, SL3',
  'PV2+_nOPV2+, UNDER PROCESs',
  'WPV3, SL1',
  'SL3',
  'iVDPV2-n',
  'NSL2',
  'iVDPV3',
  'NSL2, SL2, UNDER PROCESS',
  'WPV1',
  'WPV3, SL3',
  'cVDPV1',
  'WPV3',
  'Negative',
  'NPEV',
  'cVDPV2',
  'SL1, SL3, NPEV',
  'WPV2',
  'aVDPV2-n',
  'NSL3, UNDER PROCESS',
  'NSL1, SL1, UNDER PROCESS',
  'SL2, UNDER PROCESS',
  'WPV1, SL3, PV2+_nOPV2-, Under Process',
  'PV2+_nOPV2-, UNDER PROCESS',
  'NSL3, SL3, UNDER PROCESS',
  'SL3 DISCORDANT, UNDER PROCESS',
  'SL1, SL3 DISCORDANT, UNDER PROCESS',
  'VDPV2',
  'VDPV2-n',
  'Not done',
  'iVDPV2',
  'NSL1, SL1, PV2+_nOPV2-, NPEV, UNDER PROCESS',
  'cVDPV2-n',
  'nOPV2-L',
  'WPV1, SL1',
  'SL2',
  'VDPV3',
  'iVDPV1',
  'cVDPV3',
  'aVDPV1',
  'WPV2, SL2',
  'aVDPV2',
  'NSL1, NSL3, UNDER PROCESS',
];
