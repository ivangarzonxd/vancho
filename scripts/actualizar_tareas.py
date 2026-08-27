import os
import requests

CLIENT_ID = os.environ["GOOGLE_OAUTH_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_OAUTH_CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["GOOGLE_OAUTH_REFRESH_TOKEN"]

# 1. Cambiar el refresh token (permanente) por un access token nuevo (dura poco, por eso se pide cada vez)
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

# 2. Leer las tareas pendientes (no completadas) de la lista por defecto de Google Tasks
respuesta_tareas = requests.get(
    "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
    headers={"Authorization": f"Bearer {access_token}"},
    params={"showCompleted": "false", "showHidden": "false"},
    timeout=30,
)
respuesta_tareas.raise_for_status()
items = respuesta_tareas.json().get("items", [])

# 3. Ordenar por "position": es el orden en que arrastraste las tareas en la app (arriba = mas urgente)
items.sort(key=lambda t: t.get("position", ""))
tareas = [t["title"] for t in items if t.get("title")]

# 4. Escribir el archivo que lee la pagina
lineas = ["const tareasPendientes = ["]
for texto in tareas:
    texto_escapado = texto.replace('"', '\\"')
    lineas.append(f'  "{texto_escapado}",')
lineas.append("];")

with open("js/datos-tareas.js", "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")

print(f"{len(tareas)} tareas escritas en js/datos-tareas.js")
