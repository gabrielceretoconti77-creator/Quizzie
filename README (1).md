# Mi Quizlet

Web de estudio (flashcards, Aprender, Test) con cuentas y guardado en Supabase. Sin framework ni paso de compilación: solo HTML, CSS y JavaScript.

## Estructura
```
index.html        esqueleto de la página y carga de scripts
css/styles.css    estilos (modo claro/oscuro automático)
js/app.js         toda la lógica, dividida en 9 secciones comentadas
supabase.sql      tabla y reglas de seguridad
```

## Puesta en marcha
1. Crea un proyecto en https://supabase.com.
2. En **SQL Editor**, ejecuta el contenido de `supabase.sql` (crea la tabla y las reglas RLS: cada usuario solo ve y edita lo suyo).
3. En **Project Settings → API** copia la *Project URL* y la clave *anon / publishable*. Pégalas en `js/app.js`, en las constantes `SB_URL` y `SB_KEY`. La clave anon es pública por diseño; la seguridad la dan las reglas RLS. **Nunca** pongas la `service_role`.
4. En **Authentication → URL Configuration**, pon como *Site URL* la dirección de tu GitHub Pages (`https://TU-USUARIO.github.io/TU-REPO/`) para que los enlaces de confirmación del correo funcionen. Para pruebas puedes desactivar *Confirm email* en Authentication → Providers → Email.
5. Sube `index.html` a un repositorio de GitHub y activa **Settings → Pages → Deploy from a branch → main / (root)**.

Sin configurar Supabase, la web funciona igualmente en modo local (datos en el navegador).
