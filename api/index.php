<?php

require_once __DIR__ . '/vendor/autoload_runtime.php';

use Faker\Factory;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;
use Symfony\Component\Uid\Ulid;

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

    #[Route('/api/data/areas', name: 'api_data_areas')]
    public function dataAreas(\Symfony\Component\HttpFoundation\Request $request): JsonResponse
    {
        usleep(300);
        $total     = 30000;
        $perPage   = 1000;
        $totalPages = (int) ceil($total / $perPage);
        $page      = max(1, min((int) $request->query->get('page', 1), $totalPages));
        $offset    = ($page - 1) * $perPage;

        $faker = Factory::create('en_EN');
        $faker->seed(42);

        $nameCounts = [];
        $areas = [];

        for ($i = 0; $i < $offset + $perPage; $i++) {
            $base = $faker->city();
            if (!isset($nameCounts[$base])) {
                $nameCounts[$base] = 0;
                $name = $base;
            } else {
                $nameCounts[$base]++;
                $name = $base . ' ' . $nameCounts[$base];
            }
            if ($i >= $offset) {
                $areas[] = ['id' => (string) new Ulid(), 'name' => $name];
            }
        }

        return new JsonResponse([
            'data' => $areas,
            'meta' => [
                'total'      => $total,
                'perPage'    => $perPage,
                'totalPages' => $totalPages,
                'page'       => $page,
                'hasNext'    => $page < $totalPages,
                'hasPrev'    => $page > 1,
            ],
        ]);
    }

    #[Route('/api/config', name: 'api_config')]
    public function config(): JsonResponse
    {
        return new JsonResponse([
            'app'     => 'webifa',
            'version' => '1.0.12',
            'env'     => $this->getEnvironment(),
            'tables'  => [
                'cases'     => ['id', 'name', 'areaId'],
                'areas'     => ['id', 'name'],
                'specimens' => ['id', 'caseId'],
            ],
            'fetch'   => [
                'areas' => '/api/data/areas',
            ],
        ]);
    }
}

return function (array $context) {
    return new Kernel($context['APP_ENV'] ?? 'dev', (bool) ($context['APP_DEBUG'] ?? true));
};
