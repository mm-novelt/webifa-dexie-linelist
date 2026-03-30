import { Injectable } from '@angular/core';
import { Config, ConfigSchema } from '../models/config.model';

@Injectable({ providedIn: 'root' })
export class ConfigRepository {
  async fetchConfig(): Promise<Config> {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to fetch config');
    const data = await res.json();
    return ConfigSchema.parse(data);
  }
}
