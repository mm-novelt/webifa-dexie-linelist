import { inject, Injectable } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { ConfigRepository } from '../repositories/config.repository';

/**
 * Application-wide service that exposes the remote configuration as a
 * TanStack Query result.
 *
 * The query is marked with `staleTime: Infinity` and `gcTime: Infinity` so
 * the configuration is fetched exactly once per application lifetime and
 * kept in memory until the page is reloaded.
 *
 * Inject this service wherever the config is needed and consume
 * `configService.query.data()` to access the resolved {@link Config} value.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private configRepository = inject(ConfigRepository);

  /** TanStack Query instance for the application configuration. */
  readonly query = injectQuery(() => ({
    queryKey: ['config'],
    queryFn: () => this.configRepository.fetchConfig(),
    staleTime: Infinity,
    gcTime: Infinity,
  }));
}
