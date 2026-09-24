#!/bin/bash
# Postavljanje servera (Ubuntu 24.04). Pokreće ga .github/workflows/setup.yml kao root; smije se pokretati više puta.
set -euo pipefail
: "${DOMAIN:?}"
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades rsync

# SSH samo ključem (00- da bude prije cloud-init postavki; u sshd pobjeđuje prva vrijednost)
cat > /etc/ssh/sshd_config.d/00-ratni-atlas.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t && systemctl reload ssh

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

mkdir -p /var/www/ratni-atlas
[ -f /var/www/ratni-atlas/index.html ] || echo '<!doctype html><title>Ratni Atlas</title><p>Uskoro.' > /var/www/ratni-atlas/index.html

cat > /etc/nginx/sites-available/ratni-atlas <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    root /var/www/ratni-atlas;
    index index.html;
    location / { try_files \$uri \$uri/ =404; }
    location = /index.html { add_header Cache-Control "no-cache"; }
}
EOF
ln -sf /etc/nginx/sites-available/ratni-atlas /etc/nginx/sites-enabled/ratni-atlas
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# HTTPS; certbot dodaje 443 i preusmjerenje u gornji blok, a obnavljanje ide preko systemd timera
certbot --nginx -n --keep-until-expiring --agree-tos --register-unsafely-without-email --redirect -d "$DOMAIN"

echo "OK: https://$DOMAIN"
