import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

API_KEY = os.environ["API_FOOTBALL_KEY"]
ZONA = ZoneInfo("Europe/Madrid")
BASE_URL = "https://v3.football.api-sports.io"
CABECERAS = {"x-apisports-key": API_KEY}

# Cuantos partidos futuros como maximo se guardan por equipo (de sobra para
# las 6 semanas que muestra la agenda; los que caigan mas adelante
# simplemente no encuentran celda y no se pintan, no estorban).
MAX_PARTIDOS_POR_EQUIPO = 15

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
    time.sleep(1.3)  # el plan gratis limita a 10 peticiones/minuto
    resp.raise_for_status()
    resultados = resp.json().get("response", [])

    for r in resultados:
        info = r.get("team", {})
        if equipo["nacional"] and info.get("national"):
            return info.get("id")
        if not equipo["nacional"] and not info.get("national"):
            return info.get("id")

    return None


def partidos_de_temporada(equipo_id, temporada):
    """Trae TODOS los partidos de un equipo en una temporada dada (el plan
    gratis de API-Football no da acceso al parametro 'next', asi que hay que
    pedir por 'season' y filtrar los futuros nosotros mismos). "temporada" es
    el año en que arranca la temporada segun la convencion de API-Football
    (ej. la Liga española 2026-2027 se pide como season=2026)."""
    resp = requests.get(
        f"{BASE_URL}/fixtures",
        headers=CABECERAS,
        params={"team": equipo_id, "season": temporada},
        timeout=30,
    )
    time.sleep(1.3)  # el plan gratis limita a 10 peticiones/minuto
    resp.raise_for_status()
    cuerpo = resp.json()

    # DIAGNOSTICO: si el plan gratis no da permiso para esto (o cualquier
    # otro motivo), API-Football normalmente NO devuelve un error HTTP:
    # devuelve 200 OK con "response" vacio y el motivo real dentro de
    # "errors". Sin esto no hay forma de distinguir "0 partidos" de "el
    # plan no deja consultar esto".
    errores = cuerpo.get("errors")
    if errores:
        print(f"  -> temporada {temporada}: errors de la API: {errores}")

    return cuerpo.get("response", [])


eventos = []
ahora_utc = datetime.now(ZoneInfo("UTC"))

for equipo in EQUIPOS_INTERES:
    try:
        equipo_id = buscar_id_equipo(equipo)
        if equipo_id is None:
            print(f"AVISO: no se encontro el equipo '{equipo['nombre']}' (busqueda: '{equipo['busqueda']}')")
            continue

        # Se piden DOS temporadas (el año actual y el anterior) porque cada
        # liga etiqueta sus temporadas distinto: las de calendario (MLS,
        # Colombia) usan el año en curso, pero las europeas (La Liga) siguen
        # llamandose con el año en que arrancaron hasta mayo/junio siguiente
        # (ej. en enero de 2027 La Liga todavia es la temporada "2026"). Asi
        # se cubren ambas convenciones sin tener que saber de antemano cual
        # usa cada equipo.
        anio_actual = datetime.now(ZONA).year
        vistos = set()  # ids de partido, para no duplicar si sale en ambas consultas
        partidos_futuros = []

        for temporada in (anio_actual, anio_actual - 1):
            for partido in partidos_de_temporada(equipo_id, temporada):
                fixture = partido.get("fixture", {})
                fixture_id = fixture.get("id")
                fecha_iso_utc = fixture.get("date")
                if not fecha_iso_utc or fixture_id in vistos:
                    continue

                momento_utc = datetime.fromisoformat(fecha_iso_utc)
                if momento_utc <= ahora_utc:
                    continue  # ya se jugo (o esta en juego), no interesa

                vistos.add(fixture_id)
                partidos_futuros.append((momento_utc, partido))

        partidos_futuros.sort(key=lambda par: par[0])
        partidos_futuros = partidos_futuros[:MAX_PARTIDOS_POR_EQUIPO]
        print(f"{equipo['nombre']} (id={equipo_id}): {len(partidos_futuros)} partidos proximos")

        for momento_utc, partido in partidos_futuros:
            equipos_partido = partido.get("teams", {})
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
