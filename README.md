# Pulso — finanzas, hábitos y tareas

Aplicación Android personal con Expo / React Native y Supabase. La identidad visual es cósmica y minimalista: fondo azul noche casi negro, superficies oscuras, texto blanco y acentos verde lunar. El emblema oficial usa la ilustración Azokar Space proporcionada para la luna y la letra A. Se excluyen los tonos morados.

## Estructura inicial

- `app/index.tsx`: autenticación, perfil y navegación inferior.
- `src/screens/`: dashboard y módulos conectados a Supabase.
- `app/_layout.tsx`: navegación raíz de Expo Router.
- `src/components/MoonMark.tsx`: componente con el logotipo oficial de Azokar Space.
- `assets/images/azokar-*`: logotipo, iconos adaptables de Android, splash y favicon.
- `supabase/schema.sql`: tablas PostgreSQL y políticas RLS.
- `src/lib/habits.ts`: cálculos de éxito de hábitos.
- `src/lib/supabase.ts` y `src/lib/auth.ts`: cliente Supabase y registro/inicio/cierre de sesión por email.

## Pantallas

`Acceso → Dashboard` como inicio. El dashboard tiene accesos directos a **Registrar gasto**, **Marcar hábito** y **Añadir tarea**. Una barra inferior permite cambiar entre:

- **Inicio:** balance del mes, porcentaje de hábitos y tareas próximas; cada acceso rápido abre su módulo.
- **Finanzas:** registrar ingresos y gastos por categoría, consultar movimientos, crear metas y añadir aportes.
- **Hábitos:** crear hábitos por días de la semana, marcarlos al completar y consultar tasas diaria/semanal con umbral del 80%.
- **Tareas:** programar tareas por día de lunes a domingo, marcarlas completas y consultar contadores semanales.

En el flujo de acceso, el registro solicita nombre, apellido, email y contraseña, y crea el perfil. El avatar del dashboard abre el perfil, donde se editan nombre y apellido y se puede elegir una foto del dispositivo para subirla a Supabase Storage; los cambios se guardan directamente en Supabase. Desde ahí también se puede cerrar sesión. Las pantallas de módulos guardan `user_id` desde la sesión, nunca desde campos editables del cliente.

## Datos y cálculos

| Tabla | Uso / claves principales |
| --- | --- |
| `profiles` | Perfil por usuario; `id` es FK a `auth.users`. Se crea desde un trigger de Auth. |
| `categories` | Categorías de ingreso/gasto; `user_id` FK a Auth. |
| `transactions` | Movimientos con importe positivo, tipo, categoría opcional y fecha; FK compuesta categoría/usuario. |
| `financial_goals` | Nombre, objetivo, saldo actual y fecha límite opcional. |
| `habits` | Hábito activo y días programados ISO (lunes=1…domingo=7). |
| `habit_logs` | Estado diario por hábito; único por hábito y fecha. |
| `weekly_tasks` | Título, detalle, fecha programada y `completed_at` nullable. |

El éxito diario es `completados / programados * 100`; es exitoso desde 80% inclusive. La tasa semanal promedia las tasas de cada día que tenga al menos un hábito programado; también requiere 80% inclusive. Días sin hábitos programados no se cuentan en el promedio. Las funciones implementadas están en `src/lib/habits.ts`.

## Arranque

El proyecto está creado con Expo SDK 58 y Expo Router. Ejecuta `npm install` si hace falta y `npm start`; presiona `a` para abrirlo en un emulador Android o escanea el QR con Expo Go. `npm run typecheck` verifica los tipos. La app lee sus claves desde `.env.local`.

## Autenticación por correo

La pantalla inicial tiene formulario de registro e inicio de sesión con email y contraseña. Pulsa el avatar del dashboard para cerrar sesión. Supabase Auth gestiona las contraseñas; el trigger `handle_new_user` crea el perfil al registrar la cuenta.

## Datos y privacidad

El esquema de `supabase/schema.sql` ya se ejecutó en el proyecto Supabase `Azokar` y las siete tablas quedaron creadas. Todas las tablas de usuario tienen RLS y políticas que restringen filas al usuario autenticado. La URL y la publishable key se configuran localmente en `.env.local`, excluido de Git; copia `.env.example` para otros entornos. Instala las dependencias móviles con `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`.

En Supabase quedó habilitado el proveedor **Email**, permitido el registro de usuarios y desactivado **Confirm email** en Authentication → Sign In / Providers. El registro puede iniciar sesión de inmediato; las direcciones no quedan verificadas. Para un proyecto donde `schema.sql` ya estaba aplicado, ejecuta `supabase/migrations/20261022_profile_fields.sql` en Supabase → SQL Editor para añadir los campos del perfil, actualizar el trigger y configurar el bucket público `avatars` con políticas de escritura por usuario. Las pantallas financieras, hábitos y tareas consultan y guardan datos en Supabase.

## Registro rápido por voz

El botón flotante del micrófono permite decir una instrucción ("gasto de ocio 150 mil", "tarea mañana llamar al banco", "press de banca 60 kg 10 repeticiones"). El teléfono convierte la voz en texto, Gemini la interpreta y el registro se guarda solo, con aviso y opción de deshacer. Cada usuario pega su propia clave gratuita de Gemini en su perfil: se guarda cifrada en el almacén seguro del teléfono (`expo-secure-store`), nunca en Supabase, y viaja en una cabecera HTTPS hacia Google. La app valida lo que devuelve el modelo (fechas, montos, ejercicios existentes) antes de guardar. Requiere un build nativo (APK de EAS), no funciona en Expo Go.

## Seguridad

- Todas las tablas tienen RLS con políticas de "solo el dueño" (`user_id = auth.uid()`); la función `finance_totals` filtra por el usuario autenticado y no es ejecutable por anónimos.
- El bucket `avatars` es público para mostrar las fotos por URL, pero solo cada usuario puede listar, subir, actualizar o borrar archivos de su carpeta (`supabase/migrations/20261101_security_hardening.sql`).
- Las funciones de disparador de Auth no son invocables desde la API.
- Nunca se usa la clave `service_role` en la app. Las claves van en `.env.local` y en variables de entorno de EAS, fuera de Git. Si encuentras una vulnerabilidad, avísalo en privado antes de publicarla.
