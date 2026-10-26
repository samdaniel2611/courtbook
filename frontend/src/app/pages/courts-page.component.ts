import { Component } from '@angular/core';

@Component({
  selector: 'app-courts-page', standalone: true,
  template: '<section class="courts"><h1>Courts coming soon</h1></section>',
  styles: ['.courts { padding: 4rem 1rem; text-align: center; color: #334155; } h1 { font-size: 1.8rem; }']
})
export class CourtsPageComponent {}
