api-start:
	cd api && rm -rf ./var/* && APP_ENV=dev php -S localhost:8888 index.php
