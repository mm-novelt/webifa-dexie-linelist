import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DataRepository } from '../../repositories/data.repository';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { IdbObject } from '../../models/idb-object.model';

@Component({
  selector: 'app-linelist',
  standalone: true,
  templateUrl: './linelist.component.html',
  imports: [
    FormsModule,
    DatePipe,
    HeaderComponent
  ]
})
export class LinelistComponent implements OnInit {
  table = input.required<string>();

  private dataRepository = inject(DataRepository);

  rows = signal<IdbObject[]>([]);
  columns = signal<string[]>([]);

  async ngOnInit() {
    const data = await this.dataRepository.getFirst10ByCreatedAtDesc(this.table());
    this.rows.set(data);
  }
}
