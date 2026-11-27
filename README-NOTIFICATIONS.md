# Notificaciones de MyDay en iPhone

MyDay usa Web Push. En iPhone/iPad se necesita iOS/iPadOS 16.4 o posterior y abrir la app desde un icono agregado a la pantalla de inicio. GitHub Pages aloja la interfaz, pero no ejecuta tareas programadas; por eso el envío se hace con Cloudflare Workers + D1.

## 1. Crear las claves VAPID

Necesitás Node.js instalado. Desde la carpeta del repositorio:

```bash
node push/generate-vapid.mjs
```

Guardá los tres valores que imprime el comando. **No publiques VAPID_PRIVATE_KEY ni la compartas.** La clave pública sí se coloca en `push-config.js`.

## 2. Crear la base de datos D1

Instalá Wrangler e iniciá sesión en Cloudflare:

```bash
npm install -g wrangler
wrangler login
cd push
wrangler d1 create myday-push
```

Copiá el `database_id` que devuelve Cloudflare y reemplazá el valor de `database_id` en `push/wrangler.toml`.

Desde la carpeta `push`, ejecutá:

```bash
wrangler d1 execute myday-push --remote --file=./schema.sql
```

## 3. Configurar secretos y publicar el Worker

Desde la carpeta `push`, cargá los valores VAPID:

```bash
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_SUBJECT
```

Para `VAPID_SUBJECT`, usá el valor de contacto que generaste, por ejemplo `mailto:tu-correo@example.com`.

Publicá:

```bash
wrangler deploy
```

Cloudflare mostrará una dirección parecida a `https://myday-push.<tu-cuenta>.workers.dev`. Copiala.

## 4. Configurar MyDay

Editá `push-config.js` en la raíz del repositorio:

- `workerUrl`: la dirección `workers.dev` del Worker.
- `publicKey`: el valor `VAPID_PUBLIC_KEY` que generaste.

Guardá y subí los cambios a GitHub. No pegues la clave privada en ningún archivo del repositorio.

## 5. Activar en el iPhone

1. Actualizá MyDay desde Safari y usá Compartir → Agregar a pantalla de inicio.
2. Abrí MyDay desde el nuevo icono, no desde una pestaña de Safari.
3. Entrá en Recordatorios y tocá **Activar notificaciones**.
4. Aceptá el permiso de iOS.
5. Creá un recordatorio de prueba para dentro de unos minutos y cerrá MyDay.

El Worker revisa los avisos vencidos cada minuto. La entrega real depende también del servicio push de Apple y de la conexión del dispositivo.

## Notas

- Los recordatorios y eventos existentes siguen guardándose en el almacenamiento local del iPhone.
- MyDay sincroniza con el Worker los próximos 60 días de recordatorios, avisos de eventos, rutinas de gimnasio y avisos de partidos configurados.
- Cada dispositivo tiene una suscripción propia. Si borrás los datos del navegador o reinstalás MyDay, volvé a activar las notificaciones.
- No hay que subir claves privadas, tokens ni datos de autenticación a GitHub.
