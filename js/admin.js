async function generarLink() {

    const boton = document.querySelector(".btn-generar");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Generando...";
    }

    try {
        const respuesta = await fetch("/api/enlaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo generar el enlace.");
        }

        // Se usa la URL pública que devuelve el servidor (PUBLIC_BASE_URL),
        // para que el enlace funcione en cualquier dispositivo y red.
        document.getElementById("linkGenerado").value =
            resultado.url || `${window.location.origin}/registro/${resultado.token}`;
        document.getElementById("linkResultado").classList.remove("oculto");
    } catch (error) {
        alert(error.message);
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "+ Generar enlace";
        }
    }
}


function copiarLink() {

    const input =
        document.getElementById(
            "linkGenerado"
        );


    navigator.clipboard.writeText(
        input.value
    );


    alert(
        "Enlace copiado correctamente."
    );

}


function enviarWhatsApp() {

    const link =
        document.getElementById(
            "linkGenerado"
        ).value;


    const mensaje =
        "Hola, te compartimos tu enlace para realizar tu registro: " +
        link;


    const url =
        "https://wa.me/?text=" +
        encodeURIComponent(mensaje);


    window.open(
        url,
        "_blank"
    );

}


function cerrarSesion() {

    fetch("/api/logout", { method: "POST" })
        .finally(() => {
            window.location.href = "/login";
        });
}


// ----------------------------------
// SELECTOR DE CLIENTES (NUEVO PRÉSTAMO)
// ----------------------------------

function llenarSelectorClientes(clientes, clientesConPrestamo = new Set()) {

    const selector = document.getElementById("clientePrestamo");

    if (!selector || !clientes) {
        return;
    }

    const valorActual = selector.value;

    selector.innerHTML =
        '<option value="">Seleccionar cliente</option>' +
        clientes.map((cliente) => {
            const tienePrestamo = clientesConPrestamo.has(cliente.id);

            if (tienePrestamo) {
                // El cliente ya tiene un préstamo activo: no puede obtener otro.
                return `<option value="${cliente.id}" disabled>${cliente.nombre} — ${cliente.telefono} (préstamo activo)</option>`;
            }

            return `<option value="${cliente.id}">${cliente.nombre} — ${cliente.telefono}</option>`;
        }).join("");

    // Mantener la selección si el cliente sigue disponible.
    if (valorActual && !clientesConPrestamo.has(Number(valorActual))) {
        selector.value = valorActual;
    }
}

// ----------------------------------
// MÓDULO REGISTRAR PAGOS (BASE DE DATOS)
// ----------------------------------

let prestamoPagoSeleccionado = null;
let pagosExistentes = [];

async function cargarPrestamosPago() {

    try {
        const respuesta = await fetch("/api/prestamos/activos");

        if (!respuesta.ok) {
            return;
        }

        const prestamos = await respuesta.json();
        const selector = document.getElementById("pagoPrestamo");

        if (!selector) {
            return;
        }

        const valorActual = selector.value;
        selector.innerHTML =
            '<option value="">Seleccionar préstamo</option>' +
            prestamos.map((prestamo) =>
                `<option value="${prestamo.id}">#${String(prestamo.id).padStart(3, "0")} — ${prestamo.nombre} (saldo: ${formatoDinero(prestamo.saldo)})</option>`
            ).join("");

        if (valorActual) {
            selector.value = valorActual;
        }

        if (!prestamos.length) {
            selector.innerHTML = '<option value="">No hay préstamos activos</option>';
        }
    } catch (error) {
        console.warn("No se pudieron cargar los préstamos para pagos.", error);
    }
}

async function seleccionarPrestamoPago() {

    const selector = document.getElementById("pagoPrestamo");
    const id = selector.value;
    const historial = document.getElementById("historialPagosDB");
    const mensaje = document.getElementById("mensajePagoDB");

    mensaje.textContent = "";
    prestamoPagoSeleccionado = null;
    pagosExistentes = [];

    if (!id) {
        document.getElementById("pagoNumeroDB").innerHTML = '<option value="">Selecciona el pago</option>';
        document.getElementById("saldoAnteriorDB").textContent = formatoDinero(0);
        document.getElementById("pagoRealizadoDB").textContent = formatoDinero(0);
        document.getElementById("nuevoSaldoDB").textContent = formatoDinero(0);
        historial.innerHTML = `<tr><td colspan="6">Selecciona un préstamo activo.</td></tr>`;
        renderizarCalendarioPagosDB();
        return;
    }

    try {
        const respuesta = await fetch(`/api/prestamos/${id}/pagos`);

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el préstamo.");
        }

        const datos = await respuesta.json();
        prestamoPagoSeleccionado = datos;
        pagosExistentes = datos.pagos;

        document.getElementById("fechaPagoDB").value = new Date().toISOString().slice(0, 10);

        // Autocompletar el monto a pagar del periodo al elegir el cliente/préstamo.
        document.getElementById("montoPagoDB").value =
            pagoPeriodoPrestamo(datos).toFixed(2);

        const selectorNumero = document.getElementById("pagoNumeroDB");
        const pagadosSet = new Set(pagosExistentes.map((pago) => pago.numero_pago));
        const opciones = ['<option value="">Selecciona el pago</option>'];

        for (let numero = 1; numero <= datos.numero_pagos; numero++) {
            const deshabilitado = pagadosSet.has(numero) ? "disabled" : "";
            opciones.push(`<option value="${numero}" ${deshabilitado}>Pago ${numero}${pagadosSet.has(numero) ? " (registrado)" : ""}</option>`);
        }

        selectorNumero.innerHTML = opciones.join("");
        renderizarHistorialPagosDB();
        renderizarCalendarioPagosDB();
        actualizarResumenPagoDB();
    } catch (error) {
        mensaje.textContent = error.message;
    }
}

function pagoPeriodoPrestamo(prestamo) {

    const total = Number(prestamo.total) || 0;
    const numeroPagos = Number(prestamo.numero_pagos) || 0;

    if (!numeroPagos) {
        return total;
    }

    return total / numeroPagos;
}

function actualizarResumenPagoDB() {

    if (!prestamoPagoSeleccionado) {
        return;
    }

    const selector = document.getElementById("pagoNumeroDB");
    const montoInput = document.getElementById("montoPagoDB");
    const numero = Number(selector.value);
    const pagoExistente = pagosExistentes.find((pago) => pago.numero_pago === numero);

    const pagadoAcumulado = pagosExistentes.reduce((total, pago) => total + pago.monto, 0);
    const saldoAnterior = Math.max(prestamoPagoSeleccionado.total - pagadoAcumulado, 0);

    // Al seleccionar un pago nuevo, se autocompleta con el pago del periodo
    // (sin superar el saldo pendiente).
    if (numero && !pagoExistente) {
        const sugerido = Math.min(pagoPeriodoPrestamo(prestamoPagoSeleccionado), saldoAnterior);
        montoInput.value = sugerido > 0 ? sugerido.toFixed(2) : "";
    }

    const monto = pagoExistente ? pagoExistente.monto : (Number(montoInput.value) || 0);

    document.getElementById("saldoAnteriorDB").textContent = formatoDinero(saldoAnterior);
    document.getElementById("pagoRealizadoDB").textContent = formatoDinero(monto);
    document.getElementById("nuevoSaldoDB").textContent = formatoDinero(Math.max(saldoAnterior - monto, 0));
}

function renderizarHistorialPagosDB() {

    const historial = document.getElementById("historialPagosDB");

    if (!historial) {
        return;
    }

    if (!pagosExistentes.length) {
        historial.innerHTML = `<tr><td colspan="6">No hay pagos registrados para este préstamo.</td></tr>`;
        return;
    }

    historial.innerHTML = pagosExistentes.map((pago) => `
        <tr>
            <td data-label="Pago">${pago.numero_pago}</td>
            <td data-label="Fecha">${new Date(pago.fecha_pago).toLocaleDateString("es-MX")}</td>
            <td data-label="Monto">${formatoDinero(pago.monto)}</td>
            <td data-label="Saldo anterior">${formatoDinero(pago.saldo_anterior)}</td>
            <td data-label="Nuevo saldo">${formatoDinero(pago.nuevo_saldo)}</td>
            <td data-label="Estado"><span class="estado-pagado">✓ Pagado</span></td>
        </tr>
    `).join("");
}

function renderizarCalendarioPagosDB() {

    const tabla = document.getElementById("calendarioPagosDB");

    if (!tabla) {
        return;
    }

    if (!prestamoPagoSeleccionado) {
        tabla.innerHTML = `<tr><td colspan="4">Selecciona un préstamo activo.</td></tr>`;
        return;
    }

    const p = prestamoPagoSeleccionado;
    const pagadosSet = pagosPagadosSet();
    const importeBase = p.numero_pagos ? (Number(p.total) / p.numero_pagos) : 0;
    const filas = [];

    for (let numero = 1; numero <= p.numero_pagos; numero++) {
        const pagado = pagadosSet.has(numero);
        const fecha = obtenerFechaPago(numero, {
            fechaInicio: new Date(p.fecha_inicio + "T00:00:00"),
            periodicidad: p.periodicidad,
        });
        filas.push(`
            <tr>
                <td data-label="Pago">${numero}</td>
                <td data-label="Fecha">${formatoFecha(fecha)}</td>
                <td data-label="Importe">${formatoDinero(importeBase)}</td>
                <td data-label="Estado">${pagado
                    ? '<span class="estado-pagado">✓ Pagado</span>'
                    : '<span class="estado pendiente">Pendiente</span>'}</td>
            </tr>
        `);
    }

    tabla.innerHTML = filas.join("");
}

async function registrarPagoDB() {

    const mensaje = document.getElementById("mensajePagoDB");
    mensaje.textContent = "";

    const prestamoId = document.getElementById("pagoPrestamo").value;
    const numero = Number(document.getElementById("pagoNumeroDB").value);
    const fecha = document.getElementById("fechaPagoDB").value;
    const monto = Number(document.getElementById("montoPagoDB").value);

    if (!prestamoId || !numero || !fecha || !monto || monto <= 0) {
        mensaje.textContent = "Selecciona el préstamo, el número de pago, la fecha y un monto válido.";
        return;
    }

    const boton = document.getElementById("btnRegistrarPagoDB");
    boton.disabled = true;
    boton.textContent = "Registrando...";

    try {
        const respuesta = await fetch("/api/pagos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prestamo_id: prestamoId,
                numero_pago: numero,
                fecha_pago: fecha,
                monto: monto,
            }),
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo registrar el pago.");
        }

        mensaje.textContent = `Pago registrado. Nuevo saldo: ${formatoDinero(resultado.saldo)}`;
        document.getElementById("montoPagoDB").value = "";

        await seleccionarPrestamoPago();
        await cargarPrestamosPago();
        await cargarDatosMariaDB();
    } catch (error) {
        mensaje.textContent = error.message;
    } finally {
        boton.disabled = false;
        boton.textContent = "Registrar pago";
    }
}

// ----------------------------------
// MÓDULO CLIENTES REGISTRADOS
// ----------------------------------

function renderizarClientesRegistrados(clientes) {

    const tabla = document.getElementById("clientesRegistradosLista");
    const contador = document.getElementById("clientesRegistradosTotal");

    if (contador) {
        contador.textContent = clientes.length;
    }

    if (!tabla) {
        return;
    }

    if (!clientes.length) {
        tabla.innerHTML = `<tr><td colspan="8">Todavía no hay clientes registrados.</td></tr>`;
        return;
    }

    tabla.innerHTML = clientes.map((cliente) => {
        const estadoClase = cliente.estado.toLowerCase().replace("_", "");
        const estadoTexto = cliente.estado === "EN_REVISION"
            ? "En revisión"
            : cliente.estado.toLowerCase().replace(/^./, (letra) => letra.toUpperCase());

        return `
            <tr data-id="${cliente.id}">
                <td data-label="ID">#${String(cliente.id).padStart(3, "0")}</td>
                <td data-label="Cliente">${cliente.nombre}</td>
                <td data-label="Teléfono">${cliente.telefono}</td>
                <td data-label="Banco">${cliente.banco}</td>
                <td data-label="Cuenta">${cliente.cuenta}</td>
                <td data-label="Estado"><span class="estado ${estadoClase}">${estadoTexto}</span></td>
                <td data-label="Fecha">${new Date(cliente.creado_en).toLocaleDateString("es-MX")}</td>
                <td data-label="Documentos">
                    <a class="btn-tabla btn-ver" href="${cliente.foto_frente_url}" target="_blank">Frente</a>
                    <a class="btn-tabla btn-ver" href="${cliente.foto_reverso_url}" target="_blank">Reverso</a>
                    <a class="btn-tabla btn-editar" href="/cliente?id=${cliente.id}">Ficha</a>
                </td>
            </tr>
        `;
    }).join("");
}


// ----------------------------------
// BUSCADOR
// ----------------------------------

const buscador =
    document.getElementById("buscar");

async function cargarDatosMariaDB() {

    try {
        const [resumenRespuesta, prestamosRespuesta, clientesRespuesta] = await Promise.all([
            fetch("/api/admin/resumen"),
            fetch("/api/prestamos/activos"),
            fetch("/api/clientes"),
        ]);

        if (!resumenRespuesta.ok || !prestamosRespuesta.ok || !clientesRespuesta.ok) {
            return;
        }

        const resumen = await resumenRespuesta.json();
        const prestamos = await prestamosRespuesta.json();
        const clientes = await clientesRespuesta.json();

        document.getElementById("totalRegistrosCount").textContent = resumen.total_clientes;
        document.getElementById("pendientesCount").textContent = resumen.pendientes;
        document.getElementById("revisionCount").textContent = resumen.en_revision;
        document.getElementById("aprobadosCount").textContent = resumen.aprobados;
        document.getElementById("clientesActivosCount").textContent = resumen.clientes_activos;
        document.getElementById("clientesColocadosTotal").textContent = resumen.clientes_activos;

        // Clientes que ya tienen un préstamo activo (no pueden obtener otro).
        const clientesConPrestamo = new Set(
            prestamos.map((prestamo) => prestamo.cliente_id)
        );

        renderizarClientes(clientes);
        llenarSelectorClientes(clientes, clientesConPrestamo);
        renderizarClientesRegistrados(clientes);

        const tabla = document.querySelector("#tablaColocados tbody");
        tabla.innerHTML = prestamos.length
            ? prestamos.map((prestamo) => `
                <tr>
                    <td data-label="Cliente">${prestamo.nombre}</td>
                    <td data-label="Préstamo original">${dinero(prestamo.monto)}</td>
                    <td data-label="Saldo pendiente">${dinero(prestamo.saldo)}</td>
                    <td data-label="Periodicidad">${prestamo.periodicidad}</td>
                    <td data-label="Estado"><span class="estado aprobado">Activo</span></td>
                    <td data-label="Acción"><a class="btn-tabla btn-ver" href="/cliente?id=${prestamo.cliente_id}">Ver cliente</a></td>
                </tr>
            `).join("")
            : `<tr><td colspan="6">No hay préstamos activos.</td></tr>`;
    } catch (error) {
        console.warn("No se pudieron cargar los datos de MariaDB.", error);
    }
}

cargarDatosMariaDB();
// Refrescar los datos cada 15 segundos para ver registros nuevos
// sin recargar la página.
setInterval(cargarDatosMariaDB, 15000);


// ----------------------------------
// BUSCADOR
// ----------------------------------

if (buscador) {

    buscador.addEventListener(
        "input",
        function () {

            const texto =
                this.value.toLowerCase();


            const filas =
                document.querySelectorAll(
                    "#tablaClientes tbody tr"
                );


            filas.forEach(
                function (fila) {

                    const contenido =
                        fila.textContent
                            .toLowerCase();


                    fila.style.display =
                        contenido.includes(texto)
                            ? ""
                            : "none";

                }
            );

        }
    );

}

// ==========================================
// NAVEGACION DE MODULOS Y CLIENTES
// ==========================================

function mostrarModulo(modulo) {

    document.querySelectorAll(".modulo-panel").forEach(
        (panel) => panel.classList.remove("modulo-activo")
    );

    const panel = document.getElementById(`modulo-${modulo}`);

    if (panel) {
        panel.classList.add("modulo-activo");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function limpiarFormularioCliente() {

    const formulario = document.getElementById("formularioCliente");

    if (formulario) {
        formulario.reset();
    }

    document.getElementById("clienteId").value = "";
}

function editarCliente(boton) {

    const fila = boton.closest("tr");

    document.getElementById("clienteId").value = fila.dataset.id || fila.cells[0].textContent.trim().replace("#", "");
    document.getElementById("nombreCliente").value = fila.cells[1].textContent.trim();
    document.getElementById("telefonoCliente").value = fila.cells[2].textContent.trim();
    document.getElementById("bancoCliente").value = fila.cells[3].textContent.trim();

    mostrarModulo("clientes");
    document.getElementById("nombreCliente").focus();
}

async function eliminarCliente(boton) {

    const fila = boton.closest("tr");
    const nombre = fila.cells[1].textContent.trim();
    const id = fila.dataset.id || fila.cells[0].textContent.trim().replace("#", "");

    if (!confirm(`¿Eliminar el registro de ${nombre}?`)) {
        return;
    }

    try {
        const respuesta = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo eliminar el cliente.");
        }

        fila.remove();
        cargarDatosMariaDB();
    } catch (error) {
        alert(error.message);
    }
}

function verCliente(boton) {

    const fila = boton.closest("tr");
    const id = fila.cells[0].textContent.trim().replace("#", "");
    const parametros = new URLSearchParams({
        id,
        nombre: fila.cells[1].textContent.trim(),
        telefono: fila.cells[2].textContent.trim(),
        banco: fila.cells[3].textContent.trim(),
    });

    window.location.href = `/cliente?${parametros.toString()}`;
}

const formularioCliente = document.getElementById("formularioCliente");

if (formularioCliente) {

    formularioCliente.addEventListener("submit", async function (evento) {

        evento.preventDefault();

        const id = document.getElementById("clienteId").value;
        const nombre = document.getElementById("nombreCliente").value.trim();
        const telefono = document.getElementById("telefonoCliente").value.trim();
        const banco = document.getElementById("bancoCliente").value.trim();

        if (!id) {
            alert("Selecciona un cliente de la tabla para modificarlo.");
            return;
        }

        try {
            const respuesta = await fetch(`/api/clientes/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, telefono, banco }),
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || "No se pudo guardar el cliente.");
            }

            limpiarFormularioCliente();
            await cargarDatosMariaDB();
            mostrarModulo("clientes");
        } catch (error) {
            alert(error.message);
        }
    });
}

// ==========================================
// SISTEMA DE PRÉSTAMOS
// ==========================================

let prestamoActual = null;
let pagosRegistrados = [];


// ------------------------------------------
// FORMATEAR DINERO
// ------------------------------------------

function formatoDinero(valor) {

    return new Intl.NumberFormat(
        "es-MX",
        {
            style: "currency",
            currency: "MXN"
        }
    ).format(valor);

}


// ------------------------------------------
// FORMATEAR FECHA
// ------------------------------------------

function formatoFecha(fecha) {

    return fecha.toLocaleDateString(
        "es-MX",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


// ------------------------------------------
// CALCULAR PRÉSTAMO
// ------------------------------------------

async function generarPrestamo() {

    const cliente =
        document.getElementById(
            "clientePrestamo"
        ).value;

    const monto =
        parseFloat(
            document.getElementById(
                "montoPrestamo"
            ).value
        );

    const porcentaje =
        parseFloat(
            document.getElementById(
                "porcentaje"
            ).value
        );

    const periodicidad =
        document.getElementById(
            "periodicidad"
        ).value;

    const numeroPagos =
        parseInt(
            document.getElementById(
                "numeroPagos"
            ).value
        );

    const fechaInicioValor =
        document.getElementById(
            "fechaInicio"
        ).value;


    // --------------------------------------
    // VALIDACIONES
    // --------------------------------------

    if (!cliente) {

        alert(
            "Selecciona un cliente."
        );

        return;
    }


    if (
        !monto ||
        monto <= 0
    ) {

        alert(
            "Ingresa un monto válido."
        );

        return;
    }


    if (
        isNaN(porcentaje) ||
        porcentaje < 0
    ) {

        alert(
            "Ingresa un porcentaje válido."
        );

        return;
    }


    if (
        !numeroPagos ||
        numeroPagos < 1
    ) {

        alert(
            "Ingresa un número válido de pagos."
        );

        return;
    }


    if (!fechaInicioValor) {

        alert(
            "Selecciona la fecha de inicio."
        );

        return;
    }


    // --------------------------------------
    // CÁLCULO
    // --------------------------------------

    const interesDecimal = porcentaje / 100;

    const incremento =
        interesDecimal *
        numeroPagos/ 2 *
        monto;


    const total =
        monto + incremento;


    const pagoPorQuincena =
        total / numeroPagos;


    // --------------------------------------
    // FECHA INICIAL
    // --------------------------------------

    const fechaInicio =
        new Date(
            fechaInicioValor +
            "T00:00:00"
        );


    // --------------------------------------
    // FECHA FINAL
    // --------------------------------------

    const fechaTermino =
        new Date(fechaInicio);


    if (
        periodicidad === "quincenal"
    ) {

        fechaTermino.setDate(
            fechaTermino.getDate() +
            (
                numeroPagos * 15
            )
        );

    } else {

        fechaTermino.setMonth(
            fechaTermino.getMonth() +
            numeroPagos
        );

    }


    // --------------------------------------
    // MOSTRAR RESUMEN
    // --------------------------------------

    document.getElementById(
        "resumenMonto"
    ).textContent =
        formatoDinero(monto);


    document.getElementById(
        "resumenInteres"
    ).textContent =
        formatoDinero(incremento);


    document.getElementById(
        "resumenTotal"
    ).textContent =
        formatoDinero(total);


    document.getElementById(
        "resumenPagos"
    ).textContent =
        numeroPagos;


    document.getElementById(
        "resumenPeriodo"
    ).textContent =
        formatoDinero(pagoPorQuincena);


    document.getElementById(
        "resumenPeriodicidad"
    ).textContent =
        periodicidad === "quincenal"
            ? "Quincenal"
            : "Mensual";


    document.getElementById(
        "resumenInicio"
    ).textContent =
        formatoFecha(
            fechaInicio
        );


    document.getElementById(
        "resumenTermino"
    ).textContent =
        formatoFecha(
            fechaTermino
        );


    // --------------------------------------
    // CALENDARIO
    // --------------------------------------

    generarCalendarioPagos(
        fechaInicio,
        numeroPagos,
        periodicidad,
        pagoPorQuincena
    );


    // --------------------------------------
    // GUARDAR PRÉSTAMO ACTUAL
    // --------------------------------------

    prestamoActual = {

        cliente: cliente,

        monto: monto,

        porcentaje: porcentaje,

        incremento: incremento,

        total: total,

        numeroPagos: numeroPagos,

        pago: pagoPorQuincena,

        pagoPeriodo: pagoPorQuincena,

        pagoBase: monto / numeroPagos,

        periodicidad: periodicidad,

        fechaInicio: fechaInicio,

        fechaTermino: fechaTermino

    };

    // --------------------------------------
    // GUARDAR EN LA BASE DE DATOS
    // (descuenta del fondo disponible)
    // --------------------------------------

    const boton = document.getElementById("btnGenerarPrestamo");
    boton.disabled = true;
    boton.textContent = "Generando...";

    try {
        const respuesta = await fetch("/api/prestamos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cliente_id: cliente,
                monto: monto,
                porcentaje: porcentaje,
                periodicidad: periodicidad,
                numero_pagos: numeroPagos,
                fecha_inicio: fechaInicioValor,
            }),
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo generar el préstamo.");
        }

        prestamoActual.id = resultado.prestamo_id;
        alert(
            `Préstamo generado correctamente.\n` +
            `Se descontaron ${formatoDinero(monto)} del fondo disponible.`
        );
        await cargarDatosMariaDB();
        cargarFondo();
    } catch (error) {
        alert(error.message);
    } finally {
        boton.disabled = false;
        boton.textContent = "Generar préstamo";
    }


    // --------------------------------------
    // MOSTRAR RESULTADO
    // --------------------------------------

    document
        .getElementById(
            "resultadoPrestamo"
        )
        .classList.remove(
            "oculto"
        );

}

// ==========================================
// REGISTRO E HISTORIAL DE PAGOS
// ==========================================

function prepararRegistroPagos() {

    const selector = document.getElementById("pagoNumero");
    const fecha = document.getElementById("fechaPago");
    const monto = document.getElementById("montoPago");

    if (!selector) {
        return;
    }

    selector.innerHTML = "<option value=\"\">Selecciona el pago</option>";

    for (let numero = 1; numero <= prestamoActual.numeroPagos; numero++) {
        const opcion = document.createElement("option");
        opcion.value = numero;
        opcion.textContent = `Pago ${numero}`;
        selector.appendChild(opcion);
    }

    fecha.value = new Date().toISOString().slice(0, 10);
    monto.value = "";
    actualizarResumenPago();
    renderizarHistorialPagos();
}

function actualizarResumenPago() {

    const selector = document.getElementById("pagoNumero");
    const monto = document.getElementById("montoPago");

    if (!selector || !prestamoActual) {
        return;
    }

    const pagosTotales = pagosRegistrados.reduce(
        (total, pago) => total + pago.total,
        0
    );
    const saldoAnterior = Math.max(
        prestamoActual.total - pagosTotales,
        0
    );
    const pagoSeleccionado = pagosRegistrados.find(
        (pago) => pago.numero === Number(selector.value)
    );
    const pagoActual = pagoSeleccionado
        ? pagoSeleccionado.total
        : (Number(monto.value) || 0);

    document.getElementById("saldoAnterior").textContent = formatoDinero(saldoAnterior);
    document.getElementById("pagoRealizado").textContent = formatoDinero(pagoActual);
    document.getElementById("nuevoSaldo").textContent = formatoDinero(
        Math.max(saldoAnterior - pagoActual, 0)
    );
}

function renderizarHistorialPagos() {

    const historial = document.getElementById("historialPagos");

    if (!historial) {
        return;
    }

    if (!pagosRegistrados.length) {
        historial.innerHTML = `
            <tr>
                <td colspan="6">No hay pagos registrados.</td>
            </tr>
        `;
        return;
    }

    historial.innerHTML = pagosRegistrados.map((pago) => `
        <tr>
            <td>${pago.numero}</td>
            <td>${pago.fecha}</td>
            <td>${formatoDinero(pago.base)}</td>
            <td>${formatoDinero(pago.incremento)}</td>
            <td>${formatoDinero(pago.total)}</td>
            <td>Registrado</td>
        </tr>
    `).join("");
}

function registrarPago() {

    if (!prestamoActual) {
        alert("Primero debes calcular el préstamo.");
        return;
    }

    const numero = Number(document.getElementById("pagoNumero").value);
    const fecha = document.getElementById("fechaPago").value;
    const monto = Number(document.getElementById("montoPago").value);
    const mensaje = document.getElementById("mensajePago");

    if (!numero || !fecha || !monto || monto <= 0) {
        mensaje.textContent = "Selecciona el pago, la fecha y un monto válido.";
        return;
    }

    if (pagosRegistrados.some((pago) => pago.numero === numero)) {
        mensaje.textContent = "Ese pago ya fue registrado.";
        return;
    }

    const saldo = prestamoActual.total - pagosRegistrados.reduce(
        (total, pago) => total + pago.total,
        0
    );

    if (monto > saldo) {
        mensaje.textContent = "El pago no puede superar el saldo pendiente.";
        return;
    }

    const base = monto * prestamoActual.monto / prestamoActual.total;
    const incremento = monto - base;

    pagosRegistrados.push({
        numero,
        fecha,
        base,
        incremento,
        total: monto
    });

    pagosRegistrados.sort((a, b) => a.numero - b.numero);
    document.querySelector(`#pagoNumero option[value="${numero}"]`).disabled = true;
    document.getElementById("pagoNumero").value = "";
    document.getElementById("montoPago").value = "";
    mensaje.textContent = "Pago registrado correctamente.";
    actualizarResumenPago();
    renderizarHistorialPagos();
}

const selectorPago = document.getElementById("pagoNumero");
const montoPago = document.getElementById("montoPago");

if (selectorPago) {
    selectorPago.addEventListener("change", actualizarResumenPago);
}

if (montoPago) {
    montoPago.addEventListener("input", actualizarResumenPago);
}

// ------------------------------------------
// CALENDARIO
// ------------------------------------------

function generarCalendarioPagos(
    fechaInicio,
    numeroPagos,
    periodicidad,
    pago
) {

    const tabla =
        document.getElementById(
            "tablaPagos"
        );


    tabla.innerHTML = "";


    for (
        let i = 1;
        i <= numeroPagos;
        i++
    ) {

        const fechaPago =
            new Date(fechaInicio);


        if (
            periodicidad === "quincenal"
        ) {

            fechaPago.setDate(
                fechaPago.getDate() +
                (
                    i * 15
                )
            );

        } else {

            fechaPago.setMonth(
                fechaPago.getMonth() +
                i
            );

        }


        const fila =
            document.createElement(
                "tr"
            );


        fila.innerHTML = `

            <td>
                ${i}
            </td>

            <td>
                ${formatoFecha(fechaPago)}
            </td>

            <td>
                ${formatoDinero(pago)}
            </td>

        `;


        tabla.appendChild(fila);

    }

}

// ==========================================
// GENERAR RECIBO PDF
// ==========================================

function generarReciboPDF() {

    if (!prestamoActual) {

        alert(
            "Primero debes calcular el préstamo."
        );

        return;
    }


    const {
        jsPDF
    } = window.jspdf;


    const doc =
        new jsPDF();


    const p =
        prestamoActual;


    // --------------------------------------
    // ENCABEZADO
    // --------------------------------------

    doc.setFontSize(20);

    doc.setFont(undefined, "bold");

    doc.text(
        "FINANCIERA",
        105,
        20,
        {
            align: "center"
        }
    );


    doc.setFontSize(14);

    doc.text(
        "RECIBO DE PRÉSTAMO",
        105,
        30,
        {
            align: "center"
        }
    );


    doc.setFontSize(10);

    doc.setFont(undefined, "normal");

    doc.text(
        "Documento de condiciones del préstamo",
        105,
        38,
        {
            align: "center"
        }
    );


    // --------------------------------------
    // INFORMACIÓN
    // --------------------------------------

    let y = 55;


    doc.setFontSize(11);

    doc.setFont(undefined, "bold");

    doc.text(
        "Cliente:",
        20,
        y
    );


    doc.setFont(undefined, "normal");

    doc.text(
        p.cliente,
        60,
        y
    );


    y += 10;


    doc.setFont(undefined, "bold");

    doc.text(
        "Fecha de inicio:",
        20,
        y
    );


    doc.setFont(undefined, "normal");

    doc.text(
        formatoFecha(
            p.fechaInicio
        ),
        60,
        y
    );


    y += 10;


    doc.setFont(undefined, "bold");

    doc.text(
        "Fecha de término:",
        20,
        y
    );


    doc.setFont(undefined, "normal");

    doc.text(
        formatoFecha(
            p.fechaTermino
        ),
        60,
        y
    );


    // --------------------------------------
    // CONDICIONES
    // --------------------------------------

    y += 20;


    doc.setFont(undefined, "bold");

    doc.text(
        "CONDICIONES DEL PRÉSTAMO",
        20,
        y
    );


    y += 10;


    doc.setFont(undefined, "normal");

    doc.text(
        "Monto prestado:",
        20,
        y
    );

    doc.text(
        formatoDinero(p.monto),
        100,
        y
    );


    y += 8;


    doc.text(
        "Total a pagar:",
        20,
        y
    );

    doc.text(
        formatoDinero(
            p.total
        ),
        100,
        y
    );


    y += 8;


    doc.text(
        "Periodicidad:",
        20,
        y
    );

    doc.text(
        p.periodicidad === "quincenal"
            ? "Quincenal"
            : "Mensual",
        100,
        y
    );


    y += 8;


    doc.text(
        "Número de pagos:",
        20,
        y
    );

    doc.text(
        String(p.numeroPagos),
        100,
        y
    );


    y += 8;


    doc.text(
        "Pago por periodo:",
        20,
        y
    );

    doc.text(
        formatoDinero(
            p.pago
        ),
        100,
        y
    );


    // --------------------------------------
    // CALENDARIO
    // --------------------------------------

    y += 20;


    doc.setFont(undefined, "bold");

    doc.text(
        "CALENDARIO DE PAGOS",
        20,
        y
    );


    y += 10;


    doc.setFont(undefined, "bold");

    doc.text(
        "Pago",
        20,
        y
    );

    doc.text(
        "Fecha",
        60,
        y
    );

    doc.text(
        "Importe",
        120,
        y
    );


    y += 7;


    doc.setFont(undefined, "normal");


    for (
        let i = 1;
        i <= p.numeroPagos;
        i++
    ) {

        const fechaPago =
            new Date(
                p.fechaInicio
            );


        if (
            p.periodicidad ===
            "quincenal"
        ) {

            fechaPago.setDate(
                fechaPago.getDate() +
                (
                    i * 15
                )
            );

        } else {

            fechaPago.setMonth(
                fechaPago.getMonth() +
                i
            );

        }


        doc.text(
            String(i),
            20,
            y
        );


        doc.text(
            formatoFecha(
                fechaPago
            ),
            60,
            y
        );


        doc.text(
            formatoDinero(
                p.pago
            ),
            120,
            y
        );


        y += 7;


        // Nueva página si es necesario

        if (
            y > 275 &&
            i < p.numeroPagos
        ) {

            doc.addPage();

            y = 20;

        }

    }


    // --------------------------------------
    // PIE
    // --------------------------------------

    y += 15;


    doc.setFontSize(9);

    doc.setFont(undefined, "normal");

    doc.text(
        "Este documento corresponde al resumen",
        105,
        y,
        {
            align: "center"
        }
    );


    y += 5;


    doc.text(
        "de las condiciones del préstamo.",
        105,
        y,
        {
            align: "center"
        }
    );


    // --------------------------------------
    // GUARDAR
    // --------------------------------------

    const nombreArchivo =
        `recibo-${p.cliente.replace(
            /\s+/g,
            "-"
        )}.pdf`;


    doc.save(
        nombreArchivo
    );

}

// =====================================================
// SISTEMA DE PAGOS
// =====================================================

let historialPagos = [];


// =====================================================
// FORMATO DE DINERO
// =====================================================

function dinero(valor) {

    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(valor);

}


// =====================================================
// CARGAR PAGOS DISPONIBLES
// =====================================================

function cargarPagosDisponibles() {

    const select = document.getElementById("pagoNumero");

    if (!select) return;

    select.innerHTML = `
        <option value="">
            Selecciona el pago
        </option>
    `;


    if (!prestamoActual) return;


    const numeroPagos = Number(
        prestamoActual.numeroPagos
    );


    for (let i = 1; i <= numeroPagos; i++) {

        const yaPagado = historialPagos.some(
            pago => pago.numero === i
        );


        if (!yaPagado) {

            const option =
                document.createElement("option");

            option.value = i;

            option.textContent =
                `Pago ${i} de ${numeroPagos}`;

            select.appendChild(option);

        }

    }

}


// =====================================================
// ACTUALIZAR MONTO DEL PAGO
// =====================================================

function actualizarMontoPago() {

    if (!prestamoActual) return;


    const montoPago =
        Number(prestamoActual.pagoPeriodo || 0);


    document.getElementById("montoPago").value =
        montoPago.toFixed(2);


    actualizarResumenPago();

}


// =====================================================
// ACTUALIZAR RESUMEN
// =====================================================

function actualizarResumenPago() {

    if (!prestamoActual) return;


    const montoTotal =
        Number(prestamoActual.total || 0);


    const totalPagado =
        historialPagos.reduce(
            (total, pago) =>
                total + Number(pago.monto),
            0
        );


    const pago =
        Number(
            document.getElementById("montoPago").value
        ) || 0;


    const saldo =
        Math.max(
            montoTotal - totalPagado,
            0
        );


    const nuevoSaldo =
        Math.max(
            saldo - pago,
            0
        );


    document.getElementById("saldoAnterior")
        .textContent = dinero(saldo);


    document.getElementById("pagoRealizado")
        .textContent = dinero(pago);


    document.getElementById("nuevoSaldo")
        .textContent = dinero(nuevoSaldo);

}


// =====================================================
// REGISTRAR PAGO
// =====================================================

function registrarPago() {

    if (!prestamoActual) {

        alert(
            "Primero debes crear o seleccionar un préstamo."
        );

        return;

    }


    const numero =
        Number(
            document.getElementById("pagoNumero").value
        );


    const fecha =
        document.getElementById("fechaPago").value;


    const monto =
        Number(
            document.getElementById("montoPago").value
        );


    if (!numero) {

        alert(
            "Selecciona el número de pago."
        );

        return;

    }


    if (!fecha) {

        alert(
            "Selecciona la fecha del pago."
        );

        return;

    }


    if (!monto || monto <= 0) {

        alert(
            "Ingresa un monto válido."
        );

        return;

    }


    const totalPrestamo =
        Number(prestamoActual.total);


    const totalPagado =
        historialPagos.reduce(
            (total, pago) =>
                total + Number(pago.monto),
            0
        );


    const saldoAnterior =
        Math.max(
            totalPrestamo - totalPagado,
            0
        );


    if (monto > saldoAnterior) {

        alert(
            `El pago no puede ser mayor al saldo pendiente de ${dinero(saldoAnterior)}.`
        );

        return;

    }


    const pagoBase =
        Number(prestamoActual.pagoBase || 0);


    const incremento =
        Math.max(
            monto - pagoBase,
            0
        );


    const nuevoPago = {

        numero: numero,

        fecha: fecha,

        monto: monto,

        pagoBase: pagoBase,

        incremento: incremento,

        saldoAnterior: saldoAnterior,

        nuevoSaldo:
            Math.max(
                saldoAnterior - monto,
                0
            )

    };


    historialPagos.push(nuevoPago);


    historialPagos.sort(
        (a, b) => a.numero - b.numero
    );


    mostrarHistorialPagos();

    cargarPagosDisponibles();

    limpiarFormularioPago();


    document.getElementById("mensajePago")
        .textContent =
        "✓ Pago registrado correctamente.";


    document.getElementById("mensajePago")
        .style.color = "#16a34a";


    actualizarResumenPago();

}


// =====================================================
// MOSTRAR HISTORIAL
// =====================================================

function mostrarHistorialPagos() {

    const tbody =
        document.getElementById("historialPagos");


    if (!tbody) return;


    if (historialPagos.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    No hay pagos registrados.
                </td>
            </tr>
        `;

        return;

    }


    tbody.innerHTML = "";


    historialPagos.forEach(pago => {

        const fila =
            document.createElement("tr");


        fila.innerHTML = `

            <td>
                ${pago.numero}
            </td>

            <td>
                ${formatoFechaPago(pago.fecha)}
            </td>

            <td>
                ${dinero(pago.pagoBase)}
            </td>

            <td>
                ${dinero(pago.incremento)}
            </td>

            <td>
                ${dinero(pago.monto)}
            </td>

            <td class="estado-pagado">
                ✓ Pagado
            </td>

        `;


        tbody.appendChild(fila);

    });

}


// =====================================================
// FORMATO FECHA
// =====================================================

function formatoFechaPago(fecha) {

    if (!fecha) return "";

    const partes = fecha.split("-");

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}


// =====================================================
// LIMPIAR FORMULARIO
// =====================================================

function limpiarFormularioPago() {

    document.getElementById("pagoNumero").value = "";

    document.getElementById("montoPago").value = "";

}

// =====================================================
// EVENTOS DE PAGOS
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const selectPago =
        document.getElementById("pagoNumero");

    const montoPago =
        document.getElementById("montoPago");

    const btnRegistrar =
        document.getElementById("btnRegistrarPago");

    const btnPDF =
        document.getElementById("btnReciboPago");


    if (selectPago) {

        selectPago.addEventListener(
            "change",
            actualizarMontoPago
        );

    }


    if (montoPago) {

        montoPago.addEventListener(
            "input",
            actualizarResumenPago
        );

    }


    if (btnRegistrar) {

        btnRegistrar.addEventListener(
            "click",
            registrarPago
        );

    }


    if (btnPDF) {

        btnPDF.addEventListener(
            "click",
            generarReciboPagoPDF
        );

    }

});

// =====================================================
// GENERAR RECIBO / ESTADO DE CUENTA PDF
// =====================================================

function generarReciboPagoPDF() {

    if (!prestamoActual) {

        alert(
            "No hay un préstamo seleccionado."
        );

        return;

    }


    if (historialPagos.length === 0) {

        alert(
            "Primero debes registrar al menos un pago."
        );

        return;

    }


    const { jsPDF } =
        window.jspdf;


    const pdf =
        new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });


    // ==========================================
    // DATOS DEL CLIENTE
    // ==========================================

    const cliente =
        prestamoActual.cliente ||
        "Cliente";


    const numeroCliente =
        prestamoActual.numeroCliente ||
        "N/A";


    const fechaActual =
        new Date();


    const fechaTexto =
        fechaActual.toLocaleDateString(
            "es-MX"
        );


    // ==========================================
    // ÚLTIMO PAGO
    // ==========================================

    const ultimoPago =
        historialPagos[
            historialPagos.length - 1
        ];


    // ==========================================
    // TOTALES
    // ==========================================

    const totalPrestamo =
        Number(prestamoActual.total);


    const totalPagado =
        historialPagos.reduce(
            (total, pago) =>
                total + Number(pago.monto),
            0
        );


    const saldoActual =
        Math.max(
            totalPrestamo - totalPagado,
            0
        );


    // ==========================================
    // ENCABEZADO
    // ==========================================

    pdf.setFontSize(22);

    pdf.setFont("helvetica", "bold");

    pdf.text(
        "RECIBO DIGITAL",
        15,
        20
    );


    pdf.setFontSize(12);

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        "COMPROBANTE DE PAGO",
        15,
        28
    );


    pdf.line(
        15,
        32,
        195,
        32
    );


    // ==========================================
    // DETALLE
    // ==========================================

    pdf.setFontSize(14);

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        "DETALLE",
        15,
        42
    );


    pdf.setFontSize(11);

    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.text(
        `Cliente: ${cliente}`,
        15,
        51
    );


    pdf.text(
        `No. cliente: ${numeroCliente}`,
        15,
        58
    );


    pdf.text(
        `Fecha de corte: ${fechaTexto}`,
        15,
        65
    );


    pdf.line(
        15,
        70,
        195,
        70
    );


    // ==========================================
    // PRÉSTAMO
    // ==========================================

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        "RESUMEN DEL PRÉSTAMO",
        15,
        80
    );


    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.text(
        `Monto original: ${dinero(prestamoActual.monto)}`,
        15,
        88
    );


    pdf.text(
        `Total del préstamo: ${dinero(totalPrestamo)}`,
        15,
        95
    );


    pdf.text(
        `Número de pagos: ${prestamoActual.numeroPagos}`,
        15,
        102
    );


    // ==========================================
    // PAGO REALIZADO
    // ==========================================

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        "PAGO REALIZADO",
        15,
        115
    );


    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.text(
        `Pago No.: ${ultimoPago.numero} de ${prestamoActual.numeroPagos}`,
        15,
        123
    );


    pdf.text(
        `Fecha: ${formatoFechaPago(ultimoPago.fecha)}`,
        15,
        130
    );


    pdf.text(
        `Monto pagado: ${dinero(ultimoPago.monto)}`,
        15,
        137
    );


    // ==========================================
    // SALDOS
    // ==========================================

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        "SALDO",
        15,
        150
    );


    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.text(
        `Saldo anterior: ${dinero(ultimoPago.saldoAnterior)}`,
        15,
        158
    );


    pdf.text(
        `Pago realizado: ${dinero(ultimoPago.monto)}`,
        15,
        165
    );


    pdf.setFont(
        "helvetica",
        "bold"
    );


    pdf.text(
        `NUEVO SALDO: ${dinero(saldoActual)}`,
        15,
        174
    );


    // ==========================================
    // PRÓXIMO PAGO
    // ==========================================

    const siguienteNumero =
        ultimoPago.numero + 1;


    if (
        siguienteNumero <=
        prestamoActual.numeroPagos
    ) {

        const siguientePago = obtenerFechaPago(
            siguienteNumero
        );


        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.text(
            "PRÓXIMO PAGO",
            15,
            187
        );


        pdf.setFont(
            "helvetica",
            "normal"
        );


        pdf.text(
            `Pago No.: ${siguienteNumero} de ${prestamoActual.numeroPagos}`,
            15,
            195
        );


        pdf.text(
            `Fecha: ${formatoFechaPDF(siguientePago)}`,
            15,
            202
        );


        pdf.text(
            `Monto: ${dinero(prestamoActual.pagoPeriodo)}`,
            15,
            209
        );

    } else {

        pdf.setFont(
            "helvetica",
            "bold"
        );

        pdf.text(
            "PRÉSTAMO LIQUIDADO",
            15,
            195
        );

    }


    // ==========================================
    // HISTORIAL
    // ==========================================

    let posicionY = 222;


    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.text(
        "HISTORIAL DE PAGOS",
        15,
        posicionY
    );


    posicionY += 8;


    pdf.setFontSize(9);


    pdf.text(
        "#",
        15,
        posicionY
    );

    pdf.text(
        "Fecha",
        30,
        posicionY
    );

    pdf.text(
        "Pago",
        70,
        posicionY
    );

    pdf.text(
        "Saldo",
        110,
        posicionY
    );

    pdf.text(
        "Estado",
        155,
        posicionY
    );


    posicionY += 6;


    historialPagos.forEach(
        pago => {

            pdf.setFont(
                "helvetica",
                "normal"
            );


            pdf.text(
                String(pago.numero),
                15,
                posicionY
            );


            pdf.text(
                formatoFechaPago(pago.fecha),
                30,
                posicionY
            );


            pdf.text(
                dinero(pago.monto),
                70,
                posicionY
            );


            pdf.text(
                dinero(pago.nuevoSaldo),
                110,
                posicionY
            );


            pdf.text(
                "PAGADO",
                155,
                posicionY
            );


            posicionY += 6;

        }
    );


    // ==========================================
    // TOTALES
    // ==========================================

    posicionY += 8;


    pdf.setFont(
        "helvetica",
        "bold"
    );


    pdf.text(
        `TOTAL PAGADO: ${dinero(totalPagado)}`,
        15,
        posicionY
    );


    posicionY += 7;


    pdf.text(
        `SALDO PENDIENTE: ${dinero(saldoActual)}`,
        15,
        posicionY
    );


    // ==========================================
    // PIE
    // ==========================================

    pdf.setFontSize(8);

    pdf.setFont(
        "helvetica",
        "italic"
    );


    pdf.text(
        "Este documento es un comprobante de pago.",
        15,
        280
    );


    pdf.text(
        "Conserve este comprobante para futuras referencias.",
        15,
        285
    );


    // ==========================================
    // GUARDAR
    // ==========================================

    const nombreArchivo =
        `recibo-pago-${cliente
            .replace(/[^a-zA-Z0-9]/g, "-")
            .toLowerCase()}.pdf`;


    pdf.save(nombreArchivo);

}

function obtenerFechaPago(numero, prestamo = prestamoActual) {

    const fecha = new Date(prestamo.fechaInicio);

    if (prestamo.periodicidad === "quincenal") {
        fecha.setDate(fecha.getDate() + (numero * 15));
    } else {
        fecha.setMonth(fecha.getMonth() + numero);
    }

    return fecha;
}

// ------------------------------------------
// DATOS DEL PRÉSTAMO PARA LOS PDF
// ------------------------------------------
// Se toman del préstamo seleccionado en el módulo
// "Registrar pagos" (base de datos) para que los PDF
// se actualicen con cada pago registrado.

function obtenerDatosPrestamoPDF() {

    if (!prestamoPagoSeleccionado) {
        return null;
    }

    const p = prestamoPagoSeleccionado;

    const pagos = (pagosExistentes || [])
        .slice()
        .sort((a, b) => a.numero_pago - b.numero_pago);

    const total = Number(p.total) || 0;
    const totalPagado = pagos.reduce(
        (acumulado, pago) => acumulado + Number(pago.monto),
        0
    );
    const fechaInicio = new Date(p.fecha_inicio + "T00:00:00");
    const fechaTermino = new Date(fechaInicio);

    if (p.periodicidad === "quincenal") {
        fechaTermino.setDate(fechaTermino.getDate() + (p.numero_pagos * 15));
    } else {
        fechaTermino.setMonth(fechaTermino.getMonth() + p.numero_pagos);
    }

    return {
        cliente: p.cliente || "Cliente",
        monto: Number(p.monto) || 0,
        total: total,
        numeroPagos: Number(p.numero_pagos) || 0,
        pago: p.numero_pagos ? total / p.numero_pagos : 0,
        periodicidad: p.periodicidad,
        fechaInicio: fechaInicio,
        fechaTermino: fechaTermino,
        pagos: pagos,
        totalPagado: totalPagado,
        saldo: Math.max(total - totalPagado, 0),
    };
}

function pagosPagadosSet() {

    return new Set(
        (pagosExistentes || []).map(
            (pago) => Number(pago.numero_pago)
        )
    );
}

function formatoFechaPDF(fecha) {

    if (!fecha) return "";

    const fechaObj = new Date(fecha);

    return fechaObj.toLocaleDateString(
        "es-MX"
    );

}

function verClienteColocado(boton) {

    const nombre = boton.closest("tr").cells[0].textContent.trim();
    const filaCliente = [...document.querySelectorAll("#tablaClientes tbody tr")]
        .find((fila) => fila.cells[1].textContent.trim() === nombre);

    if (filaCliente) {
        verCliente(filaCliente.querySelector(".btn-ver"));
    }
}

// ==========================================
// PDFs KREDITMX
// ==========================================

async function cargarLogoPDF() {

    const respuesta = await fetch("/img/logo-transparente.png");
    const blob = await respuesta.blob();

    return new Promise((resolve, reject) => {
        const lector = new FileReader();

        lector.onloadend = () => resolve(lector.result);
        lector.onerror = reject;
        lector.readAsDataURL(blob);
    });
}

async function prepararPDF(titulo, subtitulo) {

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    pdf.setFillColor(232, 241, 251);
    pdf.setDrawColor(201, 216, 232);
    pdf.roundedRect(12, 12, 186, 30, 5, 5, "FD");

    try {
        const logo = await cargarLogoPDF();
        pdf.addImage(logo, "PNG", 18, 20, 48, 11);
    } catch (error) {
        pdf.setTextColor(16, 42, 67);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("Kreditmx", 18, 29);
    }

    pdf.setTextColor(16, 42, 67);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(titulo, 76, 26);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(subtitulo, 76, 33);
    pdf.setTextColor(16, 42, 67);

    return pdf;
}

function tarjetaPDF(pdf, x, y, ancho, etiqueta, valor, destacada = false) {

    pdf.setFillColor(
        destacada ? 232 : 247,
        destacada ? 241 : 251,
        destacada ? 251 : 255
    );
    pdf.setDrawColor(201, 216, 232);
    pdf.roundedRect(x, y, ancho, 25, 4, 4, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(98, 125, 152);
    pdf.text(etiqueta, x + 7, y + 9);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(16, 42, 67);
    pdf.text(String(valor), x + 7, y + 19);
}

function tituloPDF(pdf, texto, y) {

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(29, 78, 137);
    pdf.text(texto, 15, y);
    pdf.setDrawColor(201, 216, 232);
    pdf.line(15, y + 3, 195, y + 3);
}

async function generarReciboPDF() {

    const p = obtenerDatosPrestamoPDF();

    if (!p) {
        alert("Selecciona un préstamo en el módulo Registrar pagos.");
        return;
    }

    const pagados = pagosPagadosSet();
    const pdf = await prepararPDF(
        "RECIBO DE PRÉSTAMO",
        "Resumen de condiciones y calendario de pagos"
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(p.cliente || "Cliente", 15, 56);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(98, 125, 152);
    pdf.text(`Inicio: ${formatoFecha(p.fechaInicio)}   |   Término: ${formatoFecha(p.fechaTermino)}`, 15, 63);
    pdf.setTextColor(16, 42, 67);

    tarjetaPDF(pdf, 15, 73, 42, "SALDO RESTANTE", formatoDinero(p.saldo), true);
    tarjetaPDF(pdf, 61, 73, 42, "TOTAL A PAGAR", formatoDinero(p.total));
    tarjetaPDF(pdf, 107, 73, 42, "PAGO POR PERIODO", formatoDinero(p.pago));
    tarjetaPDF(pdf, 153, 73, 42, "NÚMERO DE PAGOS", p.numeroPagos);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(29, 78, 137);
    pdf.text(`TOTAL PAGADO: ${dinero(p.totalPagado)}`, 15, 106);
    pdf.text(`SALDO PENDIENTE: ${dinero(p.saldo)}`, 105, 106);
    pdf.setTextColor(16, 42, 67);

    tituloPDF(pdf, "CALENDARIO DE PAGOS", 116);
    pdf.setFillColor(232, 241, 251);
    pdf.roundedRect(15, 122, 180, 9, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("PAGO", 22, 128);
    pdf.text("FECHA", 62, 128);
    pdf.text("IMPORTE", 125, 128);
    pdf.text("ESTADO", 163, 128);

    let y = 138;

    for (let i = 1; i <= p.numeroPagos; i++) {
        if (y > 275) {
            pdf.addPage();
            y = 22;
        }

        const pagado = pagados.has(i);
        const fechaPago = obtenerFechaPago(i, p);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(16, 42, 67);
        pdf.text(String(i), 22, y);
        pdf.text(formatoFecha(fechaPago), 62, y);
        pdf.text(formatoDinero(p.pago), 125, y);
        pdf.setTextColor(pagado ? 21 : 29, pagado ? 128 : 78, pagado ? 61 : 137);
        pdf.text(pagado ? "PAGADO" : "PENDIENTE", 163, y);
        pdf.setDrawColor(225, 232, 239);
        pdf.line(15, y + 4, 195, y + 4);
        y += 9;
    }

    pdf.setFontSize(8);
    pdf.setTextColor(98, 125, 152);
    pdf.text("Documento generado por Kreditmx", 15, 287);
    pdf.save(`kreditmx-prestamo-${(p.cliente || "cliente").replace(/\s+/g, "-")}.pdf`);
}

async function generarReciboPagoPDF() {

    const p = obtenerDatosPrestamoPDF();

    if (!p) {
        alert("Selecciona un préstamo en el módulo Registrar pagos.");
        return;
    }

    if (!p.pagos.length) {
        alert("Registra al menos un pago para generar el estado de cuenta.");
        return;
    }

    const cliente = p.cliente;
    const totalPrestamo = p.total;
    const totalPagado = p.totalPagado;
    const saldoActual = p.saldo;
    const ultimoPago = p.pagos[p.pagos.length - 1];
    const pdf = await prepararPDF(
        "ESTADO DE CUENTA",
        "Resumen claro de pagos y saldo actual"
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(cliente, 15, 56);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(98, 125, 152);
    pdf.text(`Corte: ${formatoFechaPDF(new Date())}   |   Pago más reciente: #${ultimoPago.numero_pago}`, 15, 63);
    pdf.setTextColor(16, 42, 67);

    tarjetaPDF(pdf, 15, 73, 55, "TOTAL DEL PRÉSTAMO", dinero(totalPrestamo));
    tarjetaPDF(pdf, 75, 73, 55, "TOTAL PAGADO", dinero(totalPagado), true);
    tarjetaPDF(pdf, 135, 73, 60, "SALDO ACTUAL", dinero(saldoActual), true);

    tituloPDF(pdf, "ÚLTIMO PAGO", 116);
    tarjetaPDF(pdf, 15, 123, 55, "PAGO", dinero(ultimoPago.monto));
    tarjetaPDF(pdf, 75, 123, 55, "FECHA", formatoFechaPDF(ultimoPago.fecha_pago));
    tarjetaPDF(pdf, 135, 123, 60, "SALDO DESPUÉS", dinero(ultimoPago.nuevo_saldo));

    tituloPDF(pdf, "HISTORIAL", 166);
    pdf.setFillColor(232, 241, 251);
    pdf.roundedRect(15, 172, 180, 9, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("PAGO", 22, 178);
    pdf.text("FECHA", 58, 178);
    pdf.text("IMPORTE", 100, 178);
    pdf.text("SALDO", 143, 178);
    pdf.text("ESTADO", 168, 178);

    let y = 188;

    p.pagos.forEach((pago) => {
        if (y > 275) {
            pdf.addPage();
            y = 22;
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(16, 42, 67);
        pdf.text(String(pago.numero_pago), 22, y);
        pdf.text(formatoFechaPDF(pago.fecha_pago), 58, y);
        pdf.text(dinero(pago.monto), 100, y);
        pdf.text(dinero(pago.nuevo_saldo), 143, y);
        pdf.setTextColor(21, 128, 61);
        pdf.text("PAGADO", 168, y);
        pdf.setDrawColor(225, 232, 239);
        pdf.line(15, y + 4, 195, y + 4);
        y += 9;
    });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(29, 78, 137);
    pdf.text(`SALDO PENDIENTE: ${dinero(saldoActual)}`, 15, Math.min(y + 12, 280));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(98, 125, 152);
    pdf.text("Documento generado por Kreditmx", 15, 287);
    pdf.save(`kreditmx-estado-cuenta-${cliente.replace(/\s+/g, "-")}.pdf`);
}

function renderizarClientes(clientes) {

    const tabla = document.getElementById("clientesRegistrados");

    if (!tabla) {
        return;
    }

    if (!clientes.length) {
        tabla.innerHTML = `<tr><td colspan="7">No hay clientes registrados.</td></tr>`;
        return;
    }

    tabla.innerHTML = clientes.map((cliente) => {
        const estadoClase = cliente.estado.toLowerCase().replace("_", "");
        const estadoTexto = cliente.estado === "EN_REVISION"
            ? "En revisión"
            : cliente.estado.toLowerCase().replace(/^./, (letra) => letra.toUpperCase());
        const parametros = new URLSearchParams({
            id: cliente.id,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            banco: cliente.banco,
        });

        return `
            <tr data-id="${cliente.id}">
                <td data-label="ID">#${String(cliente.id).padStart(3, "0")}</td>
                <td data-label="Cliente">${cliente.nombre}</td>
                <td data-label="Teléfono">${cliente.telefono}</td>
                <td data-label="Banco">${cliente.banco}</td>
                <td data-label="Estado"><span class="estado ${estadoClase}">${estadoTexto}</span></td>
                <td data-label="Fecha">${new Date(cliente.creado_en).toLocaleDateString("es-MX")}</td>
                <td data-label="Acciones">
                    <a class="btn-tabla btn-ver" href="/cliente?${parametros}">Ver</a>
                    <button type="button" class="btn-tabla btn-editar" onclick="editarCliente(this)">Modificar</button>
                    <button type="button" class="btn-tabla btn-eliminar" onclick="eliminarCliente(this)">Eliminar</button>
                </td>
            </tr>
        `;
    }).join("");
}// ==========================================
// FONDO DE INVERSION
// ==========================================

const dineroFondo = (valor) => formatoDinero(valor);

async function cargarFondo() {

    try {
        const respuesta = await fetch("/api/fondo");

        if (!respuesta.ok) {
            return;
        }

        const fondo = await respuesta.json();

        document.getElementById("fondoTotalInvertido").textContent = dineroFondo(fondo.total_invertido);
        document.getElementById("fondoPrestado").textContent = dineroFondo(fondo.prestado);
        document.getElementById("fondoDisponible").textContent = dineroFondo(fondo.fondo_disponible);
        document.getElementById("fondoInversionista").textContent = dineroFondo(fondo.para_inversionista);
        document.getElementById("fondoAdmin").textContent = dineroFondo(fondo.para_admin);

        document.getElementById("porcentajeInversionista").value = fondo.porcentajes.inversionista;
        document.getElementById("porcentajeFondo").value = fondo.porcentajes.fondo;
        document.getElementById("porcentajeAdmin").value = fondo.porcentajes.admin;

        await cargarInversiones();

    } catch (error) {
        console.warn("No se pudo cargar el fondo de inversión.", error);
    }

}

async function cargarInversiones() {

    try {
        const respuesta = await fetch("/api/inversiones");

        if (!respuesta.ok) {
            return;
        }

        const inversiones = await respuesta.json();
        const tabla = document.querySelector("#tablaInversiones tbody");

        tabla.innerHTML = inversiones.length
            ? inversiones.map((inversion) => `
                <tr>
                    <td data-label="Inversionista">${inversion.inversionista}</td>
                    <td data-label="Monto">${dinero(inversion.monto)}</td>
                    <td data-label="Fecha">${new Date(inversion.creado_en).toLocaleDateString("es-MX")}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="3">No hay inversiones registradas.</td></tr>`;

    } catch (error) {
        console.warn("No se pudieron cargar las inversiones.", error);
    }

}

async function registrarInversion() {

    const monto = parseFloat(document.getElementById("inversionMonto").value);
    const inversionista = document.getElementById("inversionistaNombre").value.trim() || "Inversionista";
    const mensaje = document.getElementById("mensajeFondo");

    if (!monto || monto <= 0) {
        mensaje.textContent = "Ingresa un monto de inversión válido.";
        mensaje.style.color = "#b91c1c";
        return;
    }

    try {
        const respuesta = await fetch("/api/inversiones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ monto, inversionista }),
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo registrar la inversión.");
        }

        document.getElementById("inversionMonto").value = "";
        mensaje.textContent = "Inversión registrada correctamente.";
        mensaje.style.color = "#15803d";
        cargarFondo();

    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.style.color = "#b91c1c";
    }

}

async function guardarPorcentajes() {

    const datos = {
        inversionista: parseFloat(document.getElementById("porcentajeInversionista").value),
        fondo: parseFloat(document.getElementById("porcentajeFondo").value),
        admin: parseFloat(document.getElementById("porcentajeAdmin").value),
    };
    const mensaje = document.getElementById("mensajeFondo");

    try {
        const respuesta = await fetch("/api/configuracion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos),
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudieron guardar los porcentajes.");
        }

        mensaje.textContent = "Porcentajes guardados correctamente.";
        mensaje.style.color = "#15803d";

    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.style.color = "#b91c1c";
    }

}
