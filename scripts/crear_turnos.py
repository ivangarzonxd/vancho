import os
import requests

CLIENT_ID = os.environ["GOOGLE_OAUTH_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_OAUTH_CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["GOOGLE_OAUTH_REFRESH_TOKEN"]
TURNOS = os.environ["TURNOS"]

# 1. Cambiar el refresh token por un access token nuevo
respuesta_token = requests.post(
    "https://oauth2.googleapis.com/token",
    data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token",
    },
    timeout=30,
)
respuesta_token.raise_for_status()
access_token = respuesta_token.json()["access_token"]

# 2. TURNOS llega como un solo texto: eventos separados por ";", cada uno "FECHA|NOTA"
#    Ejemplo: 2026-09-01|Oficina;2026-09-02|Casa;2026-09-03|Descanso
creados = 0
for item in TURNOS.strip().split(";"):
    item = item.strip()
    if not item or "|" not in item:
        continue
    fecha, nota = item.split("|", 1)
    fecha = fecha.strip()
    nota = nota.strip()
    if not fecha or not nota:
        continue

    evento = {
        "summary": f"Trabajo: {nota}",
        "start": {"date": fecha},
        "end": {"date": fecha},
    }

    resp = requests.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        headers={"Authorization": f"Bearer {access_token}"},
        json=evento,
        timeout=30,
    )
    resp.raise_for_status()
    creados += 1

print(f"{creados} eventos de trabajo creados en el calendario")
