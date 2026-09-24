#!/bin/bash
# Osnova servera (Ubuntu 24.04) za sve aplikacije na *.deovilab.com. Pokreće ga .github/workflows/setup.yml kao root
# (pod /run/deovilab.lock, stdin zatvoren); smije se pokretati više puta.
# Pojedine aplikacije objavljuje /usr/local/bin/deovilab-deploy (server/deploy.sh).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
APT=(apt-get -y -qq -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

apt-get update -qq
"${APT[@]}" upgrade
"${APT[@]}" install nginx certbot ufw fail2ban unattended-upgrades rsync curl ca-certificates python3

# SSH samo ključem (00- da bude prije cloud-init postavki; u sshd pobjeđuje prva vrijednost)
cat > /etc/ssh/sshd_config.d/00-deovilab.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
rm -f /etc/ssh/sshd_config.d/00-ratni-atlas.conf
sshd -t || { rm -f /etc/ssh/sshd_config.d/00-deovilab.conf; echo "sshd konfiguracija ne valja"; exit 1; }
systemctl reload ssh

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

# Docker (službeni repozitorij). "ip" važi samo za `docker run` na default bridge mreži; compose projekti imaju
# svoje mreže, pa deovilab-deploy odbija svaki port koji nije 127.0.0.1:... (Docker zaobilazi ufw).
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  "${APT[@]}" install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
DJ='{ "ip": "127.0.0.1", "log-driver": "local" }'
if [ "$(cat /etc/docker/daemon.json 2>/dev/null)" != "$DJ" ]; then
  echo "$DJ" > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker
mkdir -p /srv/apps

# Nginx: zajednička TLS podešavanja + odbijanje nepoznatih domena; ACME izazovi za sve domene idu iz /var/www/letsencrypt
mkdir -p /var/www/letsencrypt
sed -i 's/^\(\s*ssl_protocols\).*/\1 TLSv1.2 TLSv1.3;/' /etc/nginx/nginx.conf
cat > /etc/nginx/conf.d/00-deovilab.conf <<'EOF'
server_tokens off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 444; }
}
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}
EOF
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Certifikati se obnavljaju preko webroot-a; nginx installer (certbot --nginx) više ne diramo
sed -i '/^installer = nginx$/d' /etc/letsencrypt/renewal/*.conf 2>/dev/null || true

install -m 0755 /tmp/deovilab-deploy /usr/local/bin/deovilab-deploy

echo "OK: $(docker --version), $(docker compose version), $(nginx -v 2>&1)"
