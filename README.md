# Simuladores Infinito

Portal unificado de herramientas financieras de Infinito Créditos.

## Simuladores

- Sistema Francés
- Crédito UVA
- Creditcar
- TCF

## Uso local

Es un sitio estático. Para ejecutarlo desde la raíz del proyecto:

```bash
python3 -m http.server 8000
```

Luego abrí `http://localhost:8000`.

> No abras los HTML directamente con `file://`: algunos módulos usan JavaScript modular y consultas HTTP.

## Estructura

- `index.html`: menú principal.
- `frances/`, `uva/`, `creditcar/`, `tcf/`: simuladores independientes.
- `shared/`: consulta BCRA y estilos compartidos.
- `assets/`: recursos visuales.

Cada enlace “Volver al inicio” apunta explícitamente a `../index.html`, por lo que funciona aunque se acceda al simulador desde un enlace directo.
