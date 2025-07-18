#!/bin/bash

# Скрипт для настройки SSL-сертификата с Let's Encrypt для домена

# Проверяем, запущены ли мы от имени root
if [ "$(id -u)" != "0" ]; then
   echo "Этот скрипт должен быть запущен от имени пользователя root"
   exit 1
fi

# Проверяем наличие аргумента домена
if [ -z "$1" ]; then
    DOMAIN="sysadminbotuchot.ru"
    echo "Используется домен по умолчанию: $DOMAIN"
else
    DOMAIN="$1"
    echo "Используется домен: $DOMAIN"
fi

EMAIL="admin@${DOMAIN}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

# Устанавливаем Certbot и Nginx, если они еще не установлены
echo "Проверка и установка необходимых пакетов..."

# Определяем тип пакетного менеджера
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    $PKG_MANAGER update
    $PKG_MANAGER install -y nginx certbot python3-certbot-nginx
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    $PKG_MANAGER install -y epel-release
    $PKG_MANAGER install -y nginx certbot python3-certbot-nginx
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    $PKG_MANAGER install -y epel-release
    $PKG_MANAGER install -y nginx certbot python3-certbot-nginx
else
    echo "Не удалось определить пакетный менеджер. Установите Nginx и Certbot вручную."
    exit 1
fi

# Создаем конфигурацию Nginx для домена
echo "Создание конфигурации Nginx для $DOMAIN..."

cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Создаем символическую ссылку, если ее еще нет
if [ ! -f $NGINX_ENABLED ]; then
    ln -s $NGINX_CONF $NGINX_ENABLED
fi

# Проверяем конфигурацию Nginx
echo "Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "Ошибка в конфигурации Nginx. Пожалуйста, исправьте ошибки и запустите скрипт снова."
    exit 1
fi

# Перезапускаем Nginx
echo "Перезапуск Nginx..."
systemctl restart nginx

# Получаем SSL сертификат с помощью Certbot
echo "Получение SSL сертификата для $DOMAIN..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL

if [ $? -ne 0 ]; then
    echo "Не удалось получить SSL сертификат. Проверьте настройки DNS и убедитесь, что домен указывает на этот сервер."
    exit 1
fi

# Настраиваем автоматическое обновление сертификата
echo "Настройка автоматического обновления сертификата..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo "Настройка SSL завершена!"
echo "Ваш сайт теперь доступен по HTTPS: https://$DOMAIN"

# Создаем резервные копии сертификатов
CERTS_BACKUP_DIR="$(pwd)/certs_backup/$DOMAIN"
echo "Создание резервных копий сертификатов в $CERTS_BACKUP_DIR..."

mkdir -p "$CERTS_BACKUP_DIR"
cp -L "$CERT_DIR/privkey.pem" "$CERTS_BACKUP_DIR/"
cp -L "$CERT_DIR/cert.pem" "$CERTS_BACKUP_DIR/"
cp -L "$CERT_DIR/chain.pem" "$CERTS_BACKUP_DIR/"
cp -L "$CERT_DIR/fullchain.pem" "$CERTS_BACKUP_DIR/"

echo "Резервные копии сертификатов созданы в $CERTS_BACKUP_DIR"
echo "Готово!"
exit 0
