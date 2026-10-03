import json, csv, os
from collections import defaultdict

with open('/tmp/i9car_daily_p1.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)

rows_raw = raw.get('data', [])
paging = raw.get('paging', {})
next_url = paging.get('next')

agg = defaultdict(lambda: {
    'spend': 0.0, 'impressions': 0, 'clicks': 0,
    'conversas': 0, 'cpa_msg': None, 'cpc': None, 'ctr_sum': 0.0, 'ctr_n': 0
})

for r in rows_raw:
    cid = r.get('campaign_id', '')
    cname = r.get('campaign_name', '')
    date = r.get('date_start', '')
    spend = float(r.get('spend') or 0)
    imp = int(r.get('impressions') or 0)
    clk = int(r.get('clicks') or 0)
    ctr = float(r.get('ctr') or 0)
    conv = 0
    cpa = None
    cpc = None
    for a in r.get('actions') or []:
        if a.get('action_type') == 'onsite_conversion.messaging_conversation_started_7d':
            conv = int(a.get('value') or 0)
    for c in r.get('cost_per_action_type') or []:
        if c.get('action_type') == 'onsite_conversion.messaging_conversation_started_7d':
            cpa = float(c.get('value') or 0)
        if c.get('action_type') == 'link_click':
            cpc = float(c.get('value') or 0)
    key = (date, cid, cname)
    d = agg[key]
    d['spend'] += spend
    d['impressions'] += imp
    d['clicks'] += clk
    d['conversas'] += conv
    if cpa is not None: d['cpa_msg'] = cpa
    if cpc is not None: d['cpc'] = cpc
    if ctr > 0:
        d['ctr_sum'] += ctr
        d['ctr_n'] += 1

SALES = {
    ('2026-08-27', 'RAM'): '🏆 VENDA - RAM',
    ('2026-08-28', 'HILUX'): '🏆 VENDA - HILUX',
    ('2026-09-07', 'POLO'): '🏆 VENDA - POLO',
    ('2026-09-29', 'COBALT'): '🏆 VENDA - COBALT',
}

def sale_tag(date, name):
    n = (name or '').upper()
    for (d, k), tag in SALES.items():
        if date == d and k in n:
            return tag
    return ''

out_rows = []
for (date, cid, cname), d in agg.items():
    ctr_avg = (d['ctr_sum'] / d['ctr_n']) if d['ctr_n'] else 0
    out_rows.append({
        'date': date,
        'campaign': cname,
        'spend': d['spend'],
        'impressions': d['impressions'],
        'clicks': d['clicks'],
        'ctr': ctr_avg,
        'conversas': d['conversas'],
        'cpa_msg': d['cpa_msg'] if d['cpa_msg'] is not None else 0,
        'cpc': d['cpc'] if d['cpc'] is not None else 0,
        'sale': sale_tag(date, cname),
    })

out_rows.sort(key=lambda x: (x['date'], -x['spend']))

csv_path = r'C:\Users\kauaf\swipe-ofertas\relatorio-i9car-historico-26ago-29set.csv'
with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['Data','Campanha','Gasto (R$)','Impressões','Cliques','CTR (%)','Conversas WhatsApp','CPA Msg (R$)','CPC (R$)','Observação'])
    for r in out_rows:
        w.writerow([
            r['date'], r['campaign'],
            f"{r['spend']:.2f}", r['impressions'], r['clicks'],
            f"{r['ctr']:.2f}", r['conversas'],
            f"{r['cpa_msg']:.2f}", f"{r['cpc']:.2f}",
            r['sale']
        ])

total_spend = sum(r['spend'] for r in out_rows)
total_conv = sum(r['conversas'] for r in out_rows)
total_imp = sum(r['impressions'] for r in out_rows)
total_clk = sum(r['clicks'] for r in out_rows)
days = len(set(r['date'] for r in out_rows))
campaigns = len(set(r['campaign'] for r in out_rows))

summary_path = r'C:\Users\kauaf\swipe-ofertas\relatorio-i9car-resumo.txt'
with open(summary_path, 'w', encoding='utf-8') as f:
    f.write(f"Período: 2026-08-26 a 2026-09-29\n")
    f.write(f"Dias com anúncio: {days}\n")
    f.write(f"Campanhas únicas: {campaigns}\n")
    f.write(f"Gasto total: R$ {total_spend:.2f}\n")
    f.write(f"Gasto médio/dia: R$ {total_spend/max(days,1):.2f}\n")
    f.write(f"Total impressões: {total_imp}\n")
    f.write(f"Total cliques: {total_clk}\n")
    f.write(f"Total conversas WhatsApp: {total_conv}\n")
    f.write(f"CPA mensagem médio: R$ {total_spend/max(total_conv,1):.2f}\n")
    f.write(f"CTR médio: {total_clk/max(total_imp,1)*100:.2f}%\n")
    f.write(f"\nVendas registradas: Hilux, RAM, Polo, Cobalt (4)\n")
    f.write(f"Custo por venda (tráfego): R$ {total_spend/4:.2f}\n")

print(f"ROWS={len(out_rows)} DAYS={days} CAMPAIGNS={campaigns} SPEND={total_spend:.2f} CONV={total_conv}")
print(f"CSV={csv_path}")
print(f"NEXT_URL={'YES' if next_url else 'NO'}")