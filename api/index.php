<?php

require_once __DIR__ . '/vendor/autoload_runtime.php';

use Faker\Factory;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;

class Kernel extends BaseKernel
{
  use MicroKernelTrait;

  protected function configureContainer(ContainerConfigurator $container): void
  {
    $container->extension('framework', [
      'secret' => 'my_secret',
    ]);
  }

  protected function configureRoutes(RoutingConfigurator $routes): void
  {
    $routes->import(static::class, 'attribute');
  }

  private function makeSpecimenUlid(int $index): string
  {
    return sprintf('01SPEC%020d', $index);
  }

  private function makeAreaUlid(int $index): string
  {
    return sprintf('01AREA%020d', $index);
  }

  private function makeCaseUlid(int $index): string
  {
    return sprintf('01CASE%020d', $index);
  }

  private function makeExtraFields(\Faker\Generator $faker): array
  {
    $cacheKey = 'extra_fields_500';
    $cached = apcu_fetch($cacheKey, $success);
    if ($success) {
      return $cached;
    }
    $fields = [];
    for ($f = 1; $f <= 10; $f++) {
      $pick = $faker->numberBetween(0, 2);
      $fields["field_{$f}"] = match ($pick) {
        0 => null,
        1 => $faker->lexify(str_repeat('?', $faker->numberBetween(3, 20))),
        2 => $faker->numberBetween(0, 99999),
      };
    }
    apcu_store($cacheKey, $fields);
    return $fields;
  }

  #[Route('/api/data/areas', name: 'api_data_areas')]
  public function dataAreas(Request $request): JsonResponse
  {
    $total = 30000;
    $perPage = 1000;
    $totalPages = (int)ceil($total / $perPage);
    $page = max(1, min((int)$request->query->get('page', 1), $totalPages));

    $cacheKey = "api_data_areas_page_{$page}";
    $cached = apcu_fetch($cacheKey, $success);
    if ($success) {
      return new JsonResponse($cached);
    }

    $offset = ($page - 1) * $perPage;

    $faker = Factory::create('en_EN');
    $faker->seed(42);

    $nameCounts = [];
    $areas = [];

    for ($i = 0; $i < $offset + $perPage; $i++) {
      $year = 2024 + (int)floor($i / 30000);
      $base = $faker->city();
      if (!isset($nameCounts[$base])) {
        $nameCounts[$base] = 0;
        $name = $base;
      } else {
        $nameCounts[$base]++;
        $name = $base . ' ' . $nameCounts[$base];
      }
      if ($i >= $offset) {
        $areas[] = [
          'id' => $this->makeAreaUlid($i),
          'name' => $name,
          'createdAt' => $faker->dateTimeBetween("{$year}-01-01", "{$year}-12-31")->format('Y-m-d H:i:s')
        ];
      }
    }

    $response = [
      'data' => $areas,
      'meta' => [
        'total' => $total,
        'perPage' => $perPage,
        'totalPages' => $totalPages,
        'page' => $page,
        'hasNext' => $page < $totalPages,
        'hasPrev' => $page > 1,
      ],
    ];
    apcu_store($cacheKey, $response);
    return new JsonResponse($response);
  }

  #[Route('/api/data/cases', name: 'api_data_cases')]
  public function dataCases(Request $request): JsonResponse
  {
    $total = 30000;
    $perPage = 1000;
    $totalPages = (int)ceil($total / $perPage);
    $page = max(1, min((int)$request->query->get('page', 1), $totalPages));

    $cacheKey = "api_data_cases_page_{$page}";
    $cached = apcu_fetch($cacheKey, $success);
    if ($success) {
      return new JsonResponse($cached);
    }

    $offset = ($page - 1) * $perPage;

    $faker = Factory::create('en_EN');
    $faker->seed(99);

    $finalResults = [
      'SL1',
      'PV2+_nOPV2_not-tested, UNDER PROCESS',
      'NSL2, UNDER PROCESS',
      'SL1 DISCORDANT, UNDER PROCESS',
      'VDPV1',
      'aVDPV3',
      'SL2 DISCORDANT, UNDER PROCESS',
      'WPV1, SL3',
      'PV2+_nOPV2+, UNDER PROCESs',
      'WPV3, SL1',
      'SL3',
      'iVDPV2-n',
      'NSL2',
      'iVDPV3',
      'NSL2, SL2, UNDER PROCESS',
      'WPV1',
      'WPV3, SL3',
      'cVDPV1',
      'WPV3',
      'Negative',
      'NPEV',
      'cVDPV2',
      'SL1, SL3, NPEV',
      'WPV2',
      'aVDPV2-n',
      'NSL3, UNDER PROCESS',
      'NSL1, SL1, UNDER PROCESS',
      'SL2, UNDER PROCESS',
      'WPV1, SL3, PV2+_nOPV2-, Under Process',
      'PV2+_nOPV2-, UNDER PROCESS',
      'NSL3, SL3, UNDER PROCESS',
      'SL3 DISCORDANT, UNDER PROCESS',
      'SL1, SL3 DISCORDANT, UNDER PROCESS',
      'VDPV2',
      'VDPV2-n',
      'Not done',
      'iVDPV2',
      'NSL1, SL1, PV2+_nOPV2-, NPEV, UNDER PROCESS',
      'cVDPV2-n',
      'nOPV2-L',
      'WPV1, SL1',
      'SL2',
      'VDPV3',
      'iVDPV1',
      'cVDPV3',
      'aVDPV1',
      'WPV2, SL2',
      'aVDPV2',
      'NSL1, NSL3, UNDER PROCESS',
    ];

    $cases = [];

    for ($i = 0; $i < $offset + $perPage; $i++) {
      $year = 2024 + (int)floor($i / 10000);
      $yearIndex = $i % 10000;

      $patientName = $faker->name();
      $areaIndex = $faker->numberBetween(0, 29999);
      $adeq = $faker->randomElement(['ADEQ', 'INADEQ', 'UNKNOWN', 'PENDING']);
      $finalResult = $faker->randomElement($finalResults);
      $createdAt = $faker->dateTimeBetween("{$year}-01-01", "{$year}-12-31")->format('Y-m-d H:i:s');

      if ($i >= $offset) {
        $cases[] = array_merge([
          'id' => $this->makeCaseUlid($i),
          'bid' => sprintf('AFG/%d/%04d', $year, $yearIndex),
          'patientName' => $patientName,
          'year' => $year,
          'adeq' => $adeq,
          'finalResult' => $finalResult,
          'areaId' => $this->makeAreaUlid($areaIndex),
          'createdAt' => $createdAt,
        ], $this->makeExtraFields($faker));
      }
    }

    $response = [
      'data' => $cases,
      'meta' => [
        'total' => $total,
        'perPage' => $perPage,
        'totalPages' => $totalPages,
        'page' => $page,
        'hasNext' => $page < $totalPages,
        'hasPrev' => $page > 1,
      ],
    ];
    apcu_store($cacheKey, $response);
    return new JsonResponse($response);
  }

  #[Route('/api/data/specimens', name: 'api_data_specimens')]
  public function dataSpecimens(Request $request): JsonResponse
  {
    $total = 60000;
    $perPage = 1000;
    $totalPages = (int)ceil($total / $perPage);
    $page = max(1, min((int)$request->query->get('page', 1), $totalPages));

    $cacheKey = "api_data_specimens_page_{$page}";
    $cached = apcu_fetch($cacheKey, $success);
    if ($success) {
      return new JsonResponse($cached);
    }

    $offset = ($page - 1) * $perPage;

    $faker = Factory::create('en_EN');
    $faker->seed(99);

    $finalResults = [
      'SL1',
      'PV2+_nOPV2_not-tested, UNDER PROCESS',
      'NSL2, UNDER PROCESS',
      'SL1 DISCORDANT, UNDER PROCESS',
      'VDPV1',
      'aVDPV3',
      'SL2 DISCORDANT, UNDER PROCESS',
      'WPV1, SL3',
      'PV2+_nOPV2+, UNDER PROCESs',
      'WPV3, SL1',
      'SL3',
      'iVDPV2-n',
      'NSL2',
      'iVDPV3',
      'NSL2, SL2, UNDER PROCESS',
      'WPV1',
      'WPV3, SL3',
      'cVDPV1',
      'WPV3',
      'Negative',
      'NPEV',
      'cVDPV2',
      'SL1, SL3, NPEV',
      'WPV2',
      'aVDPV2-n',
      'NSL3, UNDER PROCESS',
      'NSL1, SL1, UNDER PROCESS',
      'SL2, UNDER PROCESS',
      'WPV1, SL3, PV2+_nOPV2-, Under Process',
      'PV2+_nOPV2-, UNDER PROCESS',
      'NSL3, SL3, UNDER PROCESS',
      'SL3 DISCORDANT, UNDER PROCESS',
      'SL1, SL3 DISCORDANT, UNDER PROCESS',
      'VDPV2',
      'VDPV2-n',
      'Not done',
      'iVDPV2',
      'NSL1, SL1, PV2+_nOPV2-, NPEV, UNDER PROCESS',
      'cVDPV2-n',
      'nOPV2-L',
      'WPV1, SL1',
      'SL2',
      'VDPV3',
      'iVDPV1',
      'cVDPV3',
      'aVDPV1',
      'WPV2, SL2',
      'aVDPV2',
      'NSL1, NSL3, UNDER PROCESS',
    ];

    $specimens = [];
    $caseCount = (int)ceil($total / 2); // 30000 cases

    // We need to generate faker state up to offset/2 cases
    $caseOffset = (int)floor($offset / 2);
    for ($i = 0; $i < $caseOffset; $i++) {
      $year = 2024 + (int)floor($i / 10000);
      $faker->name();
      $faker->numberBetween(0, 29999);
      $faker->randomElement(['ADEQ', 'INADEQ']);
      $faker->randomElement($finalResults);
      $faker->dateTimeBetween("{$year}-01-01", "{$year}-12-31");
    }

    $specimenIndex = $offset;
    $collected = 0;

    for ($i = $caseOffset; $i < $caseCount && $collected < $perPage; $i++) {
      $year = 2024 + (int)floor($i / 10000);
      $yearIndex = $i % 10000;
      $faker->name();
      $faker->numberBetween(0, 29999);
      $faker->randomElement(['ADEQ', 'INADEQ']);
      $finalResult = $faker->randomElement($finalResults);
      $createdAt = $faker->dateTimeBetween("{$year}-01-01", "{$year}-12-31")->format('Y-m-d H:i:s');

      $caseBid = sprintf('AFG/%d/%04d', $year, $yearIndex);
      $caseUlid = $this->makeCaseUlid($i);

      for ($s = 1; $s <= 2 && $collected < $perPage; $s++) {
        $specIndex = $i * 2 + ($s - 1);
        if ($specIndex >= $offset) {
          $specimens[] = array_merge([
            'id' => $this->makeSpecimenUlid($specIndex),
            'bid' => sprintf('%s#%02d', $caseBid, $s),
            'caseId' => $caseUlid,
            'finalResult' => $finalResult,
            'createdAt' => $createdAt,
          ], $this->makeExtraFields($faker));
          $collected++;
        }
      }
    }

    $response = [
      'data' => $specimens,
      'meta' => [
        'total' => $total,
        'perPage' => $perPage,
        'totalPages' => $totalPages,
        'page' => $page,
        'hasNext' => $page < $totalPages,
        'hasPrev' => $page > 1,
      ],
    ];
    apcu_store($cacheKey, $response);
    return new JsonResponse($response);
  }

  #[Route('/api/config', name: 'api_config')]
  public function config(): JsonResponse
  {
    return new JsonResponse([
      'app' => 'webifa',
      'version' => '1',
      'tables' => [
        'cases' => ['id', 'bid', 'patientName', 'year', 'adeq', 'finalResult', 'areaId', 'createdAt'],
        'areas' => ['id', 'name', 'createdAt'],
        'specimens' => ['id', 'bid', 'caseId', 'finalResult', 'createdAt'],
      ],
      'fetch' => [
        'areas' => '/api/data/areas',
        'cases' => '/api/data/cases',
        'specimens' => '/api/data/specimens',
      ],
      'searchEngine' => [
        'cases' => [
          'cases.area.name',
          'cases.bid',
          'cases.year',
          'cases.finalResult',
          'cases.patientName',
          'cases.adeq',
        ],
      ],
    ]);
  }
}

return function (array $context) {
  return new Kernel($context['APP_ENV'] ?? 'dev', (bool)($context['APP_DEBUG'] ?? true));
};
