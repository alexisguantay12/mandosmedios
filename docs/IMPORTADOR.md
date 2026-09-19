# Importador histórico XLSX

## Estado de esta entrega

**El archivo histórico real no fue adjuntado.** Los encabezados de `mapeo_ejemplo.json` son ilustrativos y no afirman que existan en la planilla del hospital. No se importaron datos institucionales. Las pruebas generan libros sintéticos y verifican las reglas del comando.

La aplicación se puede instalar y usar para temas nuevos. Para migrar el histórico hace falta recibir el libro real, inspeccionar todas sus columnas y aprobar un mapeo basado en su contenido. En especial, una columna llamada «Responsables» puede contener texto de seguimiento: no debe mapearse como persona sin revisión.

## Implementación

Archivo único principal: `backend/temas/management/commands/importar_temas.py`.

- `COLUMNAS`: conjunto de destinos admitidos, no encabezados presupuestos.
- `normalizar`: ignora mayúsculas, acentos y espacios repetidos para comparar encabezados y valores del mapa.
- `interpretar_fecha`: fechas Excel, objetos fecha, ISO 8601 y fechas día/mes/año; aplica la zona del hospital cuando falta zona horaria.
- `ejecutar`: inspección o transacción exterior, validación de encabezados y recorrido de hojas/filas.
- `importar_fila`: mapeo, maestros, deduplicación, tema, comentarios y procedencia.

## Paso 1: inspeccionar sin escribir

```powershell
python manage.py importar_temas "C:\Migracion\historico.xlsx" --inspect --report "C:\Migracion\inspeccion.json"
```

Lee todas las hojas salvo que se indique `--sheet`. Por cada columna informa encabezado, cantidad de vacíos, tipos observados, número de valores distintos y ejemplos. El JSON incorpora **todas las filas y celdas**, no sólo los ejemplos. Permite analizar usos históricos que no coinciden con el encabezado. No modifica la base.

`--header-row N` identifica dónde están los encabezados. Una hoja de portada/resumen puede no tener la misma estructura: inspeccionar todo el libro y luego importar explícitamente cada hoja de datos mediante `--sheet` y su mapeo correspondiente. No se ignoran hojas desconocidas silenciosamente.

## Paso 2: documentar y aprobar las correspondencias

Copiar `docs/mapeo_ejemplo.json` como `mapeo_aprobado.json`. Editar `columnas`, `comentarios`, `predeterminados`, `valores` y `separador_areas`.

**Eliminar las claves de columnas que no existan.** Si un encabezado está declarado, debe existir; no se interpreta su ausencia como celda vacía. Los destinos obligatorios declarados son `descripcion` y `area_origen`. Los valores efectivos de tipo, estado y prioridad deben resolverse mediante columna o predeterminado explícito.

| Encabezado ilustrativo | Destino | Transformación y criterio |
| --- | --- | --- |
| ID histórico | `id_origen` | Identidad estable externa. Muy recomendable; no usar un número de fila si la planilla puede ordenarse. |
| Título | `Tema.titulo` | Texto sin espacios extremos. Si no se mapea o está vacío, derivar hasta 200 caracteres del comienzo de la descripción. La descripción íntegra se conserva. |
| Problema planteado | `Tema.descripcion` | Texto principal obligatorio; conservar saltos internos. No confundir con seguimiento. |
| Impacto | `Tema.impacto` | Texto descriptivo; no clasificación Alto/Medio/Bajo. Si su uso histórico es diferente, conservar y remapear deliberadamente. |
| Tipo de planteo | `Tema.tipo` | Correspondencia explícita en `valores.tipo`; maestro debe existir. |
| Área/sector | `Tema.area_origen` | Buscar por nombre sin distinguir mayúsculas; crear si falta. No dividir nombres por heurísticas. |
| Áreas involucradas | M2M del tema | Separar por el delimitador configurado, por defecto `;`. Buscar/crear cada área. |
| Responsable confirmado | `Tema.responsable` | **Una persona**. Buscar/crear nombre en Responsable. No inferir relación con áreas ni cuenta Django. Si el campo contiene varias personas, primero acordar responsable principal y conservar el texto original. |
| Estado | `Tema.estado` | Mapear a un código de Estado, no a su ID. Rechazar valores no reconocidos. |
| Marca temporal | `Tema.fecha_creacion` | Fecha real del origen si interpretable; si vacía, usar fecha de importación e informar advertencia. |
| Fecha de resolución | `Tema.fecha_resolucion` | Sólo si conocida y coherente con un estado resuelto. No inventar fecha por estar resuelto. |
| Remitente | `datos_migracion.remitente_historico` | Conservación como texto; no atribuir automáticamente a un usuario actual. |
| Soluciones propuestas | Comentario histórico | Mantener encabezado y hoja/fila junto al texto. |
| Comentarios / Seguimiento histórico | Comentarios históricos | Un comentario por celda; conservar autor real de la carga como importador. |
| Cualquier columna restante | `datos_migracion.celdas` | Conservar número de columna, encabezado y valor, incluso vacío. No descartar. |

Si una columna llamada «Responsables» contiene seguimiento, quitarla de `columnas.responsable` y agregarla a `comentarios`. Eso conserva su texto como seguimiento y evita crear un responsable con una frase. Si la semántica cambia entre filas, revisar/separar el archivo o extender el mapeo con una regla específica basada en el análisis real. No hay heurística que decida esto silenciosamente.

### Valores controlados

`valores.estado`: histórico → código (`nuevo`, `en-curso`, `resuelto` u otro código creado en Admin).

`valores.tipo`: histórico → nombre exacto de TipoTema existente. Primero crear los tipos adicionales aprobados en Admin.

`valores.prioridad`: histórico → `alta`, `media`, `baja`.

Los alias del ejemplo son posibilidades, no decisiones sobre el Excel real. Si un valor no está en el diccionario se rechaza la fila. Tampoco se transforma una fecha ilegible o un estado desconocido en un dato supuesto.

`predeterminados` sólo se usa cuando el valor está vacío o no hay columna mapeada. En el ejemplo, una prioridad inexistente se completa como Media: validar expresamente esta regla para el histórico real. No derivar prioridad automáticamente del campo Impacto.

## Paso 3: simulación

```powershell
python manage.py importar_temas "C:\Migracion\historico.xlsx" --mapping "..\docs\mapeo_aprobado.json" --usuario importador --fuente mandos-medios-historico --dry-run --report "C:\Migracion\simulacion.json"
```

El usuario debe existir y estar activo. Usar una cuenta de importación identificable. El comando utiliza exactamente el mismo camino de validación y escritura que la importación, pero revierte la transacción exterior al finalizar: no quedan temas, comentarios, eventos ni maestros nuevos.

**Detalle PostgreSQL:** las secuencias de IDs no son transaccionales; una simulación puede dejar saltos en la numeración, aunque no persista registros. No existe obligación de IDs consecutivos. Para una simulación que no afecte siquiera secuencias, ejecutar sobre una copia de laboratorio de la base.

## Paso 4: importación y resumen

Ejecutar el mismo comando sin `--dry-run`, después de revisar errores y hacer respaldo.

El resumen incluye:

- filas no vacías procesadas;
- temas creados;
- temas omitidos por coincidencia exacta;
- filas completamente vacías;
- errores con hoja/fila y causa;
- áreas creadas;
- comentarios históricos creados;
- advertencias sobre fechas desconocidas.

Los números son resultados de la ejecución; no hay cantidades históricas predefinidas. Si alguna fila se rechaza, el comando termina con código de error y conserva las filas válidas ya procesadas, salvo en simulación. Un error estructural de encabezados revierte todo el lote de hojas de esa ejecución. Una excepción inesperada aborta y revierte la transacción exterior; no se oculta como fila válida.

Cada fila tiene un savepoint. Un error de fecha posterior a crear un área revierte también esa área. Los contadores se actualizan después de confirmar el savepoint.

## Deduplicación y reejecución

La clave se calcula con SHA-256 a partir de:

`fuente + nombre de hoja + id_origen`

Si no hay ID, utiliza `fuente + nombre de hoja + fila`. El nombre del archivo no es la identidad. Renombrar el archivo no crea duplicados, siempre que fuente, hoja e identidad sean las mismas.

- Misma clave y mismo contenido original: omitir.
- Misma clave y contenido diferente: rechazar y pedir revisión; no sobrescribir cambios hechos en la aplicación.
- Sin ID estable, **no reordenar, insertar o quitar filas** antes de una reejecución. Si el archivo debe modificarse, agregar primero un identificador estable y definir el proceso de reconciliación.
- Con ID estable, la fila se puede mover sin cambiar la clave, siempre que el contenido original sea igual.
- No cambiar `--fuente` o el nombre de hoja para saltarse conflictos.

No existe sincronización bidireccional ni actualización automática de temas importados. La planilla es una fuente de migración, no un segundo sistema maestro tras el corte.

## Conservación y límites

- Todas las celdas originales, el nombre del archivo, fuente, hoja, fila, hash y JSON de mapeo quedan en `Tema.datos_migracion`, consultable en Django Admin.
- Se conservan fechas como ISO, números como números, booleanos y vacíos. La representación estructurada no copia colores, fórmulas calculadas, imágenes, comentarios de Excel ni formatos de celda. Conservar siempre el libro original como evidencia.
- Las fórmulas en campos principales se rechazan para evitar importar una expresión como dato. Exportar valores calculados antes de importar. Una fórmula en una columna no mapeada permanece como texto original en la procedencia.
- Un texto de seguimiento mayor a 9000 caracteres se divide en comentarios consecutivos identificados; además permanece completo en las celdas de origen.
- Responsables de más de 160 caracteres y títulos explícitos mayores de 200 se rechazan. No se truncan nombres de personas o títulos explícitos.
- No se soportan archivos `.xls`, CSV o acceso directo a Google Sheets: exportar XLSX.
- La inspección guarda todas las filas en memoria para elaborar el reporte. Para libros muy grandes, dividir por hoja o ampliar el mecanismo de reporte antes de migrar.

## Qué modificar para otro Excel

Para cambios de encabezados, alias de estado/tipo, valores predeterminados y separador, modificar únicamente el JSON. Para agregar un nuevo destino de modelo, añadir la clave en `COLUMNAS` y su tratamiento en `importar_fila`, junto con una prueba. Evitar dispersar reglas entre serializers, views y comandos.
