import json, urllib.request, urllib.error, time

BASE = 'http://localhost:3001'
ROOM = '23bb82bb-3c82-412b-9899-46a26a95003a'
AGENT = '180dec6d-fa7e-417c-be63-dad990dd916e'


def call(path, method='GET', body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if body:
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(body).encode()
    return json.load(urllib.request.urlopen(req, timeout=90))


r = call(f'/api/agents/{AGENT}', 'PUT', {
    'name': 'hermes',
    'type': 'openai-compatible',
    'api_endpoint': 'https://token.lightvela.ai/v1/chat/completions',
    'config': {'model': 'deepseek-v4-pro-202606', 'maxTokens': 1024},
    'room_id': ROOM,
    'active': True
})
print('assign agent->room:', r.get('success'))

r = call('/api/messages', 'POST', {
    'room_id': ROOM,
    'content': '@hermes halo, ini test. Jawab singkat: 1+1 berapa?',
    'clientTimestamp': '2026-11-20T03:17:00Z'
})
print('send:', r.get('success'))

for _ in range(12):
    time.sleep(5)
    msgs = call(f'/api/messages/room/{ROOM}')['data']
    agent_msgs = [m for m in msgs if m.get('agent_id')]
    if agent_msgs:
        print('AGENT REPLY:', agent_msgs[-1]['content'][:300])
        break
    print('waiting...')
else:
    print('no agent reply yet; last messages:', [m['content'][:60] for m in msgs[-3:]])
