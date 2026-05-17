# 

Arquitectura General de Alto Nivel: Ecosistema TrueValue

Este documento presenta la arquitectura integral del proyecto TrueValue, un ecosistema Proptech dual que combina Inteligencia Artificial, telemetría de hardware en el borde (Edge Computing) y un CRM transaccional robusto.

## **1\. Visión Holística del Sistema**

La arquitectura se diseña bajo un modelo de **Monolito Extendido con Nodos Físicos**. El núcleo central (Backend) orquesta las reglas de negocio y almacena los datos, mientras interactúa bidireccionalmente con interfaces de usuario (Frontend) y dispositivos IoT (Edge Clients).

## **2\. Descripción de Módulos Core**

### **A. Módulo Backend (Motor Central)**

* **Tecnología:** FastAPI, Piccolo ORM, PostgreSQL.  
* **Responsabilidad:** Funciona como el "cerebro" del sistema. Gestiona la autenticación, persiste el inventario y las ventas, e ingiere de forma asíncrona los datos de los sensores sin bloquear el hilo principal.  
* **Aspecto Crítico:** Mantener rutas separadas (y seguras) para el CRM humano versus las APIs de ingesta M2M (Machine to Machine) del hardware.

### **B. Módulo AI & Procesamiento Legal (NLP)**

* **Tecnología:** LLM (vía API o local) integrado al Backend.  
* **Responsabilidad:** Extraer, analizar y calificar el riesgo de los contratos inmobiliarios (Due Diligence automático).  
* **Aspecto Crítico:** Diseñar prompts estructurados que obliguen al LLM a devolver un formato JSON estricto (semáforo de riesgo: verde, amarillo, rojo) para que el frontend pueda renderizarlo sin errores.

### **C. Módulos de Hardware (Edge Intelligence)**

| Componente | Tecnología | Función Principal   |
| :---- | :---- | :---- |
| Nodos de Presencia | ESP32 (WiFi) | Detección binaria de movimiento o presencia en habitaciones (Telemetría ligera). |
| Nodo de Visión Artificial | NVIDIA Jetson Orin Nano | Conteo de personas en *Open House*. Inferencia local para enviar solo metadatos (protección de privacidad). |

## **3\. Módulo Frontend: Características para la Excelencia**

Para que la interfaz de usuario B2B no sea un simple CRUD y realmente brille ante los jueces, se deben incorporar las siguientes características clave:

* **Diseño Mobile-First Estricto:** Los agentes inmobiliarios capturan ventas y suben datos mientras están en terreno (en las propiedades). La interfaz de "Registro de Ventas" debe ser operable a una mano y cargar rápido en redes móviles inestables.  
* **Optimistic UI (Actualizaciones Optimistas):** Cuando el agente registra una venta o cambia el estado de una propiedad, la interfaz debe reflejar el cambio instantáneamente sin esperar la respuesta completa del servidor (manejando el error en segundo plano si ocurre). Esto da una sensación de velocidad extrema en el uso del CRM.  
* **Manejo de Estados de Carga (Skeletons):** Mientras el motor NLP analiza un contrato, usar animaciones de "esqueleto" en lugar de un simple *spinner* para mantener la percepción de progreso, ya que el procesamiento de lenguaje natural puede tomar unos segundos.  
* **Feedback Visual de la Telemetría:** El frontend debe traducir los fríos datos numéricos del hardware (ej. "45 personas contadas") en insights accionables visuales para el agente (ej. "Alta demanda: Sugerir aumento de precio de reserva").