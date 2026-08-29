import os
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

API_KEY = os.environ["API_FOOTBALL_KEY"]
ZONA = ZoneInfo("Europe/Madrid")
BASE_URL = "https://v3.football.api-sports.io"
CABECERAS = {"x-apisports-key": API_KEY}

# Equipos a seguir. "busqueda" es el texto que se le manda al buscador de
# equipos de API-Football (GET /teams?search=...) para encontrar su id;
# "nacional" marca que es una seleccion (para no confundirla con un club
# que se llame igual, ej. clubes amateurs llamados "Colombia").
EQUIPOS_INTERES = [
    {"busqueda": "Millonarios", "nombre": "Millonarios FC", "nacional": False},
    {"busqueda": "Inter Miami", "nombre": "Inter Miami", "nacional": False},
    {"busqueda": "Colombia", "nombre": "Selección Colombia", "nacional": True},
    {"busqueda": "Real Madrid", "nombre": "Real Madrid", "nacional": False},
    {"busqueda": "Barcelona", "nombre": "Barcelona", "nacional": False},
]


def buscar_id_equipo(equipo):
    """Busca el id de API-Football para un equipo por nombre. Devuelve None
    si no se encuentra (o si la busqueda de una seleccion no trae ningun
    resultado marcado como 'national')."""
    resp = requests.get(
        f"{BASE_URL}/teams",
        headers=CABECERAS,
        params={"search": equipo["busqueda"]},
        timeout=30,
    )
    resp.raise_for_status()
    resultados = resp.json().get("response", [])

    for r in resultados:
        info = r.get("team", {})
        if equipo["nacional"] and info.get("national"):
            return info.get("id")
        if not equipo["nacional"] and not info.get("national"):
            return info.get("id")

    return None


def proximos_partidos(equipo_id):
    """Trae los proximos partidos programados de un equipo (cualquier
    competicion), sin depender de en que temporada/liga esten."""
    resp = requests.get(
        f"{BASE_URL}/fixtures",
        headers=CABECERAS,
        params={"team": equipo_id, "next": 15},
        timeout=30,
    )
    resp.raise_for_status()
    cuerpo = resp.json()

    # DIAGNOSTICO: si el plan gratis no da permiso para este equipo/liga (o
    # cualquier otro motivo), API-Football normalmente NO devuelve un error
    # HTTP: devuelve 200 OK con "response" vacio y el motivo real dentro de
    # "errors". Sin esto no hay forma de distinguir "0 partidos programados"
    # de "el plan no deja consultar esto".
    errores = cuerpo.get("errors")
    if errores:
        print(f"  -> errors de la API: {errores}")
    print(f"  -> results={cuerpo.get('results')} paging={cuerpo.get('paging')}")

    return cuerpo.get("response", [])


eventos = []

for equipo in EQUIPOS_INTERES:
    try:
        equipo_id = buscar_id_equipo(equipo)
        if equipo_id is None:
            print(f"AVISO: no se encontro el equipo '{equipo['nombre']}' (busqueda: '{equipo['busqueda']}')")
            continue

        partidos = proximos_partidos(equipo_id)
        print(f"{equipo['nombre']} (id={equipo_id}): {len(partidos)} partidos proximos")

        for partido in partidos:
            fixture = partido.get("fixture", {})
            equipos_partido = partido.get("teams", {})

            fecha_iso_utc = fixture.get("date")  # ej: "2026-09-05T19:00:00+00:00"
            if not fecha_iso_utc:
                continue

            momento_utc = datetime.fromisoformat(fecha_iso_utc)
            momento_madrid = momento_utc.astimezone(ZONA)
            fecha = momento_madrid.date().isoformat()
            hora = momento_madrid.strftime("%H:%M")

            local_id = equipos_partido.get("home", {}).get("id")
            es_local = str(local_id) == str(equipo_id)
            rival = (equipos_partido.get("away") if es_local else equipos_partido.get("home") or {}).get("name", "?")

            nota = f"{equipo['nombre']} vs {rival}"
            eventos.append({"fecha": fecha, "tipo": "partido", "nota": nota, "hora": hora})
    except requests.RequestException as e:
        # Si falla un equipo (limite de peticiones, id no encontrado, etc.) no se
        # cae todo el script: simplemente ese equipo se queda sin partidos hoy.
        print(f"ERROR con '{equipo['nombre']}': {e}")

eventos.sort(key=lambda e: (e["fecha"], e["hora"] or "00:00"))

lineas = [
    "// Datos de partidos de futbol, generados automaticamente por scripts/actualizar_partidos.py",
    "// (se sobreescribe cada madrugada via GitHub Actions; no editar a mano, se perderia).",
    "// Mismo formato que datos-agenda.js: fecha (YYYY-MM-DD), tipo ('partido'), nota (texto), hora (HH:MM).",
    "const eventosPartidos = [",
]
for e in eventos:
    nota_escapada = e["nota"].replace('"', '\\"')
    lineas.append(f'  {{ fecha: "{e["fecha"]}", tipo: "partido", nota: "{nota_escapada}", hora: "{e["hora"]}" }},')
lineas.append("];")

with open("js/datos-partidos.js", "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")

print(f"{len(eventos)} partidos escritos en js/datos-partidos.js")
