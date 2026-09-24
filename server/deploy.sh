#!/bin/bash
# deovilab-deploy <app> <domena> <port>
# Pokreće Docker projekat /srv/apps/<app>/compose.yml (port objavljen samo na 127.0.0.1:<port>) i objavljuje ga
# na https://<domena>: Let's Encrypt certifikat (webroot, obnavlja se sam) + nginx proxy s WebSocketom.
# Instalira ga server/setup.sh; zovu ga deploy workflowi svih repozitorija.
set -euo pipefail
APP=${1:-} D=${2:-} PORT=${3:-}
[[ $APP =~ ^[a-z0-9-]+$ && $D =~ ^[a-z0-9.-]+\.[a-z]+$ && $PORT =~ ^[0-9]{4,5}$ ]] \
  || { echo "upotreba: deovilab-deploy <app> <domena> <port>"; exit 2; }
DIR=/srv/apps/$APP SITE=/etc/nginx/sites-available/$D
[ -f "$DIR/compose.yml" ] || { echo "nema $DIR/compose.yml"; exit 1; }

# Jedan port = jedna aplikacija
other=$(grep -l "proxy_pass http://127.0.0.1:$PORT;" /etc/nginx/sites-available/* 2>/dev/null | grep -vx "$SITE" || true)
[ -z "$other" ] || { echo "port $PORT već koristi: $other"; exit 1; }

docker compose -p "$APP" -f "$DIR/compose.yml" up -d --build --remove-orphans --wait
for i in $(seq 20); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 1; done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" || { echo "$APP ne odgovara na 127.0.0.1:$PORT"; exit 1; }

if [ ! -e "/etc/letsencrypt/live/$D/fullchain.pem" ]; then
  certbot certonly -n --agree-tos --register-unsafely-without-email --webroot -w /var/www/letsencrypt \
    -d "$D" --deploy-hook "systemctl reload nginx" \
    || { echo "certifikat za $D nije izdat: provjeri da DNS A zapis za $D pokazuje na ovaj server"; exit 1; }
elif ! grep -q '^authenticator = webroot' "/etc/letsencrypt/renewal/$D.conf"; then
  certbot reconfigure -n --cert-name "$D" --webroot -w /var/www/letsencrypt --deploy-hook "systemctl reload nginx" \
    || echo "UPOZORENJE: obnavljanje certifikata za $D nije prebačeno na webroot"
fi

new=$(mktemp)
cat > "$new" <<EOF
# deovilab-deploy: $APP -> 127.0.0.1:$PORT (ne mijenjati ručno, prepisuje se pri svakoj objavi)
server {
    listen 80;
    listen [::]:80;
    server_name $D;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $D;
    ssl_certificate /etc/letsencrypt/live/$D/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$D/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_read_timeout 1h;
    }
}
EOF
if ! cmp -s "$new" "$SITE"; then
  [ -f "$SITE" ] && cp "$SITE" "$SITE.bak"
  mv "$new" "$SITE" && chmod 644 "$SITE"
  ln -sf "$SITE" "/etc/nginx/sites-enabled/$D"
  if ! nginx -t; then
    if [ -f "$SITE.bak" ]; then mv "$SITE.bak" "$SITE"; else rm -f "$SITE" "/etc/nginx/sites-enabled/$D"; fi
    echo "nginx konfiguracija za $D ne valja, vraćena prethodna"; exit 1
  fi
  systemctl reload nginx
fi
rm -f "$new" "$SITE.bak"
docker image prune -f >/dev/null
echo "OK: https://$D -> $APP (127.0.0.1:$PORT)"
