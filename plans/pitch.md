---
marp: true
theme: default
paginate: true
size: 16:9
backgroundColor: "#0b0f1a"
color: "#e6edf3"
style: |
  section {
    font-family: -apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
    padding: 72px 88px;
  }
  h1 { color: #7dd3fc; font-size: 64px; margin-bottom: 16px; }
  h2 { color: #7dd3fc; font-size: 48px; margin-bottom: 24px; }
  h3 { color: #fbbf24; font-size: 32px; }
  strong { color: #fbbf24; }
  .big { font-size: 56px; line-height: 1.15; font-weight: 600; }
  .huge { font-size: 96px; font-weight: 700; color: #fbbf24; line-height: 1; }
  .muted { color: #94a3b8; }
  ul { font-size: 32px; line-height: 1.5; }
  li { margin-bottom: 12px; }
  .pillars { display: flex; gap: 24px; justify-content: center; margin-top: 32px; }
  .pillar {
    flex: 1;
    background: #111827;
    border: 2px solid #1f2937;
    border-top: 4px solid #7dd3fc;
    border-radius: 12px;
    padding: 28px 20px;
    text-align: center;
  }
  .pillar .icon { font-size: 56px; line-height: 1; }
  .pillar .label { font-size: 26px; color: #e6edf3; margin-top: 14px; font-weight: 600; }
  .pillar .sub { font-size: 20px; color: #94a3b8; margin-top: 6px; }
  footer { color: #64748b; }
  section::after { color: #475569; }
---

<!-- _paginate: false -->

# TrueValue

## Copiloto Inmobiliario con IA
## Eiffel Tower

<br>

### CRM + IA + Sensores — diseñado para Bolivia

<br>
<br>

<span class="muted">CochaTech 2026 · Reto INTERSIM TECH</span>

---

<!-- _paginate: false -->

# El problema

<br>

<span class="big">

Un agente inmobiliario pierde **horas cada día** calificando leads que no compran, cruzando ofertas a mano y revisando papeles.

</span>

<br>

<span class="muted">😰 Y el cliente firma anticréticos **con miedo**.</span>

---

## Mercado boliviano 2026

- 💵 Precios **opacos** — USD inestable, sin referencia clara
- ⚖️ Anticrético = **riesgo legal alto** (cláusulas, hipotecas, fraudes)
- 🔎 Asesores trabajan como **buscadores**, no como asesores
- 📊 Cero historial digital del flujo real en la propiedad

---

<!-- _paginate: false -->

# Solución

<br>

<span class="big">

**TrueValue** es el copiloto del agente:

</span>

<div class="pillars">
  <div class="pillar">
    <div class="icon">📋</div>
    <div class="label">CRM</div>
    <div class="sub">operativo, móvil</div>
  </div>
  <div class="pillar">
    <div class="icon">🤖</div>
    <div class="label">IA</div>
    <div class="sub">3 módulos</div>
  </div>
  <div class="pillar">
    <div class="icon">📡</div>
    <div class="label">Edge</div>
    <div class="sub">sensores en propiedad</div>
  </div>
</div>

---

## Tres módulos de IA, hoy funcionando

### 🎯 1. Lead Scoring
Califica automáticamente. Score, bucket, próximo paso.

### 🔗 2. Matchmaking
Cruza oferta y demanda con razones y advertencias legales.

### 💰 3. Valuación Dinámica
Precio sugerido + rango USD a partir de comparables del catálogo.

---

<!-- _paginate: false -->
<!-- _backgroundColor: "#1e293b" -->

# 🎬 Demo en vivo

<br>

<span class="big">

Carla Mendoza · familia joven · USD 180k pre-aprobados

</span>

---

## ¿Qué acabás de ver?

- ✅ **Score 100/100** — el agente sabe a quién llamar primero
- ✅ **Match perfecto** en Cala Cala — con la razón explícita
- ⚠️ **Alerta legal** en una propiedad — "papeles en revisión, due diligence"
- 💸 **Valuación:** listado USD 175k vs sugerido **USD 240k** — oportunidad clara

<br>

<span class="muted">Todo desde el catálogo real, en segundos.</span>

---

## Lo que nos diferencia

- 🛡️ **No es ChatGPT envuelto.** Modelo determinista + LLM, con guardrails.
- 🇧🇴 **Diseñado para Bolivia:** anticrético, USD/Bs, eje troncal, saneado, gas natural.
- 🧱 **Tres capas que nadie combina:**
  CRM operativo · IA que califica/empareja/valúa · sensores físicos

---

## Hito 2 — Sensores en la propiedad

<br>

<span class="big">

Cámara Jetson + ESP32 cuentan **visitas reales**.

</span>

<br>

El sistema le dice al agente:

> _"Alta demanda esta semana — considera subir reserva."_

<span class="muted">Telemetría convertida en decisión, no en gráfico.</span>

---

<!-- _paginate: false -->
<!-- _backgroundColor: "#0b0f1a" -->

# 🎯 ¿Qué buscamos?

<br>

<span class="big">

Pilotear con **agentes independientes** antes de fin de año.

</span>

<br>
<br>

### TrueValue — el agente trabaja menos. El cliente compra con más confianza.

<br>

<span class="muted">github · TrueValue · Equipo Eiffel Tower</span>

<!--
==========================================================================
RENDER:
  npx @marp-team/marp-cli plans/pitch.md -o plans/pitch.pdf
  npx @marp-team/marp-cli plans/pitch.md -o plans/pitch.html

PREVIEW EN VSCODE: instalar extensión "Marp for VS Code", abrir este archivo.
PRESENTAR:        abrir el PDF o el HTML en pantalla completa.
FALLBACK OFFLINE: el PDF es tu red de seguridad si falla la demo.
==========================================================================
-->
