import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests

ZONA = ZoneInfo("Europe/Madrid")
BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer"

# Hasta cuantos dias hacia adelante se piden partidos (igual que el horizonte
# de 45 dias que ya usa scripts/actualizar_datos.py para la agenda de Google).
RANGO_DIAS = 45

# Ligas/competiciones que hay que consultar para cubrir a los 5 equipos.
# Un mismo partido de Champions entre dos de "nuestros" equipos, por ejemplo,
# solo se pide una vez por liga, no una vez por equipo.
#
# OJO: esto es la API "escondida" (no oficial, no documentada) que usa
# espn.com para su propia pagina. No hace falta ninguna cuenta ni api key,
# pero por lo mismo puede cambiar de un dia a otro sin aviso.
LIGAS_A_CONSULTAR = [
    # Real Madrid / Barcelona
    "esp.1",                 # LaLiga
    "uefa.champions",        # Champions League
    "esp.copa_del_rey",      # Copa del Rey
    "esp.super_cup",         # Supercopa de España
    # Millonarios
    "col.1",                 # Primera A de Colombia
    "col.copa",              # Copa Colombia
    "conmebol.libertadores", # Copa Libertadores
    "conmebol.sudamericana", # Copa Sudamericana
    # Inter Miami
    "usa.1",                 # MLS
    "concacaf.leagues.cup",  # Leagues Cup
    "usa.open",              # US Open Cup
    "concacaf.champions",    # Concacaf Champions Cup
    # Seleccion Colombia
    "fifa.friendly",         # Amistosos de selecciones
    "fifa.worldq.conmebol",  # Eliminatorias Mundial (CONMEBOL)
    "conmebol.america",      # Copa America
]

# "clave" es el texto (en minusculas) que debe estar CONTENIDO en el nombre
# de un equipo de ESPN para identificarlo (ej. el nombre real en ESPN es
# "Inter Miami CF", pero con que aparezca "inter miami" ya es suficiente).
EQUIPOS_INTERES = [
    {"clave": "millonarios", "nombre": "Millonarios FC"},
    {"clave": "inter miami", "nombre": "Inter Miami"},
    {"clave": "colombia", "nombre": "Selección Colombia"},
    {"clave": "real madrid", "nombre": "Real Madrid"},
    {"clave": "barcelona", "nombre": "Barcelona"},
]


def partidos_de_liga(liga, desde, hasta):
    """Trae todos los partidos programados de una liga/competicion en el
    rango de fechas dado (formato AAAAMMDD), sin filtrar por equipo todavia."""
    resp = requests.get(
        f"{BASE_URL}/{liga}/scoreboard",
        params={"dates": f"{desde}-{hasta}", "limit": 200},
        timeout=30,
    )
    time.sleep(1)  # cortesia: no hay limite publicado, pero mejor no abusar
    resp.raise_for_status()
    return resp.json().get("events", [])


hoy = datetime.now(ZONA).date()
desde = hoy.strftime("%Y%m%d")
hasta = (hoy + timedelta(days=RANGO_DIAS)).strftime("%Y%m%d")

# Junta TODOS los partidos de todas las ligas en una sola lista antes de
# buscar los de nuestros equipos (asi un partido entre dos equipos de
# interes, si lo hubiera, no sale duplicado).
todos_los_partidos = []
for liga in LIGAS_A_CONSULTAR:
    try:
        partidos = partidos_de_liga(liga, desde, hasta)
        print(f"Liga {liga}: {len(partidos)} partidos en los proximos {RANGO_DIAS} dias")
        todos_los_partidos.extend(partidos)
    except requests.RequestException as e:
        # Si una liga falla (la API no oficial se cae, cambia de forma, etc.)
        # las demas ligas y equipos siguen intentandose igual.
        print(f"ERROR consultando la liga '{liga}': {e}")

eventos = []

for equipo in EQUIPOS_INTERES:
    encontrados = 0
    for partido in todos_los_partidos:
        competidores = (partido.get("competitions") or [{}])[0].get("competitors", [])
        if len(competidores) != 2:
            continue

        nombres = [c.get("team", {}).get("displayName", "") for c in competidores]
        coincide = [equipo["clave"] in n.lower() for n in nombres]
        if not any(coincide):
            continue

        fecha_iso_utc = partido.get("date")  # ej: "2026-08-30T18:30Z"
        if not fecha_iso_utc:
            continue
        momento_utc = datetime.fromisoformat(fecha_iso_utc.replace("Z", "+00:00"))
        momento_madrid = momento_utc.astimezone(ZONA)

        # El rival es "el otro" de los dos competidores encontrados.
        idx_propio = coincide.index(True)
        rival = nombres[1 - idx_propio]

        eventos.append({
            "fecha": momento_madrid.date().isoformat(),
            "tipo": "partido",
            "nota": f"{equipo['nombre']} vs {rival}",
            "hora": momento_madrid.strftime("%H:%M"),
        })
        encontrados += 1

    print(f"{equipo['nombre']}: {encontrados} partidos proximos")

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
