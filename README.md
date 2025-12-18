## Локальное развёртывание

### Требования

- **Node.js** версии **18+** (желательно LTS)
- **npm** (идёт вместе с Node.js)

### Установка

```bash
git clone git@github.com:arpefly/tripf.git
cd tripf
npm install
```

### Генерация локального HTTPS‑сертификата

Проект использует самоподписанный сертификат для локального HTTPS (файлы хранятся в папке `certificates`).

Сгенерируйте сертификат и приватный ключ локально:

```bash
mkdir -p certificates

openssl req -x509 -newkey rsa:2048 \
  -keyout certificates/localhost-key.pem \
  -out certificates/localhost.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

### Запуск в режиме разработки (HTTPS)

```bash
npm run dev
```

По умолчанию приложение будет доступно по адресу:
- `https://localhost:3000`


### Полезные npm‑скрипты

- **`npm run dev`** – запуск приложения в режиме разработки через `server.js` (HTTPS).
- **`npm run dev:http`** – запуск dev‑сервера Next.js (HTTP, без сертификатов).
- **`npm run build`** – сборка приложения для продакшена.
- **`npm run start`** – запуск собранного приложения через `next start` (HTTP).
- **`npm run start:https`** – запуск собранного приложения через `server.js` (HTTPS, требует сгенерированных сертификатов).
- **`npm run lint`** – запуск ESLint.
