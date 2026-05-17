"""Curated, Bolivia-credible data used by the demo seeder.

Hand-maintained lists of apellidos, zones, property types, price ranges and
sales templates that read as authentic for the Bolivian real-estate market.
Faker fills in the rest (first names, sentences) in the seeder script.

Prices are in USD throughout — Bolivian real estate (and the higher-value
services around it) is quoted in dollars in practice.
"""

from __future__ import annotations

# Bolivian apellidos — mix of Spanish-origin and Aymara/Quechua-origin so the
# generated population reflects the country's actual surname distribution.
APELLIDOS: list[str] = [
    # Origen español
    "Vargas",
    "Flores",
    "Rojas",
    "Camacho",
    "Salinas",
    "Aguilar",
    "Mendoza",
    "Soliz",
    "Mercado",
    "Antezana",
    "Saavedra",
    "Suárez",
    "Montaño",
    "Lozada",
    "Villarroel",
    "Paz",
    "Sanjinés",
    "Calderón",
    "Arce",
    "Encinas",
    "Crespo",
    "Peñaranda",
    "Roca",
    "Áñez",
    "Reyes",
    "Terrazas",
    "Velasco",
    "Ortiz",
    "Pereira",
    "Cabrera",
    "Quiroga",
    # Origen aymara / quechua
    "Mamani",
    "Quispe",
    "Choque",
    "Condori",
    "Limachi",
    "Apaza",
    "Calle",
    "Ticona",
    "Huanca",
    "Yujra",
    "Laruta",
    "Conde",
    "Colque",
    "Poma",
    "Cusi",
    "Catari",
    "Aruquipa",
    "Chambi",
    "Yapu",
    "Nina",
]

# Zonas / barrios reconocibles por ciudad (eje troncal).
ZONES_BY_CITY: dict[str, list[str]] = {
    "La Paz": [
        "Calacoto",
        "Achumani",
        "Sopocachi",
        "Miraflores",
        "Obrajes",
        "San Miguel",
        "Irpavi",
        "Mallasilla",
        "La Florida",
        "Aranjuez",
        "Cota Cota",
        "Bolognia",
        "Los Pinos",
        "Següencoma",
        "Auquisamaña",
        "San Jorge",
        "Alto Obrajes",
    ],
    "Santa Cruz": [
        "Equipetrol",
        "Equipetrol Norte",
        "Las Palmas",
        "Urbarí",
        "Polanco",
        "Sirari",
        "Hamacas",
        "El Trompillo",
        "Av. Banzer 2do anillo",
        "Av. Banzer 4to anillo",
        "Av. Cristo Redentor",
        "Zona Norte",
        "Las Brisas",
        "Urubó",
    ],
    "Cochabamba": [
        "Cala Cala",
        "Queru Queru",
        "Tupuraya",
        "El Mirador",
        "Recoleta",
        "Aranjuez",
        "Hipódromo",
        "Sarco",
        "Cona Cona",
        "Tiquipaya",
        "Sacaba",
        "Pacata Alta",
        "Lomas de Aranjuez",
        "El Tejar",
    ],
}

PROPERTY_TYPES: list[str] = [
    "Departamento",
    "Casa",
    "Terreno",
    "Oficina",
    "Local comercial",
    "Galpón",
    "Quinta",
]

# Realistic USD price ranges keyed by (city, property_type). Bounds were
# calibrated against current listings on InfoCasas / Ultracasas Bolivia
# (mid-2026). Seeder picks uniformly within and rounds to the nearest $500.
PRICE_RANGES_USD: dict[tuple[str, str], tuple[int, int]] = {
    ("La Paz", "Departamento"): (75_000, 320_000),
    ("La Paz", "Casa"): (180_000, 850_000),
    ("La Paz", "Terreno"): (40_000, 250_000),
    ("La Paz", "Oficina"): (55_000, 280_000),
    ("La Paz", "Local comercial"): (45_000, 350_000),
    ("La Paz", "Galpón"): (90_000, 450_000),
    ("La Paz", "Quinta"): (150_000, 600_000),
    ("Santa Cruz", "Departamento"): (85_000, 380_000),
    ("Santa Cruz", "Casa"): (220_000, 950_000),
    ("Santa Cruz", "Terreno"): (35_000, 280_000),
    ("Santa Cruz", "Oficina"): (60_000, 320_000),
    ("Santa Cruz", "Local comercial"): (50_000, 400_000),
    ("Santa Cruz", "Galpón"): (110_000, 550_000),
    ("Santa Cruz", "Quinta"): (180_000, 750_000),
    ("Cochabamba", "Departamento"): (65_000, 260_000),
    ("Cochabamba", "Casa"): (150_000, 580_000),
    ("Cochabamba", "Terreno"): (28_000, 180_000),
    ("Cochabamba", "Oficina"): (50_000, 220_000),
    ("Cochabamba", "Local comercial"): (40_000, 320_000),
    ("Cochabamba", "Galpón"): (85_000, 420_000),
    ("Cochabamba", "Quinta"): (130_000, 480_000),
}

# Atributos / amenities para enriquecer los títulos de propiedades.
PROPERTY_FEATURES: list[str] = [
    "amplio",
    "luminoso",
    "con vista panorámica",
    "con jardín",
    "con parrillero",
    "con garaje doble",
    "recién estrenado",
    "remodelado",
    "con piscina",
    "en edificio nuevo",
    "con seguridad 24h",
    "esquinero",
    "frente al parque",
    "a estrenar",
    "con quincho",
    "amoblado",
    "con dependencia de servicio",
    "con terraza",
]

# Plantillas de servicios/productos para la tabla `sales`. Cada entrada es
# (plantilla, monto_min_usd, monto_max_usd). La plantilla acepta los
# placeholders {tipo} y {zona}.
#
# Dos categorías:
#   - LINKED_SALES_TEMPLATES: la venta está atada a una propiedad concreta
#     (comisiones, depósitos, anticrético, administración). El seeder SIEMPRE
#     asigna `Sale.property` para estas entradas.
#   - STANDALONE_SALES_TEMPLATES: servicios independientes (notaría, asesoría,
#     fotografía, tasación, tour virtual, publicación). `Sale.property` queda
#     null — no están atados a una propiedad específica del CRM.
#
# El seeder usa una mezcla 90/10 (linked/standalone) por defecto, controlado
# por `STANDALONE_SALE_FRAC` en seed_demo.py.

LINKED_SALES_TEMPLATES: list[tuple[str, int, int]] = [
    ("Comisión venta {tipo} en {zona}", 2_000, 18_000),
    ("Comisión alquiler {tipo} en {zona}", 250, 1_400),
    ("Depósito garantía alquiler — {zona}", 300, 1_800),
    ("Contrato anticrético {tipo} en {zona}", 10_000, 55_000),
    ("Comisión administración mensual de inmueble", 150, 900),
]

STANDALONE_SALES_TEMPLATES: list[tuple[str, int, int]] = [
    ("Servicio de tasación inmobiliaria — {zona}", 90, 380),
    ("Trámite notarial — minuta de transferencia", 180, 550),
    ("Trámite Derechos Reales — registro de propiedad", 220, 750),
    ("Asesoría legal inmobiliaria", 120, 480),
    ("Gestión municipal — plano aprobado / uso de suelo", 110, 400),
    ("Fotografía profesional de inmueble — {zona}", 80, 240),
    ("Tour virtual 360° — {zona}", 120, 320),
    ("Publicación premium en portal inmobiliario", 60, 220),
]

# Tipo de inmueble usado dentro de las plantillas de servicios (en minúscula).
SALE_PROPERTY_TYPES: list[str] = [
    "departamento",
    "casa",
    "oficina",
    "terreno",
    "local comercial",
    "galpón",
]

# Métodos de pago. Las operaciones de alto valor (>= 5k USD) se pagan por
# medios formales; los servicios menores usan QR / tarjeta / efectivo.
HIGH_VALUE_PAYMENTS: list[str] = [
    "Transferencia bancaria",
    "Cheque",
    "Efectivo",
]

SERVICE_PAYMENTS: list[str] = [
    "Transferencia bancaria",
    "QR Banco Unión",
    "QR BCP",
    "QR Mercantil Santa Cruz",
    "QR BISA",
    "Efectivo",
    "Tarjeta de crédito",
    "Tarjeta de débito",
]

# Servicios básicos. Casi toda propiedad declara agua/luz/alcantarillado;
# gas natural domiciliario, internet y calle pavimentada son los que varían
# y dan información real sobre la zona.
UTILITIES_BASE: list[str] = ["agua", "luz", "alcantarillado"]
UTILITIES_EXTRA: list[str] = [
    "gas natural",
    "internet",
    "calle pavimentada",
    "TV cable",
]

# Probabilidad de gas natural domiciliario por ciudad. En realidad la
# cobertura es mayor en La Paz / Cochabamba que en Santa Cruz, donde el
# gas de garrafa sigue siendo común en muchas zonas residenciales.
GAS_NATURAL_PROB_BY_CITY: dict[str, float] = {
    "La Paz": 0.85,
    "Cochabamba": 0.80,
    "Santa Cruz": 0.45,
}

# Pool de amenidades. El seeder elige 0–4 según el tier de precio.
AMENITIES_POOL: list[str] = [
    "piscina",
    "parrillero",
    "jardín",
    "seguridad 24h",
    "ascensor",
    "quincho",
    "gimnasio",
    "sauna",
    "sala de eventos",
    "cancha de tenis",
    "área de niños",
]

# Modalidades de operación con sus pesos (suman 100). La mayoría de
# listados en Bolivia son ventas; alquileres comunes; anticrético es
# minoritario pero distintivo.
LISTING_TYPES_WEIGHTED: list[tuple[str, int]] = [
    ("venta", 80),
    ("alquiler", 17),
    ("anticretico", 3),
]

# Estado de papeles. Mayoría saneado, una minoría con observaciones —
# refleja el mercado real donde la mayor parte del stock formal está al
# día pero siempre hay un porcentaje con trámites pendientes.
LEGAL_STATUSES_WEIGHTED: list[tuple[str, int]] = [
    ("saneado", 70),
    ("en_tramite", 15),
    ("con_observaciones", 10),
    ("pendiente", 5),
]

# === Lead seeding ===

# Fuente de origen del lead. Distribución pesada en función de cómo entran
# realmente los leads a una inmobiliaria boliviana mediana hoy en día.
LEAD_SOURCES_WEIGHTED: list[tuple[str, int]] = [
    ("web", 35),
    ("walk_in", 25),
    ("referral", 20),
    ("open_house", 15),
    ("other", 5),
]

# Estado del pipeline. Se sesga al mid-pipeline (contactado / visitando)
# porque los leads más antiguos suelen estar cerrados o perdidos, y los muy
# recientes recién entran como `new`.
LEAD_STATUSES_WEIGHTED: list[tuple[str, int]] = [
    ("new", 20),
    ("contacted", 25),
    ("visiting", 25),
    ("negotiating", 15),
    ("closed", 10),
    ("lost", 5),
]

# Requisitos típicos en una búsqueda inmobiliaria boliviana.
LEAD_MUST_HAVES: list[str] = [
    "garaje",
    "balcón",
    "amoblado",
    "vista",
    "seguridad 24h",
    "ascensor",
    "gas natural",
    "parrillero",
    "jardín",
    "piscina",
    "cerca de colegio",
    "cerca de transporte público",
    "cerca de supermercado",
    "para mascotas",
]

# Notas estilo CRM real. Mezcla de detalle operativo, preferencias y señales
# de calificación. ~30% de los leads quedan con notas vacías.
LEAD_NOTES_TEMPLATES: list[str] = [
    "Contactado por WhatsApp, prefiere visita el sábado.",
    "Mostró interés alto, viene por referido.",
    "Busca depto cerca de buen colegio.",
    "Solicita financiamiento bancario.",
    "Solo dispone los fines de semana.",
    "Quiere comparar con su pareja antes de decidir.",
    "Mencionó presupuesto flexible.",
    "Necesita mudarse antes de fin de año.",
    "Trabaja en zona sur, busca cercanía a la oficina.",
    "Pide vista a la cordillera.",
    "Tiene mascota, requiere espacio adecuado.",
    "Pareja joven, primera compra.",
    "Inversionista — busca renta segura.",
    "Cliente extranjero, prefiere comunicación por email.",
    "Aún no decidió zona, está comparando varias opciones.",
    "Lead frío — no respondió a último contacto.",
]

LEAD_BEDROOMS_MIN_CHOICES: list[int] = [1, 2, 2, 3, 3, 4]  # weighted toward 2–3
LEAD_AREA_MIN_CHOICES: list[int] = [60, 80, 100, 120, 150, 200]

# Dominios de email comunes para los contactos generados.
LEAD_EMAIL_DOMAINS: list[str] = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com"]

# === Edge / IoT seed parameters ===

# ESP32 presence-node room labels (free-form Varchar in `measurements.room`).
SENSOR_ROOMS: list[str] = ["entrada", "sala", "cocina", "dormitorio", "bano"]

# Firmware emits exactly one of these four values for `measurements.presence`.
# Weighted toward "no target" since rooms are empty most of the office day.
PRESENCE_WEIGHTED: list[tuple[str, int]] = [
    ("no target", 70),
    ("still", 18),
    ("moving", 10),
    ("moving+still", 2),
]

# Office-hours window used when generating measurement time-series. Outside
# this window we don't emit readings — keeps the demo dataset focused on
# the business day.
OFFICE_HOURS_START = 9  # 09:00 UTC, inclusive
OFFICE_HOURS_END = 18  # 18:00 UTC, exclusive
OFFICE_WEEKDAYS: set[int] = {0, 1, 2, 3, 4}  # Mon–Fri (datetime.weekday())

# Jetson zone numbering for `visitor_events.room` (Numeric). A single device
# at the entrance fans out logically to a few interior rooms.
VISITOR_ENTRANCE_ROOM = 0
VISITOR_INTERIOR_ROOMS: list[int] = [1, 2, 3]
