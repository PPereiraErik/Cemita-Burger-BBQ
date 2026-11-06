-- Banco separado para os testes automatizados (apagado e recriado a cada execução).
CREATE DATABASE IF NOT EXISTS cemita_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON cemita_test.* TO 'cemita'@'%';
FLUSH PRIVILEGES;
