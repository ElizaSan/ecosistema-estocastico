# Ecosistema estocástico

Simulación 2D en el navegador donde organismos autónomos viven, se reproducen y evolucionan sobre un terreno generado con **ruido de Perlin**. Al terminar, cada mundo se clasifica según su destino: se extinguió, duró poco o encontró un equilibrio.

Es un proyecto personal y experimental, hecho con HTML, CSS y JavaScript puro, sin librerías ni dependencias.

![Captura de la simulación](captura.png)

## Cómo funciona

### El terreno
Un ruido de Perlin 3D genera un campo de recursos (comida). Las dos primeras dimensiones son la posición en el mapa y la tercera es el **tiempo**, así que el terreno cambia poco a poco. Los recursos se agotan cuando los organismos comen y se regeneran hacia la capacidad de cada celda.

### Los organismos
Cada punto es un organismo con un pequeño genoma:

| Gen | Qué controla | Rango |
|---|---|---|
| Velocidad | Qué tan rápido se mueve (moverse rápido cuesta más energía) | 0.2 – 2.0 |
| Percepción | Qué tan lejos puede detectar comida | 1 – 8 celdas |
| Umbral de reproducción | Energía necesaria para dividirse | 8 – 40 |
| Tono | Color del linaje (neutral, solo visual) | 0 – 360 |

### Las reglas
1. **Comer:** si hay comida en su celda, come.
2. **Buscar:** si no, observa a su alrededor y se mueve hacia donde ve más comida, con cierto grado de aleatoriedad.
3. **Reproducirse:** al superar su umbral de energía se divide en dos, y el hijo hereda los genes con mutaciones.
4. **Morir:** sin energía o por vejez.

Con estas reglas aparece la **selección natural** sin programarla de forma explícita. Por ejemplo, si el terreno cambia rápido, sobreviven los organismos más veloces y la velocidad promedio de la población sube con las generaciones.

## Parámetros

| Parámetro | Efecto |
|---|---|
| Población inicial | Número de organismos al comenzar |
| Velocidad de transformación | Qué tan rápido cambia el terreno con el tiempo |
| Grado de aleatoriedad | Movimiento errático y rugosidad del terreno (octavas del ruido) |
| Evolución (mutación) | Cuánto difieren los hijos de sus padres |
| Regeneración de recursos | Qué tan rápido vuelve a crecer la comida |
| Velocidad de simulación | Pasos calculados por cuadro (no afecta el resultado) |
| Semilla | Misma semilla y mismos parámetros dan exactamente el mismo mundo |

## Clasificación de resultados

Cada simulación dura hasta 10 000 ticks. Al terminar se clasifica así:

- 🔴 **Extinto:** la población desapareció antes de 2000 ticks.
- 🟠 **Efímero:** sobrevivió un tiempo, pero se extinguió antes del final.
- 🟣 **En declive:** llegó al final, pero su población cae con fuerza.
- 🔵 **Oscilante:** sobrevive con auges y caídas marcados.
- 🟢 **Estable:** la población se mantiene con poca variación (coeficiente de variación < 0.2 en los últimos 3000 ticks).

Los resultados se guardan en un **catálogo** en el navegador (`localStorage`), con un botón para repetir cualquier mundo.

## Estructura del proyecto

```
ecosistema/
├── index.html          # Estructura de la página
├── css/
│   └── estilos.css     # Estilos (tema claro y oscuro)
└── js/
    └── simulacion.js   # Ruido, modelo, dibujo, controles y catálogo
```

Dentro de `simulacion.js` el código está dividido en secciones numeradas:

1. Números aleatorios con semilla (mulberry32)
2. Ruido de Perlin 3D
3. Constantes del modelo
4. Creación del mundo
5. Paso de simulación (las reglas)
6. Clasificación de resultados
7. Dibujo en canvas
8. Controles
9. Catálogo

## Cómo ejecutarlo

No necesita instalación. Cualquiera de estas opciones funciona:

- Abrir `index.html` directamente en el navegador.
- Usar la extensión **Live Server** de VS Code.
- Publicarlo con **GitHub Pages**: *Settings → Pages → Deploy from a branch → main*.

## Ideas a futuro

- [ ] Interacción con el cursor para modificar el terreno
- [ ] Depredadores o varias especies
- [ ] Ejecutar lotes de simulaciones con parámetros al azar
- [ ] Separar el código en módulos
- [ ] Exportar el catálogo

## Inspiración

- El ruido de Perlin que usa Minecraft para generar terreno
- El Juego de la vida de Conway
- Simuladores de vida artificial como *Lenia* y *The Bibites*

## Licencia

MIT