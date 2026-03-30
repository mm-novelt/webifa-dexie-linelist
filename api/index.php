<?php

require_once __DIR__ . '/vendor/autoload_runtime.php';

use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpFoundation\JsonResponse;
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
        ]);
    }
}

return function (array $context) {
    return new Kernel($context['APP_ENV'] ?? 'dev', (bool) ($context['APP_DEBUG'] ?? true));
};
