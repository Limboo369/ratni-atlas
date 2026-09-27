#!/bin/bash
# Podaci o opterećenju servera za .github/workflows/stats.yml (samo čitanje): stanje sada, zatim sysstat (CPU, RAM, disk,
# load, mreža; svakih 10 min, čuva se 28 dana) i deovilab-dstats (CPU/RAM svakog kontejnera) za zadnjih DAYS dana.
# Ispis: sekcije "@@ ime", ispod njih redovi odvojeni sa ";".
set -uo pipefail
D=${DAYS:-7}
[[ "$D" =~ ^[0-9]+$ ]] || D=7
((D < 1)) && D=1
((D > 28)) && D=28
since=$(date -d "-$D day" +%s)

echo "@@ info"
echo "now;$(date +%s)"
echo "days;$D"
echo "host;$(hostname)"
echo "cores;$(nproc)"
echo "cpu;$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ *//')"
echo "mem_total;$(awk '/^MemTotal/ {print $2 * 1024}' /proc/meminfo)"
echo "mem_avail;$(awk '/^MemAvailable/ {print $2 * 1024}' /proc/meminfo)"
echo "swap_total;$(awk '/^SwapTotal/ {print $2 * 1024}' /proc/meminfo)"
echo "swap_free;$(awk '/^SwapFree/ {print $2 * 1024}' /proc/meminfo)"
df -B1 --output=size,used,avail / | tail -1 | awk '{print "disk_total;" $1; print "disk_used;" $2; print "disk_avail;" $3}'
echo "load;$(cut -d' ' -f1-3 /proc/loadavg)"
echo "uptime;$(uptime -p)"
echo "booted;$(uptime -s)"
echo "os;$(. /etc/os-release && echo "$PRETTY_NAME"), kernel $(uname -r)"
echo "sysstat;$(command -v sadf >/dev/null && echo yes || echo no)"
echo "sysstat_since;$(ls -tr /var/log/sysstat/sa[0-9]* 2>/dev/null | head -1 | xargs -r stat -c %Y)"
echo "reboot_needed;$([ -f /var/run/reboot-required ] && echo yes || echo no)"

echo "@@ docker_now"
docker stats --no-stream --format '{{.Name}};{{.CPUPerc}};{{.MemUsage}};{{.MemPerc}};{{.NetIO}};{{.BlockIO}};{{.PIDs}}' 2>/dev/null
echo "@@ docker_ps"
docker ps -a --format '{{.Names}};{{.Status}};{{.Image}}' 2>/dev/null
echo "@@ sizes"
du -sb /srv/apps/* /srv/backups/* /var/lib/docker/volumes/* /var/log /var/lib/docker 2>/dev/null | awk -F'\t' '{print $2 ";" $1}'
echo "@@ top"
# the biggest in memory, with the CPU time they used since they started (not this script's own tools)
ps -eo rss,times,etimes,comm --sort=-rss --no-headers | awk '$4 !~ /^(ps|awk|bash|sshd|sadf|du|head)$/' | head -10 | awk '{print $4 ";" $2 ";" $1 * 1024 ";" $3}'

if command -v sadf >/dev/null; then
  files=$(find /var/log/sysstat -maxdepth 1 -name 'sa[0-9]*' -newermt "@$since" 2>/dev/null | sort)
  for sec in "cpu:-u" "mem:-r" "fs:-F MOUNT" "load:-q" "net:-n DEV"; do
    echo "@@ ${sec%%:*}"
    for f in $files; do LC_ALL=C sadf -dU "$f" -- ${sec#*:} 2>/dev/null; done
  done
fi
echo "@@ dstats"
[ -f /var/log/deovilab/dstats.csv ] && awk -F';' -v s="$since" '$1 >= s' /var/log/deovilab/dstats.csv
echo "@@ end"
