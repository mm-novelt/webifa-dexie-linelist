api-start:
	cd api && rm -rf ./var/* && php -r "apcu_clear_cache();" && APP_ENV=dev php -S localhost:8888 index.php
