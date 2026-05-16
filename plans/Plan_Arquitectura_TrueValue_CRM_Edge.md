# **Plan de Arquitectura y Desarrollo Backend: TrueValue**

Este documento describe la arquitectura técnica y el plan de desarrollo para **TrueValue**, una solución Proptech diseñada para el desafío de INTERSIM TECH. La estrategia actual se centra en consolidar un núcleo transaccional (CRM) robusto sobre el cual se integrarán posteriormente los módulos de hardware en el borde (Edge Intelligence) operando como clientes.

## **1\. Enfoque Arquitectónico: Monolito Ágil con Edge Clients**

Para maximizar la velocidad de desarrollo durante la hackathon y simplificar la conectividad, se ha optado por una arquitectura monolítica extendida. El backend actuará como el servidor central unificado, atendiendo tanto las peticiones HTTP del frontend web (el CRM) como la ingesta de datos proveniente de los dispositivos de hardware a través de la red WiFi local.

* **Core del Backend:** Construido con FastAPI para un manejo asíncrono eficiente de las peticiones, utilizando Piccolo ORM para la interacción ágil con la base de datos PostgreSQL.  
* **Edge Client 1 (Conteo de Presencia):** Módulos basados en **ESP32** conectados vía WiFi, encargados de enviar telemetría ligera (eventos y señales de presencia) directamente a los endpoints del monolito.  
* **Edge Client 2 (Visión Computacional):** Una placa **NVIDIA Jetson Orin Nano** que ejecutará modelos de visión artificial localmente (optimizados vía TensorRT si es necesario). Su función es procesar el video in situ y enviar únicamente datos estructurados (conteo de personas, métricas de tráfico) al backend, preservando el ancho de banda y la privacidad.

## **2\. Diseño de Entidades del CRM Base (Fase 1\)**

Antes de habilitar la recepción de datos físicos, el sistema debe garantizar la persistencia de la información transaccional requerida explícitamente en el desafío. El modelo de datos inicial (MVP) contempla las siguientes entidades críticas en PostgreSQL:

| Entidad | Responsabilidad Principal | Campos Clave Obligatorios   |
| :---- | :---- | :---- |
| **Gestión de Usuarios** | Asegurar la privacidad y el aislamiento de datos por agente inmobiliario o emprendedor. | Username, Password (Hash), Rol (Agente/Admin). |
| **Inventario (Propiedades)** | Catálogo base para el cruce de oferta y demanda (Matchmaking). | Título, Precio, Tipo de Inmueble, Ubicación, Agent\_ID. |
| **Registro de Ventas** | Cumplir de manera estricta con el requisito de reportes y registro financiero dictado en las bases. | Producto/Servicio, Monto de Venta, Método de Pago, Ubicación de la Venta, Fecha/Hora, Agent\_ID. |

## **3\. Estructura de Rutas y Servicios (Directorio Adaptado)**

La organización lógica del monolito aísla las interacciones humanas (CRM) de las interacciones máquina a máquina (Hardware), permitiendo que los equipos trabajen en paralelo:

truevalue\_backend/  
├── app/  
│   ├── api/  
│   │   ├── crm/        (Rutas web: /users, /properties, /sales)  
│   │   ├── edge/       (Rutas hardware: /telemetry\_esp32, /vision\_jetson)  
│   │   └── ai/         (Rutas lógicas: /nlp\_contract, /matchmaking)  
│   ├── models/         (Tablas de Piccolo ORM)  
│   ├── schemas/        (Modelos Pydantic para validación y serialización)  
│   └── main.py         (Punto de entrada unificado de FastAPI)  
└── piccolo\_migrations/

## **4\. Plan de Ejecución Inmediato (Fases)**

1. **Hito 1: Esqueleto del CRM (Foco Actual)**  
   Configuración del proyecto en FastAPI. Creación y migración de los esquemas en Piccolo ORM para Usuarios, Propiedades y Ventas. Exposición de las rutas CRUD básicas para liberar el trabajo del equipo de Frontend.  
2. **Hito 2: Endpoints para Edge Clients**  
   Diseño de los modelos Pydantic receptores para parsear los payloads JSON enviados por la ESP32 y la Jetson Orin Nano. Habilitación de rutas asíncronas para realizar pruebas de carga con los dispositivos conectados a la misma red WiFi.  
3. **Hito 3: Motores de Análisis y Reportes**  
   Construcción de los endpoints analíticos requeridos para mostrar el "Total recaudado" filtrado por fechas y el desglose por "Método de pago". Conexión final del módulo NLP para evaluar los riesgos de los contratos inmobiliarios.