import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private db = inject(DbService);
  private router = inject(Router);

  async reset() {
    await this.db.deleteDatabase();
    this.router.navigate(['/getting-started']);
  }
}
