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

    dtstart_prop = componente.get("dtstart")
    dtstart = dtstart_prop.dt

    if isinstance(dtstart, datetime):
        # Guardado ANTES de tocar nada, solo para el mensaje de diagnostico de abajo.
        tzinfo_crudo = dtstart.tzinfo
        tzid_crudo = dtstart_prop.params.get("TZID")

        if dtstart.tzinfo is None:
            # Un dtstart "naive" (sin zona horaria) NO significa que ya este en
            # Europe/Madrid: significa que la libreria icalendar no pudo resolver
            # el TZID del evento a una zona conocida. Si el evento SI trae un TZID
            # (ej. "America/Bogota", que es lo que usa tu cuenta de Google por
            # defecto), hay que interpretar la hora tal cual en ESA zona antes de
            # convertirla a Madrid — si no, la hora queda desplazada varias horas.
            zona_origen = ZoneInfo(str(tzid_crudo)) if tzid_crudo else ZONA
            dtstart = dtstart.replace(tzinfo=zona_origen)
        dtstart = dtstart.astimezone(ZONA)
        fecha = dtstart.date()
        hora = dtstart.strftime("%H:%M")

        # DIAGNOSTICO TEMPORAL: se puede borrar esta linea una vez se confirme que
        # las horas ya pintan bien. Se ve en el log de GitHub Actions (pestaña
        # "Actions" del repo -> la corrida mas reciente -> el paso que ejecuta este
        # script). Muestra la hora TAL CUAL vino del calendario (antes de tocarla) y
        # en que queda despues de la conversion, para poder ver EXACTAMENTE donde
        # se desplaza si algun evento sigue pintando con la hora que no es.
        print(f"DEBUG hora: '{nota}' | dtstart crudo={dtstart_prop.dt} (tzinfo={tzinfo_crudo!r}, TZID del ics={tzid_crudo!r}) | -> queda fecha={fecha} hora={hora} (Europe/Madrid)")
    else:
        fecha = dtstart
        hora = None

    if tipo != "tarea" and (fecha < hoy or fecha > limite):
        continue

    eventos.append({"fecha": fecha.isoformat(), "tipo": tipo, "nota": nota, "hora": hora})

eventos.sort(key=lambda e: (e["fecha"], e["hora"] or "00:00"))

lineas = [
    "// Datos de la agenda, generados automaticamente por scripts/actualizar_datos.py",
    "// (se sobreescribe cada madrugada via GitHub Actions; no editar a mano, se perderia).",
    "// Cada evento: fecha (YYYY-MM-DD), tipo (trabajo/evento/tarea/...), nota (texto), hora (HH:MM o null).",
    "const eventosCalendario = [",
]
for e in eventos:
    hora_js = f'"{e["hora"]}"' if e["hora"] else "null"
    nota_escapada = e["nota"].replace('"', '\\"')
    tipo_escapado = e["tipo"].replace('"', '\\"')
    lineas.append(f'  {{ fecha: "{e["fecha"]}", tipo: "{tipo_escapado}", nota: "{nota_escapada}", hora: {hora_js} }},')
lineas.append("];")

with open("js/datos-agenda.js", "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")

print(f"{len(eventos)} eventos escritos en js/datos-agenda.js")
