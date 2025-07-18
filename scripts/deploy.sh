#!/bin/bash

# Скрипт для автоматического развертывания приложения на боевом сервере

# Проверяем наличие Node.js и npm
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "Устанавливаем Node.js..."
    
    # Определяем тип пакетного менеджера
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo "Не удалось определить пакетный менеджер. Установите Node.js вручную."
        exit 1
    fi
    
    # Проверяем установку
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo "Не удалось установить Node.js. Пожалуйста, установите его вручную."
        exit 1
    fi
fi

# Проверяем версию Node.js
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Внимание: рекомендуется Node.js v20 или выше. У вас установлена версия v$NODE_VERSION."
    read -p "Хотите продолжить? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Проверяем наличие PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "Устанавливаем PostgreSQL..."
    
    # Определяем тип пакетного менеджера
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
    elif command -v yum &> /dev/null; then
        sudo yum install -y postgresql-server postgresql-contrib
        sudo postgresql-setup initdb
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    else
        echo "Не удалось определить пакетный менеджер. Установите PostgreSQL вручную."
        exit 1
    fi
    
    # Проверяем установку
    if ! command -v psql &> /dev/null; then
        echo "Не удалось установить PostgreSQL. Пожалуйста, установите его вручную."
        exit 1
    fi
fi

# Создаем базу данных и пользователя, если они еще не существуют
DB_NAME="telegrambot"
DB_USER="telegrambot"
DB_PASS=$(openssl rand -base64 12)

echo "Настраиваем базу данных PostgreSQL..."

# Проверяем, существует ли уже база данных
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME
if [ $? -ne 0 ]; then
    echo "Создание новой базы данных $DB_NAME..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    
    # Проверяем, существует ли уже пользователь
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1
    if [ $? -ne 0 ]; then
        echo "Создание нового пользователя $DB_USER..."
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
    else
        echo "Пользователь $DB_USER уже существует, обновляем пароль..."
        sudo -u postgres psql -c "ALTER USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
    fi
    
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
else
    echo "База данных $DB_NAME уже существует."
fi

# Создаем каталог приложения, если он еще не существует
APP_DIR="/var/www/telegrambot"
if [ ! -d "$APP_DIR" ]; then
    echo "Создание каталога приложения $APP_DIR..."
    sudo mkdir -p "$APP_DIR"
    sudo chown $(whoami):$(whoami) "$APP_DIR"
fi

# Клонируем репозиторий или обновляем существующий
echo "Клонирование приложения..."
cd "$APP_DIR"

if [ -d ".git" ]; then
    # Если репозиторий уже клонирован, обновляем его
    git pull
else
    # Иначе клонируем репозиторий
    git clone https://github.com/username/telegram-equipment-bot.git .
fi

# Создаем файл .env с настройками окружения
echo "Создание файла .env..."

DBHOST="localhost"
DBPORT="5432"
DB_URL="postgres://${DB_USER}:${DB_PASS}@${DBHOST}:${DBPORT}/${DB_NAME}"
ADMIN_PANEL_URL="sysadminbotuchot.ru"

# Проверяем наличие токена Telegram бота
echo -n "Введите токен Telegram бота (TELEGRAM_BOT_TOKEN): "
read TELEGRAM_BOT_TOKEN

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "Ошибка: Токен Telegram бота не указан."
    exit 1
fi

cat > .env << EOF
NODE_ENV=production
DATABASE_URL=${DB_URL}
PGHOST=${DBHOST}
PGPORT=${DBPORT}
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASS}
PGDATABASE=${DB_NAME}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
ADMIN_PANEL_URL=${ADMIN_PANEL_URL}
EOF

# Устанавливаем зависимости
echo "Установка зависимостей..."
npm install

# Создаем структуру базы данных
echo "Создание структуры базы данных..."
npm run db:push

# Заполняем базу данных начальными данными
echo "Заполнение базы данных начальными данными..."
npm run db:seed

# Создаем администратора
echo "Создание пользователя администратора..."

echo -n "Введите имя пользователя администратора: "
read ADMIN_USERNAME

echo -n "Введите пароль пользователя администратора: "
read ADMIN_PASSWORD

if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "Ошибка: Имя пользователя или пароль не указаны."
else
    npx tsx scripts/create-admin.ts --username="$ADMIN_USERNAME" --password="$ADMIN_PASSWORD" --domain="$ADMIN_PANEL_URL"
fi

# Собираем приложение
echo "Сборка приложения..."
npm run build

# Создаем systemd сервис для автоматического запуска
echo "Создание systemd сервиса..."

SERVICE_FILE="/etc/systemd/system/telegrambot.service"
sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=Telegram Equipment Bot
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Включаем и запускаем сервис
echo "Запуск сервиса..."
sudo systemctl daemon-reload
sudo systemctl enable telegrambot
sudo systemctl start telegrambot

# Настраиваем SSL сертификат
echo "Настройка SSL сертификата..."
sudo bash scripts/ssl-setup.sh $ADMIN_PANEL_URL

echo "==============================="
echo "Установка завершена!"
echo "==============================="
echo "Административная панель: https://$ADMIN_PANEL_URL"
echo "Имя пользователя: $ADMIN_USERNAME"
echo "Пароль: ********"
echo "==============================="
echo "Настройки базы данных:"
echo "DB_NAME: $DB_NAME"
echo "DB_USER: $DB_USER"
echo "DB_PASS: $DB_PASS"
echo "DB_URL: $DB_URL"
echo "==============================="
echo "Для проверки статуса сервиса: sudo systemctl status telegrambot"
echo "Для просмотра логов: sudo journalctl -u telegrambot -f"
echo "==============================="
