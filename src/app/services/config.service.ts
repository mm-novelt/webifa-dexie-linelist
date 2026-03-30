import { inject, Injectable } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { ConfigRepository } from '../repositories/config.repository';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private configRepository = inject(ConfigRepository);

  readonly query = injectQuery(() => ({
    queryKey: ['config'],
    queryFn: () => this.configRepository.fetchConfig(),
    staleTime: Infinity,
    gcTime: Infinity,
  }));
}
