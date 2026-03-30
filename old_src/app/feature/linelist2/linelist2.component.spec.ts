import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Linelist2Component } from './linelist2.component';

describe('Linelist2Component', () => {
  let component: Linelist2Component;
  let fixture: ComponentFixture<Linelist2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Linelist2Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Linelist2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
