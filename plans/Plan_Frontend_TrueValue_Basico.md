# **Plan de Desarrollo Frontend: TrueValue CRM (MVP Básico)**

Este documento delinea la estrategia para construir la interfaz de usuario básica del CRM TrueValue, excluyendo temporalmente los dashboards analíticos. El objetivo es proporcionar interfaces rápidas y funcionales para la carga transaccional requerida en la fase inicial de la hackathon.

## **1\. Stack Tecnológico Sugerido**

* **Framework Build Tool:** Vite (con React o Vue). Esta elección proporciona un servidor de desarrollo con tiempos de arranque instantáneos y un flujo de trabajo que se integra a la perfección cuando se compila y edita directamente desde herramientas centradas en la terminal.  
* **Estilos:** TailwindCSS. Permite maquetar las vistas transaccionales en tiempo récord mediante clases utilitarias, eliminando la sobrecarga de mantener hojas de estilo complejas.  
* **Enrutamiento:** Un router ligero (React Router o Vue Router) para gestionar la navegación estricta entre las vistas de gestión.

## **2\. Estructura de Vistas (Flujo Transaccional)**

| Vista Central | Propósito y Componentes UI | Conexión API (Backend) |
| :---- | :---- | :---- |
| **Autenticación (Login)** | Punto de entrada aislado para garantizar la privacidad. Formulario de credenciales que almacena el identificador de sesión para validar el rol del agente. | POST /api/crm/auth |
| **Inventario de Propiedades** | Lista de lectura simple del catálogo de inmuebles y un formulario modal para dar de alta nuevas propiedades (título, precio, ubicación). | GET /api/crm/properties POST /api/crm/properties |
| **Registro de Ventas** | El formulario crítico del desafío. Captura el producto/servicio, el monto exacto, método de pago y ubicación de la firma. | POST /api/crm/sales |
| **Due Diligence (MVP)** | Interfaz de carga de archivos (PDF) que envía el contrato al motor NLP y renderiza la respuesta estructurada de riesgos legales. | POST /api/ai/nlp\_contract |

## **3\. Estrategia de Integración del Cliente API**

Para mantener limpios los componentes visuales, toda la lógica de peticiones al monolito en FastAPI debe abstraerse en un único módulo de servicios.

`// api_service.js (Ejemplo referencial)`  
`const API_BASE_URL = "http://localhost:8000/api/crm";`

`export const registrarVenta = async (payloadVenta) => {`  
  ``const respuesta = await fetch(`${API_BASE_URL}/sales`, {``  
    `method: 'POST',`  
    `headers: { 'Content-Type': 'application/json' },`  
    `body: JSON.stringify(payloadVenta)`  
  `});`  
  `return respuesta.json();`  
`};`

## **4\. Hitos de Ejecución**

1. **Andamiaje del Proyecto:** Generar la base de código estructural y configurar el motor de clases utilitarias de CSS.  
2. **Maquetación Estática:** Ensamblar el formulario de ventas y el portal de login sin estado ni lógica, asegurando que los campos requeridos estén presentes.  
3. **Enlace de Datos (Wiring):** Conectar los eventos de envío de los formularios con los clientes API que apuntan al entorno local de FastAPI.  
4. **Aislamiento de Sesión:** Implementar bloqueos en las rutas para garantizar que las vistas operativas requieran autenticación previa.