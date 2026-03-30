import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from "@angular/router";
import { populateStep } from "../../db/db";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  protected populateStep = populateStep;
}
