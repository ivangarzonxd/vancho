import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from icalendar import Calendar

ICS_URL = os.environ["GOOGLE_CALENDAR_ICS_URL"]
ZONA = ZoneInfo("Europe/Madrid")

respuesta = requests.get(ICS_URL, timeout=30)
respuesta.raise_for_status()
calendario = Calendar.from_ical(respuesta.text)

hoy = datetime.now(ZONA).date()
limite = hoy + timedelta(days=45)

eventos = []

for componente in calendario.walk():
    if componente.name != "VEVENT":
        continue

    titulo = str(componente.get("summary", "")).strip()
    if ":" in titulo:
        tipo, nota = titulo.split(":", 1)
        tipo = tipo.strip().lower()
        nota = nota.strip()
    else:
        tipo = "evento"
        nota = titulo

    dtstart = componente.get("dtstart").dt

    if isinstance(dtstart, datetime):
        if dtstart.tzinfo is None:
            dtstart = dtstart.replace(tzinfo=ZONA)
        else:
            dtstart = dtstart.astimezone(ZONA)
        fecha = dtstart.date()
        hora = dtstart.strftime("%H:%M")
    else:
        fecha = dtstart
        hora = None

    if tipo != "tarea" and (fecha < hoy or fecha > limite):
        continue

    eventos.append({"fecha": fecha.isoformat(), "tipo": tipo, "nota": nota, "hora": hora})

eventos.sort(key=lambda e: (e["fecha"], e["hora"] or "00:00"))

lineas = ["const eventosCalendario = ["]
for e in eventos:
    hora_js = f'"{e["hora"]}"' if e["hora"] else "null"
    nota_escapada = e["nota"].replace('"', '\\"')
    tipo_escapado = e["tipo"].replace('"', '\\"')
    lineas.append(f'  {{ fecha: "{e["fecha"]}", tipo: "{tipo_escapado}", nota: "{nota_escapada}", hora: {hora_js} }},')
lineas.append("];")

with open("js/datos-agenda.js", "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")

print(f"{len(eventos)} eventos escritos en js/datos-agenda.js")
