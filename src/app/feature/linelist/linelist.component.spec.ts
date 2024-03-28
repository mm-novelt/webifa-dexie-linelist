import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinelistComponent } from './linelist.component';

describe('RecViewerComponent', () => {
  let component: LinelistComponent;
  let fixture: ComponentFixture<LinelistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinelistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LinelistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
