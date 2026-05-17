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
SALES_TEMPLATES: list[tuple[str, int, int]] = [
    ("Comisión venta {tipo} en {zona}", 2_000, 18_000),
    ("Comisión alquiler {tipo} en {zona}", 250, 1_400),
    ("Depósito garantía alquiler — {zona}", 300, 1_800),
    ("Contrato anticrético {tipo} en {zona}", 10_000, 55_000),
    ("Servicio de tasación inmobiliaria — {zona}", 90, 380),
    ("Trámite notarial — minuta de transferencia", 180, 550),
    ("Trámite Derechos Reales — registro de propiedad", 220, 750),
    ("Asesoría legal inmobiliaria", 120, 480),
    ("Gestión municipal — plano aprobado / uso de suelo", 110, 400),
    ("Fotografía profesional de inmueble — {zona}", 80, 240),
    ("Tour virtual 360° — {zona}", 120, 320),
    ("Publicación premium en portal inmobiliario", 60, 220),
    ("Comisión administración mensual de inmueble", 150, 900),
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

# Plantillas de servicios que SIEMPRE deberían enlazar una propiedad
# concreta (las comisiones y contratos). Se identifican por substring
# inicial de la plantilla.
COMMISSION_TEMPLATE_PREFIXES: tuple[str, ...] = (
    "Comisión venta",
    "Comisión alquiler",
    "Contrato anticrético",
    "Depósito garantía",
    "Comisión administración",
)
