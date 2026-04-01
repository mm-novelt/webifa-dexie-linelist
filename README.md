# WebifaDexie

A prototype demonstrating large-scale data management in the browser using IndexedDB (Dexie), Angular 21, and TanStack Query. The backend is a lightweight PHP/Symfony API that generates fake epidemiological data.

## Prerequisites

- **Node.js** with npm 11+
- **PHP 8.5+** with the `apcu` extension enabled
- **Composer**

## Project structure

```
/
├── api/          # PHP/Symfony micro-kernel backend
└── src/          # Angular frontend
```

## Starting the backend (PHP API)

The API serves fake data (cases, specimens, areas) and relies on APCu for in-memory caching.

```bash
cd api
php -d apc.enable_cli=1 -S localhost:8000 index.php
```

> The API will be available at `http://localhost:8000`. APCu must be enabled — verify with `php -m | grep apcu`.

Available endpoints:
- `GET /api/config` — application configuration and linelist schema
- `GET /api/data/areas?page=1` — paginated area records (30 000 total)
- `GET /api/data/cases?page=1` — paginated case records (30 000 total)
- `GET /api/data/specimens?page=1` — paginated specimen records (60 000 total)

## Starting the frontend (Angular)

```bash
npm install
npm start
```

The application will be available at `http://localhost:4200/` and reloads automatically on file changes.

## Building for production

```bash
npm run build
```

Output is placed in the `dist/` directory.

## Running tests

```bash
npm test
```

Uses [Vitest](https://vitest.dev/) as the test runner.
