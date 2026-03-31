import { Injectable } from '@angular/core';
import { Config, ConfigSchema } from '../models/config.model';

/**
 * Low-level repository responsible for fetching and validating the
 * application configuration from the backend.
 *
 * This class only deals with the HTTP transport layer. Query caching and
 * reactivity are handled by {@link ConfigService}.
 */
@Injectable({ providedIn: 'root' })
export class ConfigRepository {
  /**
   * Fetches the application configuration from `/api/config` and validates
   * the response against {@link ConfigSchema}.
   *
   * @returns The parsed and validated {@link Config} object.
   * @throws When the HTTP response is not OK or the payload fails validation.
   */
  async fetchConfig(): Promise<Config> {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to fetch config');
    const data = await res.json();
    return ConfigSchema.parse(data);
  }
}
