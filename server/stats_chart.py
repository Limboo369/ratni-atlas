"""Grafikoni opterećenja servera iz ispisa server/stats.sh (pokreće .github/workflows/stats.yml na GitHub runneru).
   python3 server/stats_chart.py stats.txt summary.md out/
Piše: summary.md (sažetak za stranicu workflowa), out/*.png (grafikoni), out/data.json (satni podaci), a na izlaz satnu
tabelu (za čitanje iz loga)."""
import json, os, re, sys, time
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Sarajevo')  # Darko's time

src, summary, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
sec, cur = defaultdict(list), None
for line in open(src, encoding='utf-8', errors='replace'):
    line = line.rstrip('\n')
    if line.startswith('@@ '):
        cur = line[3:].strip()
    elif cur and line:
        sec[cur].append(line)
info = dict(l.split(';', 1) for l in sec['info'] if ';' in l)
GB = 1024 ** 3


def num(x, d=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def sadf(name):
    """sadf -dU rows as dicts (the header line starts with '# ')"""
    head, rows = None, []
    for l in sec[name]:
        if l.startswith('# '):
            head = l[2:].split(';')
        elif head:
            v = l.split(';')
            if len(v) == len(head):
                rows.append(dict(zip(head, v)))
    return rows


def size(s):
    """'123.4MiB' → bytes"""
    m = re.match(r'([\d.]+)\s*([KMGT]?i?B)', s.strip())
    if not m:
        return 0.0
    k = {'B': 1, 'KiB': 1024, 'MiB': 1024 ** 2, 'GiB': 1024 ** 3, 'TiB': 1024 ** 4, 'kB': 1e3, 'KB': 1e3, 'MB': 1e6, 'GB': 1e9, 'TB': 1e12}
    return float(m.group(1)) * k.get(m.group(2), 1)


# ---- series (timestamp, value)
cpu = [(int(r['timestamp']), 100 - num(r['%idle']), num(r['%iowait']), num(r['%steal'])) for r in sadf('cpu') if r.get('CPU') == '-1' or r.get('CPU') == 'all']
mem = []
for r in sadf('mem'):
    total_kb = num(info.get('mem_total')) / 1024  # used = what is not available (buffers and cache count as free)
    used = 100 * (1 - num(r.get('kbavail')) / total_kb) if r.get('kbavail') and total_kb else num(r.get('%memused'))
    mem.append((int(r['timestamp']), used))
fs = []
for r in sadf('fs'):
    name = r.get('MOUNTPOINT') or r.get('FILESYSTEM')
    if name == '/':
        fs.append((int(r['timestamp']), num(r['%fsused'])))
load = [(int(r['timestamp']), num(r['ldavg-1']), num(r['ldavg-5'])) for r in sadf('load')]
nets = defaultdict(list)
for r in sadf('net'):
    i = r.get('IFACE', '')
    if i == 'lo' or i.startswith(('veth', 'br-', 'docker')):
        continue
    nets[i].append((int(r['timestamp']), num(r['rxkB/s']), num(r['txkB/s'])))
net = max(nets.values(), key=lambda s: sum(x[1] + x[2] for x in s)) if nets else []
dst = defaultdict(list)  # container → [(t, cpu%, mem bytes)]
for l in sec['dstats']:
    v = l.split(';')
    if len(v) >= 4:
        dst[v[1]].append((int(v[0]), num(v[2].rstrip('%')), size(v[3].split('/')[0])))

# ---- hourly buckets
H = 3600


def hourly(series, k=1, agg='avg'):
    b = defaultdict(list)
    for x in series:
        b[x[0] // H * H].append(x[k])
    return {t: (max(v) if agg == 'max' else sum(v) / len(v)) for t, v in b.items()}


hours = sorted(set(hourly(cpu)) | set(hourly(mem)))
cols = {'cpu': hourly(cpu), 'cpu_max': hourly(cpu, agg='max'), 'iowait': hourly(cpu, 2), 'steal': hourly(cpu, 3), 'mem': hourly(mem),
        'mem_max': hourly(mem, agg='max'), 'disk': hourly(fs), 'load': hourly(load), 'rx': hourly(net), 'tx': hourly(net, 2)}
def hourly_ct(s):
    b = defaultdict(list)
    for t, c, m in s:
        b[t // H * H].append((c, m))
    return [dict(t=t, cpu=round(sum(x[0] for x in v) / len(v), 2), mem=round(sum(x[1] for x in v) / len(v) / 2 ** 20, 1)) for t, v in sorted(b.items())]


data = {'info': info, 'hours': [dict({'t': t}, **{k: round(c[t], 2) for k, c in cols.items() if t in c}) for t in hours],
        'containers': {n: hourly_ct(s) for n, s in dst.items()}}
json.dump(data, open(os.path.join(out, 'data.json'), 'w'))
print('HOURLY t;cpu;cpu_max;iowait;steal;mem;mem_max;disk;load;rx_kBs;tx_kBs')
for h in data['hours']:
    print('HOURLY ' + ';'.join([datetime.fromtimestamp(h['t'], TZ).strftime('%d.%m. %H')] + [str(h.get(k, '')) for k in cols]))

# ---- charts
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates

    def T(s):
        return [datetime.fromtimestamp(x[0], TZ) for x in s]

    def chart(fn, title, lines, ylabel, ymax=None):
        if not any(s for s, _, _ in lines):
            return
        fig, ax = plt.subplots(figsize=(12, 3.6), dpi=110)
        for s, k, label in lines:
            if s:
                ax.plot(T(s), [x[k] for x in s], label=label, linewidth=1.2)
        ax.set_title(title)
        ax.set_ylabel(ylabel)
        if ymax:
            ax.set_ylim(0, ymax)
        ax.grid(alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%d.%m. %H:%M', tz=TZ))
        fig.autofmt_xdate()
        ax.legend(loc='upper left', fontsize=8)
        fig.tight_layout()
        fig.savefig(os.path.join(out, fn))
        plt.close(fig)

    chart('1_cpu.png', 'CPU (%, all cores)', [(cpu, 1, 'used'), (cpu, 2, 'iowait (waiting for the disk)'), (cpu, 3, 'steal (the host takes it)')], '%', 100)
    chart('2_ram.png', 'RAM (% used)', [(mem, 1, 'used')], '%', 100)
    chart('3_disk.png', 'Disk / (% used)', [(fs, 1, 'used')], '%', 100)
    chart('4_load.png', 'Load (%s cores)' % info.get('cores', '?'), [(load, 1, '1 min'), (load, 2, '5 min')], 'load')
    chart('5_net.png', 'Network (kB/s)', [(net, 1, 'in'), (net, 2, 'out')], 'kB/s')
    if dst:
        chart('6_containers_cpu.png', 'Containers: CPU (% of one core)', [(s, 1, n) for n, s in sorted(dst.items())], '%')
        chart('7_containers_ram.png', 'Containers: RAM (MiB)', [([(t, c, m / 2 ** 20) for t, c, m in s], 2, n) for n, s in sorted(dst.items())], 'MiB')
except ImportError:
    pass

# ---- summary (Markdown, shown on the workflow run's page)
md = []
mt, ma = num(info.get('mem_total')), num(info.get('mem_avail'))
dt, du = num(info.get('disk_total')), num(info.get('disk_used'))
md.append('# Server %s' % info.get('host', ''))
md.append('| | |\n|---|---|')
md.append('| Processor | %s cores · %s |' % (info.get('cores', '?'), info.get('cpu', '')))
md.append('| RAM | %.1f of %.1f GB used (%.0f%%) |' % ((mt - ma) / GB, mt / GB, 100 * (mt - ma) / mt if mt else 0))
md.append('| Swap | %.1f of %.1f GB used |' % ((num(info.get('swap_total')) - num(info.get('swap_free'))) / GB, num(info.get('swap_total')) / GB))
md.append('| Disk / | %.1f of %.1f GB used (%.0f%%), %.1f GB free |' % (du / GB, dt / GB, 100 * du / dt if dt else 0, num(info.get('disk_avail')) / GB))
md.append('| Load (1/5/15 min) | %s |' % info.get('load', ''))
md.append('| Running | %s (since %s) |' % (info.get('uptime', ''), info.get('booted', '')))
md.append('| System | %s · reboot needed: %s |' % (info.get('os', ''), info.get('reboot_needed', '')))
if info.get('sysstat') != 'yes' or not cpu:
    md.append('\n> No history yet: the server records CPU/RAM/disk every 10 minutes since `server/setup.sh` installed sysstat.')
md.append('\n## Containers now\n| Name | CPU | RAM | RAM % | Net in/out | Disk read/write | Processes |\n|---|---|---|---|---|---|---|')
for l in sec['docker_now']:
    v = l.split(';')
    if len(v) >= 7:
        md.append('| ' + ' | '.join(v[:7]) + ' |')
md.append('\n## Status\n| Name | Status | Image |\n|---|---|---|')
for l in sec['docker_ps']:
    md.append('| ' + ' | '.join(l.split(';')[:3]) + ' |')
md.append('\n## Sizes\n| Path | Size |\n|---|---|')
for l in sorted(sec['sizes'], key=lambda l: -num(l.split(';')[-1])):
    p, b = l.rsplit(';', 1)
    md.append('| %s | %.2f GB |' % (p, num(b) / GB) if num(b) >= GB / 10 else '| %s | %.0f MB |' % (p, num(b) / 2 ** 20))
md.append('\n## Busiest processes now\n| Process | CPU % | RAM | Running |\n|---|---|---|---|')
for l in sec['top']:
    v = l.split(';')
    if len(v) == 4:
        md.append('| %s | %s | %.0f MB | %.1f h |' % (v[0], v[1], num(v[2]) / 2 ** 20, num(v[3]) / 3600))
if cpu:
    days = defaultdict(lambda: defaultdict(list))
    for s, k, name in [(cpu, 1, 'cpu'), (mem, 1, 'mem'), (fs, 1, 'disk'), (load, 1, 'load')]:
        for x in s:
            days[datetime.fromtimestamp(x[0], TZ).strftime('%Y-%m-%d')][name].append(x[k])
    md.append('\n## By day (Sarajevo time)\n| Day | CPU avg | CPU max | RAM avg | RAM max | Disk | Load max |\n|---|---|---|---|---|---|---|')
    for d in sorted(days):
        v = days[d]
        f = lambda k, g: ('%.0f%%' % g(v[k])) if v[k] else '–'
        md.append('| %s | %s | %s | %s | %s | %s | %s |' % (d, f('cpu', lambda a: sum(a) / len(a)), f('cpu', max), f('mem', lambda a: sum(a) / len(a)),
                                                                   f('mem', max), f('disk', lambda a: a[-1]), ('%.2f' % max(v['load'])) if v['load'] else '–'))
    md.append('\nCharts: the **grafikoni** file at the bottom of this page (CPU, RAM, disk, load, network, containers).')
open(summary, 'a').write('\n'.join(md) + '\n')
print('\n'.join(md))
