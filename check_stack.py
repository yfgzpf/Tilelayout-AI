import httpx
r = httpx.get('http://127.0.0.1:3000/')
print(f'FRONTEND: {r.status_code} len={len(r.text)}')
r2 = httpx.get('http://127.0.0.1:8000/health')
print(f'BACKEND:  {r2.status_code} {r2.json()}')
r3 = httpx.post('http://127.0.0.1:8000/api/v1/projects/demo/calculate', json={
    'config': {'tile_width':800,'tile_height':800,'gap_width':3,'direction':'horizontal','start_point':[0,0]}
})
d = r3.json()
s = d['data']['statistics']
print(f'CALC API: {r3.status_code} tiles={s["total_tiles"]} whole={s["whole_tiles"]} cut={s["cut_tiles"]}')
print('ALL OK!')
