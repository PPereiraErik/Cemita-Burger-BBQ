-- MySQL instalado direto na máquina (sem Docker): cria o usuário e os bancos
-- que o .env.example e o .env.test.example esperam. Só para desenvolvimento.
CREATE USER IF NOT EXISTS 'cemita'@'localhost' IDENTIFIED BY 'cemita_dev';
CREATE DATABASE IF NOT EXISTS cemita_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS cemita_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON cemita_dev.* TO 'cemita'@'localhost';
GRANT ALL PRIVILEGES ON cemita_test.* TO 'cemita'@'localhost';
FLUSH PRIVILEGES;
