import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { initFlowbite } from "flowbite";
import { FormsModule } from "@angular/forms";
import { JsonPipe, KeyValuePipe } from "@angular/common";
import { HeaderComponent } from "./shared/header/header.component";


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule, JsonPipe, KeyValuePipe, HeaderComponent],
  template: `
    <app-header></app-header>
    <router-outlet></router-outlet>
    `,
})
export class AppComponent implements OnInit {
  ngOnInit(): void {
    initFlowbite();
  }
}
