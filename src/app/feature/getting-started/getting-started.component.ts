import { Component, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { ConfigService } from '../../services/config.service';
import { DataFetchRepository, TableFetchProgress } from '../../repositories/data-fetch.repository';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'flex justify-center items-center min-h-screen bg-gradient-to-br from-white via-blue-50 to-sky-200' },
  template: `
    <div class="w-full max-w-sm">
      <!-- Logo & Brand -->
      <div class="flex flex-col items-center mb-8">
        <img
          src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4OC4wOCAxMDEuNTciPgogIDxkZWZzPgogICAgPHN0eWxlPi5jbHMtMSB7CiAgICAgIGZpbGw6ICMwMDcxYWE7CiAgICB9CgogICAgLmNscy0yIHsKICAgICAgb3BhY2l0eTogMC4xMTsKICAgIH0KCiAgICAuY2xzLTMgewogICAgICBmaWxsOiAjZmZmOwogICAgfQoKICAgIC5jbHMtNCB7CiAgICAgIG9wYWNpdHk6IDAuMjc7CiAgICB9CgogICAgLmNscy01IHsKICAgICAgb3BhY2l0eTogMC4yODsKICAgIH0KCiAgICAuY2xzLTYgewogICAgICBmaWxsOiAjNDBiMGRkOwogICAgfTwvc3R5bGU+CiAgPC9kZWZzPgogIDxnIGlkPSJDYWxxdWVfMiIgZGF0YS1uYW1lPSJDYWxxdWUgMiI+CiAgICA8ZyBpZD0iQ2FscXVlXzEtMiIgZGF0YS1uYW1lPSJDYWxxdWUgMSI+CiAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0xIiBjeD0iNDQuMDQiIGN5PSI0NC4zIiByPSI0MC42OCIvPgogICAgICA8ZyBjbGFzcz0iY2xzLTIiPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjguNzUiIGN5PSIyNi44NSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjguNzUiIGN5PSIzMy43NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjguNzUiIGN5PSI0MC42NyIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMzUuNjYiIGN5PSI0MC42NyIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMzUuNjYiIGN5PSIzMy43NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNDIuNTciIGN5PSIzMy43NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNTUuODYiIGN5PSIyNi44NSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNjIuNzciIGN5PSIyNi44NSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNDkuNDciIGN5PSIzMy43NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNTYuMzgiIGN5PSIzMy43NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNjMuMjkiIGN5PSIzMy43NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNzAuMiIgY3k9IjMzLjc2IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI1Ni4zOCIgY3k9IjQwLjY3IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI1Ni4zOCIgY3k9IjQ3LjU4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI0OS40NyIgY3k9IjQ3LjU4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI0Mi41NyIgY3k9IjU0LjQ4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIzNS42NiIgY3k9IjU0LjQ4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIyOC43NSIgY3k9IjU0LjQ4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIyMS44NCIgY3k9IjU0LjQ4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIyMS44NCIgY3k9IjQ3LjU4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIyMS44NCIgY3k9IjQwLjY3IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIxNC45MyIgY3k9IjQwLjY3IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIxNC45MyIgY3k9IjMzLjc2IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI4LjAyIiBjeT0iMzMuNzYiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjguMDIiIGN5PSI0Ny41OCIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iOC4wMiIgY3k9IjI2Ljg1IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI0OS40NyIgY3k9IjU0LjQ4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI0OS40NyIgY3k9IjYxLjM5IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI3Ny4xMSIgY3k9IjQwLjY3IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI1Ni4zOCIgY3k9IjYxLjM5IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI2My4yOSIgY3k9IjYxLjM5IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI2My4yOSIgY3k9IjU0LjQ4IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI3MC4yIiBjeT0iNTQuNDgiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjcwLjIiIGN5PSI2MS4zOSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNzcuMTEiIGN5PSI2MS4zOSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjEuODQiIGN5PSI2MS41MiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjguNzUiIGN5PSI2MS41MiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMTQuOTMiIGN5PSI1NC41NSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMTQuOTMiIGN5PSI2MS40NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iOC4wMiIgY3k9IjYxLjQ2IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI4LjAyIiBjeT0iNTQuNTUiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9Ijg0LjAyIiBjeT0iNDAuNjciIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9Ijg0LjAyIiBjeT0iMzMuNzYiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9Ijc3LjExIiBjeT0iMzMuNzYiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9Ijc3LjExIiBjeT0iNDcuNTgiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9Ijc3LjExIiBjeT0iMjYuODUiIHI9IjIuNTkiLz4KICAgICAgPC9nPgogICAgICA8ZyBjbGFzcz0iY2xzLTIiPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNTYuMzgiIGN5PSI1LjYyIiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI0OS40NyIgY3k9IjUuNjIiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjQyLjU3IiBjeT0iMTIuNTMiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjM1LjY2IiBjeT0iMTIuNTMiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjI4Ljc1IiBjeT0iMTIuNTMiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjIxLjg0IiBjeT0iMTIuNTMiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjQ5LjQ3IiBjeT0iMTIuNTMiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjQ5LjQ3IiBjeT0iMTkuNDQiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjU2LjM4IiBjeT0iMTkuNDQiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjYzLjI5IiBjeT0iMTkuNDQiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjYzLjI5IiBjeT0iMTIuNTMiIHI9IjIuNTkiLz4KICAgICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMyIgY3g9IjcwLjIiIGN5PSIxMi41MyIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNzAuMiIgY3k9IjE5LjQ0IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSI3Ny4xMSIgY3k9IjE5LjQ0IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIyMS44NCIgY3k9IjE5LjU3IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIyOC43NSIgY3k9IjE5LjU3IiByPSIyLjU5Ii8+CiAgICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTMiIGN4PSIxNC45MyIgY3k9IjE5LjUiIHI9IjIuNTkiLz4KICAgICAgPC9nPgogICAgICA8ZyBjbGFzcz0iY2xzLTIiPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNDEuODciIGN5PSI2OS4wNSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMzQuOTYiIGN5PSI2OS4wNSIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjguMDUiIGN5PSI3NS45NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMjEuMTQiIGN5PSI3NS45NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMzQuOTYiIGN5PSI3NS45NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iMzQuOTYiIGN5PSI4Mi44NyIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNDEuODciIGN5PSI4Mi44NyIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNDguNzgiIGN5PSI4Mi44NyIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNDguNzgiIGN5PSI3NS45NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNjkuMzkiIGN5PSI3NS45NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNTUuNjkiIGN5PSI3NS45NiIgcj0iMi41OSIvPgogICAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy0zIiBjeD0iNTUuNjkiIGN5PSI4Mi44NyIgcj0iMi41OSIvPgogICAgICA8L2c+CiAgICAgIDxnIGNsYXNzPSJjbHMtNCI+CiAgICAgICAgPHBhdGggY2xhc3M9ImNscy0zIgogICAgICAgICAgICAgIGQ9Ik02NS4xNCw2NS41NWMtNy4zLDAtMTAuNS0xMS4xNy0xMy41OS0yMkM0OS4wNiwzNC44OCw0Ni4yNCwyNSw0MiwyNUg0MS45Yy00LjQxLjA4LTYuODksOC41OS05LjI5LDE2LjgxQzI5LjgzLDUxLjM1LDI3LDYxLjIsMjAsNjEuMmMtNS44MywwLTguNDQtNy4wOS0xMS4yLTE0LjZDNy4xMSw0Mi4xMyw1LjQxLDM3LjUxLDMsMzQuMTNsMi41Ni0xLjgyQzguMjEsMzYsMTAsNDAuODUsMTEuNzEsNDUuNTEsMTQuMDgsNTIsMTYuMzIsNTguMDUsMjAsNTguMDVjNC42NCwwLDcuMTgtOC42OSw5LjYzLTE3LjExLDIuODQtOS43NSw1LjUzLTE5LDEyLjI1LTE5LjA3SDQyYzYuNjUsMCw5LjU1LDEwLjEzLDEyLjYyLDIwLjg1QzU3LjIyLDUyLDYwLjIxLDYyLjQxLDY1LjE0LDYyLjQxYzUuODYsMCw5LjYyLTguNjEsMTMuNi0xNy43MSwxLjIzLTIuODIsMi41LTUuNzQsMy44Ny04LjQ3bDIuODEsMS40MWMtMS4zMywyLjY2LTIuNTksNS41My0zLjgsOC4zMUM3Ny4yMiw1Niw3My4wNiw2NS41NSw2NS4xNCw2NS41NVoiLz4KICAgICAgPC9nPgogICAgICA8ZyBjbGFzcz0iY2xzLTUiPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMyIKICAgICAgICAgICAgICBkPSJNNTEuMjIsNTcuNzVjLTcuNTQsMC0xNC40My00LjY2LTIxLjA5LTkuMTYtNS44Mi0zLjk0LTExLjMyLTcuNjUtMTYuNTMtNy42NS00LDAtOCwxLjczLTEwLjYxLDMuMThsLS40NS0uODNDNS4yOCw0MS43OCw5LjQzLDQwLDEzLjYsNDBjNS41MSwwLDExLjEyLDMuNzksMTcuMDYsNy44MSw2LjU1LDQuNDIsMTMuMzEsOSwyMC41Niw5LDYuMzksMCwxMC4wOC0zLjE1LDEzLjY1LTYuMiwzLjIxLTIuNzUsNi4yNS01LjM0LDEwLjktNS4zNGExOS43NSwxOS43NSwwLDAsMSw5LjE3LDIuNDhsLS40My44NWExOC44NiwxOC44NiwwLDAsMC04Ljc0LTIuMzhjLTQuMywwLTcuMjEsMi40OC0xMC4yOCw1LjExQzYyLDU0LjMzLDU4LDU3Ljc1LDUxLjIyLDU3Ljc1WiIvPgogICAgICA8L2c+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMyIKICAgICAgICAgICAgZD0iTTE2LjMxLDYxLjIxYS41NS41NSwwLDAsMS0uMTctLjQyVjI4YS41NC41NCwwLDAsMSwuMTctLjQxLjU3LjU3LDAsMCwxLC40MS0uMTdoNS42N2EuNTcuNTcsMCwwLDEsLjQxLjE3QS41NC41NCwwLDAsMSwyMywyOFY2MC43OWEuNTUuNTUsMCwwLDEtLjE3LjQyLjU3LjU3LDAsMCwxLS40MS4xN0gxNi43MkEuNTcuNTcsMCwwLDEsMTYuMzEsNjEuMjFaIi8+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMyIKICAgICAgICAgICAgZD0iTTUwLjMsMzMuMTNhLjU4LjU4LDAsMCwxLS40MS4xN0gzNGEuMjEuMjEsMCwwLDAtLjI0LjI0djcuNTJhLjIxLjIxLDAsMCwwLC4yNC4yNEg0NC40NWEuNTkuNTksMCwwLDEsLjQyLjE3LjU3LjU3LDAsMCwxLC4xNy40MXY0LjcxYS41Ny41NywwLDAsMS0uMTcuNDEuNTkuNTksMCwwLDEtLjQyLjE3SDM0YS4yMS4yMSwwLDAsMC0uMjQuMjRWNjAuNzlhLjU4LjU4LDAsMCwxLS41OS41OUgyNy41M2EuNTcuNTcsMCwwLDEtLjQxLS4xNy41OS41OSwwLDAsMS0uMTctLjQyVjI4YS41OC41OCwwLDAsMSwuMTctLjQxLjU3LjU3LDAsMCwxLC40MS0uMTdINDkuODlhLjU4LjU4LDAsMCwxLC41OC41OHY0LjcxQS41Ny41NywwLDAsMSw1MC4zLDMzLjEzWiIvPgogICAgICA8cGF0aCBjbGFzcz0iY2xzLTMiCiAgICAgICAgICAgIGQ9Ik02Ny4zOSw2MC44OWwtMS40NS00Ljc1Yy0uMDctLjEzLS4xNS0uMTktLjI1LS4xOUg1My43NmMtLjA5LDAtLjE3LjA2LS4yNC4xOWwtMS40LDQuNzVhLjYyLjYyLDAsMCwxLS42My40OUg0NS4zM2EuNTYuNTYsMCwwLDEtLjQ0LS4xNy41NC41NCwwLDAsMSwwLS41MUw1NS4zMiwyNy45MmEuNi42LDAsMCwxLC42My0uNDloNy42MWEuNjEuNjEsMCwwLDEsLjYzLjQ5TDc0LjY2LDYwLjdhLjQzLjQzLDAsMCwxLDAsLjI0YzAsLjI5LS4xNy40NC0uNTMuNDRINjhBLjYyLjYyLDAsMCwxLDY3LjM5LDYwLjg5Wk01NS40Niw1MC42Nmg4LjU3Yy4xOSwwLC4yNi0uMS4xOS0uMjlMNTkuODMsMzZjMC0uMTMtLjA4LS4xOS0uMTUtLjE3cy0uMTEuMDctLjE0LjE3bC00LjI3LDE0LjRDNTUuMjQsNTAuNTYsNTUuMyw1MC42Niw1NS40Niw1MC42NloiLz4KICAgICAgPHBhdGggY2xhc3M9ImNscy02IgogICAgICAgICAgICBkPSJNODguMDgsNDRBNDQsNDQsMCwxLDAsMjYsODQuMjFoMHM5LjU0LDQuNTksMTYuOCwxNi42NmExLjQzLDEuNDMsMCwwLDAsMi40NiwwYzcuMDctMTIuMDcsMTYuOTItMTYuNjUsMTYuOTItMTYuNjVoMEE0NCw0NCwwLDAsMCw4OC4wOCw0NFpNNDQsODNBMzguNzMsMzguNzMsMCwxLDEsODIuNzcsNDQuMywzOC43MywzOC43MywwLDAsMSw0NCw4M1oiLz4KICAgIDwvZz4KICA8L2c+Cjwvc3ZnPgo="
          class="h-16 w-16 drop-shadow-lg"
          alt="Webifa"
        />
        <span class="mt-3 text-3xl font-bold text-blue-800 tracking-wide">Webifa</span>
        <span class="text-blue-400 text-sm mt-1">WebIFA Linelist poc</span>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-2xl p-6">
        @if (!isLoggedIn()) {
          <p class="text-gray-500 text-xs mb-4 text-center">Connectez-vous pour continuer</p>
          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-600 mb-1">Nom d'utilisateur</label>
            <input
              [(ngModel)]="username"
              type="text"
              class="w-full px-3 py-1.5 text-sm rounded-md bg-white border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div class="mb-5">
            <label class="block text-xs font-medium text-gray-600 mb-1">Mot de passe</label>
            <input
              [(ngModel)]="password"
              type="password"
              class="w-full px-3 py-1.5 text-sm rounded-md bg-white border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            (click)="login()"
            class="w-full px-3 py-1.5 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
            Se connecter
          </button>
        } @else {
          <p class="text-gray-500 text-xs mb-4 text-center">Chargement des données, veuillez patienter</p>
          @if (query.isPending()) {
            <p class="text-sm font-medium text-gray-700 text-center">Initialisation...</p>
          } @else if (query.isError()) {
            <p class="text-sm font-medium text-red-500 text-center">Erreur lors du chargement de la configuration.</p>
          } @else if (isFetching() || isDone()) {
            <p class="text-sm font-medium text-gray-700 mb-4 text-center">{{ isDone() ? 'Chargement terminé.' : 'Chargement des données...' }}</p>
            @for (progress of tableProgressList(); track progress.tableName) {
              <div class="mb-3">
                <div class="flex justify-between text-xs mb-1">
                  <span class="font-medium text-gray-700">{{ progress.tableName }}</span>
                  <span class="text-gray-400">{{ progress.recordsLoaded }}/{{ progress.total }} ({{ progress.percent }}%)</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    [class]="progress.done ? 'bg-emerald-500' : 'bg-blue-600'"
                    class="h-1.5 rounded-full transition-all duration-300"
                    [style.width.%]="progress.percent"
                  ></div>
                </div>
              </div>
            }
            @if (isDone()) {
              <button
                (click)="startApplication()"
                class="mt-4 w-full px-3 py-1.5 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
                Démarrer l'application
              </button>
            }
          }
        }
      </div>
    </div>
  `,
})
export class GettingStartedComponent {
  private db = inject(DbService);
  private configService = inject(ConfigService);
  private dataFetchRepository = inject(DataFetchRepository);
  private router = inject(Router);

  query = this.configService.query;

  isLoggedIn = signal(false);
  username = 'admin';
  password = 'password123';

  isFetching = signal(false);
  isDone = signal(false);

  private tableProgressSignals = signal<WritableSignal<TableFetchProgress>[]>([]);
  tableProgressList = computed(() => this.tableProgressSignals().map((s) => s()));

  constructor() {
    effect(async () => {
      if (!this.isLoggedIn()) return;

      const config = this.query.data();
      if (!config) return;

      if (!this.db.isInitialized) {
        await this.db.initialize(config.tables);
      }

      const entries = Object.entries(config.fetch);
      if (entries.length === 0) {
        this.isDone.set(true);
        return;
      }

      const progressSignals = entries.map(([tableName]) =>
        signal<TableFetchProgress>({ tableName, recordsLoaded: 0, total: 0, percent: 0, done: false }),
      );

      this.tableProgressSignals.set(progressSignals);
      this.isFetching.set(true);

      await Promise.all(
        entries.map(async ([tableName, url], i) => {
          const count = await this.db.instance.table(tableName).count();
          if (count > 0) {
            progressSignals[i].set({ tableName, recordsLoaded: count, total: count, percent: 100, done: true });
          } else {
            await this.dataFetchRepository.fetchAndStore(tableName, url, progressSignals[i]);
          }
        }),
      );

      this.isFetching.set(false);
      this.isDone.set(true);
    });
  }

  login() {
    this.isLoggedIn.set(true);
  }

  startApplication() {
    this.router.navigate(['/linelist', 'cases']);
  }
}
