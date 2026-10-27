import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { CourtService } from '../court.service';
import { CourtMapComponent } from './court-map.component';
import { CourtsPageComponent } from './courts-page.component';

@Component({ selector: 'app-court-map', standalone: true, template: '' })
class MockCourtMapComponent {
  @Input() courts = [];
  @Input() center: [number, number] = [0, 0];
  @Input() selectedId: string | null = null;
  @Output() courtSelected = new EventEmitter<string>();
  focusCourt(): void {}
}

describe('CourtsPageComponent', () => {
  let fixture: ComponentFixture<CourtsPageComponent>;
  let getNearby: jasmine.Spy;

  beforeEach(() => {
    getNearby = jasmine.createSpy().and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [CourtsPageComponent],
      providers: [{ provide: CourtService, useValue: { getNearby } }]
    }).overrideComponent(CourtsPageComponent, {
      remove: { imports: [CourtMapComponent] },
      add: { imports: [MockCourtMapComponent] }
    });
  });

  it('shows the empty state when the service returns no courts', fakeAsync(() => {
    fixture = TestBed.createComponent(CourtsPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.empty'))?.nativeElement.textContent).toContain('No courts within 5 km');
    fixture.destroy();
  }));
});
