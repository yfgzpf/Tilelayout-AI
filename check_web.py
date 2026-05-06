import httpx
r = httpx.get('http://127.0.0.1:3000/')
print('Status:', r.status_code, 'Length:', len(r.text))
print('Has root div:', 'id="root"' in r.text)
print('Has script:', '<script' in r.text)
# API proxy test
r2 = httpx.get('http://127.0.0.1:3000/api/v1/projects/')
print('API proxy:', r2.status_code)
r3 = httpx.get('http://127.0.0.1:8000/api/v1/projects/')
print('API direct:', r3.status_code)
print('OK' if r.status_code == 200 else 'FAIL')
