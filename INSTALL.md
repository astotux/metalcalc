# Установка MetalCalc на сервер Ubuntu

Пошаговая инструкция по развёртыванию **MetalCalc** на сервере Ubuntu, где система уже обновлена (`apt update && apt upgrade`) и установлен **Node.js**.

---

## 1. Проверка версии Node.js и системных пакетов

Приложение использует встроенный в Node.js модуль `node:sqlite` (отдельный сервер БД не нужен).

Проверьте текущую версию Node.js:

```bash
node -v
```

> **Важно:** нужна версия **Node.js 22.5 или выше** (рекомендуется **Node.js 24 LTS**).  
> Если у вас установлена версия ниже 22.5 (например, v18 или v20 из стандартных репозиториев Ubuntu), обновите Node.js:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
> sudo apt install -y nodejs
> node -v
> ```

Установите `git`, `nginx`, `certbot` (для HTTPS) и менеджер процессов `pm2`:

```bash
sudo apt install -y git nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

---

## 2. Размещение проекта и установка зависимостей

Клонируйте репозиторий (или загрузите файлы проекта) в рабочую директорию, например `/var/www/metalcalc`:

```bash
sudo mkdir -p /var/www/metalcalc
sudo chown -R $USER:$USER /var/www/metalcalc
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> /var/www/metalcalc
cd /var/www/metalcalc
```

Установите npm-зависимости:

```bash
npm ci
```

Создайте каталог для базы данных SQLite (приложение также создаёт его само при первом обращении, но лучше сразу убедиться в правах):

```bash
mkdir -p /var/www/metalcalc/data
```

---

## 3. Настройка переменных окружения (`.env`)

Скопируйте шаблон и откройте его для редактирования:

```bash
cp .env.example .env
nano .env
```

Сгенерируйте случайный `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Заполните `.env` под ваш домен и почту:

```env
# Публичный URL сайта (обязательно HTTPS для production и OAuth callback)
NEXT_PUBLIC_APP_URL=https://example.ru

# Случайный секрет (подставьте результат openssl rand -base64 32)
AUTH_SECRET=ВАШ_СГЕНЕРИРОВАННЫЙ_СЕКРЕТ

# Необязательно: путь к файлу SQLite (по умолчанию ./data/metalcalc.db)
# METALCALC_DB_PATH=/var/www/metalcalc/data/metalcalc.db

# --- SMTP для отправки 6-значных кодов подтверждения почты ---
# Вариант A: Яндекс Почта (SSL, порт 465)
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-mailbox@yandex.ru
SMTP_PASS=пароль_приложения_яндекс
SMTP_FROM="MetalCalc <your-mailbox@yandex.ru>"

# Вариант B: Gmail (STARTTLS, порт 587) — нужен пароль приложения Google
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-mailbox@gmail.com
# SMTP_PASS=пароль_приложения_google
# SMTP_FROM="MetalCalc <your-mailbox@gmail.com>"

# --- Вход через Яндекс ID (опционально) ---
# В консоли https://oauth.yandex.ru/ укажите Callback URL:
# https://example.ru/api/auth/oauth/yandex/callback
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
```

> **Про SMTP:** для Яндекс Почты и Gmail в `SMTP_PASS` нужно указывать **пароль приложения**, а не обычный пароль от аккаунта (включается в настройках безопасности почтового аккаунта при активной 2FA).

---

## 4. Сборка production-версии

Выполните сборку Next.js:

```bash
npm run build
```

При желании можно сразу прогнать проверки:

```bash
npm run typecheck && npm run test
```

---

## 5. Запуск приложения через PM2

Запустите Next.js на локальном интерфейсе `127.0.0.1:3000` (наружу трафик пойдёт через Nginx с HTTPS):

```bash
pm2 start npm --name "metalcalc" -- start -- -H 127.0.0.1 -p 3000
pm2 save
```

Настройте автозапуск PM2 после перезагрузки сервера — выполните следующую команду и затем скопируйте/выполните строку, которую она выведет с `sudo`:

```bash
pm2 startup
```

Проверить состояние процесса и логи:

```bash
pm2 status
pm2 logs metalcalc
```

---

## 6. Настройка Nginx и HTTPS (обязательно для авторизации)

> **Критично:** в production-режиме (`npm start`) сессионная cookie `mc_session` выставляется с флагом `Secure`. Это означает, что браузер будет сохранять авторизацию **только по HTTPS** (через Nginx + SSL). При открытии сайта просто по `http://IP:3000` вход работать не будет!

Создайте конфиг сайта `/etc/nginx/sites-available/metalcalc`:

```bash
sudo nano /etc/nginx/sites-available/metalcalc
```

Вставьте (заменив `example.ru` на ваш домен):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.ru www.example.ru;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте конфиг, проверьте синтаксис и перезагрузите Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/metalcalc /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Выпустите бесплатный SSL-сертификат Let's Encrypt (Certbot сам настроит HTTPS и редирект с HTTP):

```bash
sudo certbot --nginx -d example.ru -d www.example.ru
```

---

## 7. Настройка фаервола (`ufw`)

Если используется `ufw`, откройте только SSH и Nginx:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. Обновление и резервное копирование

### Как обновить приложение

```bash
cd /var/www/metalcalc
git pull
npm ci
npm run build
pm2 restart metalcalc
```

### Резервная копия базы данных SQLite

База данных хранится в `data/metalcalc.db` (вместе с файлами журнала WAL `metalcalc.db-wal` и `metalcalc.db-shm`).  
Чтобы сделать консистентный бэкап, остановите на пару секунд процесс или скопируйте все три файла / используйте утилиту `sqlite3`:

```bash
mkdir -p /var/backups/metalcalc
pm2 stop metalcalc
cp /var/www/metalcalc/data/metalcalc.db* /var/backups/metalcalc/
pm2 start metalcalc
```

---

## Быстрая диагностика проблем

| Симптом | Что проверить |
| --- | --- |
| Ошибка `Cannot find module 'node:sqlite'` | Обновите Node.js до **22.5+** (`node -v`). |
| После входа сразу кидает обратно на `/login` | Проверьте, что сайт открыт по **HTTPS** (`https://...`), а не по `http://IP:3000`. |
| Не приходят письма с кодом подтверждения | Проверьте логи `pm2 logs metalcalc`, убедитесь в корректности `SMTP_PASS` (пароль приложения) и открытом исходящем порту 465/587 у хостера. |
| Ошибка OAuth Яндекс (`redirect_uri` mismatch) | Убедитесь, что `NEXT_PUBLIC_APP_URL` в `.env` без `/` на конце совпадает с Callback URL в кабинете Яндекса, и пересоберите (`npm run build && pm2 restart metalcalc`). |
| Ошибка сохранения проектов `SQLITE_READONLY` | Проверьте владельца и права на папку `data/` и файлы `data/metalcalc.db*` от того пользователя, под которым запущен `pm2`. |
