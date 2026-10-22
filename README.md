# Pulso — finanzas, hábitos y tareas

Aplicación Android personal con Expo / React Native y Supabase. La interfaz base usa verde, blanco, negro y grises neutros; no usa tonos morados.

## Estructura inicial

- `app/index.tsx`: dashboard diario y navegación visual inicial.
- `app/_layout.tsx`: navegación raíz de Expo Router.
- `supabase/schema.sql`: tablas PostgreSQL y políticas RLS.
- `src/lib/habits.ts`: cálculos de éxito de hábitos.
- `src/lib/supabase.ts` y `src/lib/auth.ts`: cliente Supabase y registro/inicio/cierre de sesión por email.

## Navegación propuesta

`Acceso → Dashboard` como inicio. El dashboard tiene accesos directos a **Registrar gasto**, **Marcar hábito** y **Añadir tarea**. Una barra inferior permite cambiar entre:

- **Inicio:** resumen diario, balance mensual, hábitos de hoy y tareas próximas.
- **Finanzas:** balance, lista de ingresos/gastos, alta rápida, categorías y metas con progreso/fecha límite.
- **Hábitos:** lista editable, calendario de cumplimiento y tasas diaria/semanal.
- **Tareas:** semana lunes-domingo, filtro por día, crear/editar/completar y contadores total/pendientes/completadas.

En el flujo de acceso, el registro crea la cuenta Auth y el perfil; al cerrar sesión se vuelve a Acceso. Las pantallas de módulos guardan `user_id` desde la sesión, nunca desde campos editables del cliente.

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

En Supabase quedó habilitado el proveedor **Email**, permitido el registro de usuarios y desactivado **Confirm email** en Authentication → Sign In / Providers. El registro puede iniciar sesión de inmediato; las direcciones no quedan verificadas. Por ahora, las métricas del dashboard son datos de muestra; los formularios de acceso sí están conectados al proyecto.
