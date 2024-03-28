// db.ts
import Dexie, { Table } from 'dexie';
import { faker } from "@faker-js/faker";
import { sample as _sample } from 'lodash';
import "dexie-export-import";

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
    this.on('populate', () => this.populate());

    this.open().catch(function (e) {
      console.error("Open failed: " + e.stack);
    })
  }

  async populate() {

    const specimensToCreate = [0, 1, 2];
    const years = [2020, 2021, 2022, 2023, 2024];
    const areaYearCounter: Map<string, number> = new Map();

    const areasToInsert: Area[] = [];
    const casesToInsert: Case[] = [];
    const specimensToInsert: Specimen[] = [];
    const caseRelationsToInsert: CaseRelation[] = [];
    const searchIndexes: SearchEngine[] = [];
    const caseData: { [key: string]: any } = {};
    const areaMap: Map<number,Area> = new Map()

    for (let ii = 0; ii < 300; ii++) {
      caseData['field_' + ii] = faker.lorem.word();
    }

    for (let i = 1; i <= 5000; i++) {

      const area = {
        id: 'area_' + i,
        name: faker.location.city(),
        created: faker.date.anytime().getTime().toString()
      } as Area;
      areasToInsert.push(area);
      areaMap.set(i, area);

      this.index(area.id, 'area.name', area.name).map(index => searchIndexes.push(index));

    }

    // Create case for each years
    for (const year of years) {

      // Restart LabSerial by Year
      let currentLabSerial = 0;

      console.log('Create Data for Year: ' + year);

      for (let i = 1; i <= 5000; i++) {

        const area = areaMap.get(i) as Area;

        // Create 2 cases by area and by years
        for (let y = 1; y <= 4; y++) {

          const areaYearKey = (i + year).toString();

          if (!areaYearCounter.has(areaYearKey)) {
            areaYearCounter.set(areaYearKey, 1);
          }

          const createdDate = faker.date.between({
            from: year + '-01-01T00:00:00.000Z',
            to: year + '-12-31T23:59:59.000Z'
          }).getTime();

          const caseBid = 'AFG/' + year + '/' + i.toString().padStart(5, '0') + '/' + y.toString().padStart(4, '0');

          const afpCase: Case = {
            id: 'case_' + year.toString() + '_' + i.toString() + '_' + y.toString(),
            bid: caseBid,
            area_id: area.id,
            patientName: faker.person.fullName(),
            age: faker.number.int({ min: 18, max: 80 }),
            year: year,
            specimens: [],
            adeq: _sample(adeq),
            finalResult: _sample(finalResult),
            created: createdDate.toString(),
          } as Case;

          for (let ii = 0; ii < 200; ii++) {
            afpCase['field_' + ii] = faker.lorem.word();
          }

          Object.assign(afpCase, caseData);

          const caseAreaRelation: CaseRelation = {
            reference_id: afpCase.id,
            fk_id: area.id,
          } as CaseRelation;

          casesToInsert.push(afpCase);
          caseRelationsToInsert.push(caseAreaRelation);

          this.index(afpCase.id, 'case.area.name', area.name).map(index => searchIndexes.push(index));
          this.index(afpCase.id, 'case.bid', afpCase.bid).map(index => searchIndexes.push(index));
          this.index(afpCase.id, 'case.year', afpCase.year).map(index => searchIndexes.push(index));
          this.index(afpCase.id, 'case.finalResult', afpCase.finalResult).map(index => searchIndexes.push(index));
          this.index(afpCase.id, 'case.patientName', afpCase.patientName).map(index => searchIndexes.push(index));
          this.index(afpCase.id, 'case.age', afpCase.age).map(index => searchIndexes.push(index));
          this.index(afpCase.id, 'case.adeq', afpCase.adeq).map(index => searchIndexes.push(index));

          // Creation des specimens
          const specimensToCreateSelected = _sample(specimensToCreate) as number;

          for (let z = 1; z <= specimensToCreateSelected; z++) {

            currentLabSerial = currentLabSerial + 1;

            const specimen = {
              id: 'specimen_' + year.toString() + '_' + i.toString() + '_' + y.toString() + '_' + z.toString(),
              bid: afpCase.bid + '/' + z.toString().padStart(2, '0'),
              case_id: afpCase.id,
              labSerial: currentLabSerial,
              specimenResult: _sample(finalResult),
              created: afpCase.created
            } as Specimen;

            Object.assign(specimen, caseData);

            this.index(afpCase.id, 'case.specimen.bid', specimen.bid).map(index => searchIndexes.push(index));
            this.index(afpCase.id, 'case.specimen.labSerial', specimen.labSerial).map(index => searchIndexes.push(index));
            this.index(afpCase.id, 'case.specimen.specimenResult', specimen.specimenResult).map(index => searchIndexes.push(index));

            specimensToInsert.push(specimen);
          }
        }
      }
    }

    console.log('Start Populate Area');
    db.areas.bulkAdd(areasToInsert);
    console.log('Start Populate Cases');
    db.cases.bulkAdd(casesToInsert);
    console.log('Start Populate Specimens');
    db.specimens.bulkAdd(specimensToInsert);
    console.log('Start Populate Cases Relations');
    db.casesRelation.bulkAdd(caseRelationsToInsert);
    console.log('Start Populate Search Engine');
    db.searchEngine.bulkAdd(searchIndexes);
    console.log('End Populate');
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
