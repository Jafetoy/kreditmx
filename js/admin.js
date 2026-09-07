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

        document.getElementById("linkGenerado").value = resultado.url;
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

    window.location.href =
    "/login";

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

        renderizarClientes(clientes);

        const tabla = document.querySelector("#tablaColocados tbody");
        tabla.innerHTML = prestamos.length
            ? prestamos.map((prestamo) => `
                <tr>
                    <td>${prestamo.nombre}</td>
                    <td>${dinero(prestamo.monto)}</td>
                    <td>${dinero(prestamo.saldo)}</td>
                    <td>${prestamo.periodicidad}</td>
                    <td><span class="estado aprobado">Activo</span></td>
                    <td><a class="btn-tabla btn-ver" href="/cliente?id=${prestamo.cliente_id}">Ver cliente</a></td>
                </tr>
            `).join("")
            : `<tr><td colspan="6">No hay préstamos activos.</td></tr>`;
    } catch (error) {
        console.warn("No se pudieron cargar los datos de MariaDB.", error);
    }
}

cargarDatosMariaDB();


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

    document.getElementById("clienteId").value = fila.cells[0].textContent.trim();
    document.getElementById("nombreCliente").value = fila.cells[1].textContent.trim();
    document.getElementById("telefonoCliente").value = fila.cells[2].textContent.trim();
    document.getElementById("bancoCliente").value = fila.cells[3].textContent.trim();

    mostrarModulo("clientes");
    document.getElementById("nombreCliente").focus();
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

function eliminarCliente(boton) {

    const fila = boton.closest("tr");
    const nombre = fila.cells[1].textContent.trim();

    if (!confirm(`¿Eliminar el registro de ${nombre}?`)) {
        return;
    }

    fila.remove();
}

const formularioCliente = document.getElementById("formularioCliente");

if (formularioCliente) {

    formularioCliente.addEventListener("submit", function (evento) {

        evento.preventDefault();

        const id = document.getElementById("clienteId").value;
        const nombre = document.getElementById("nombreCliente").value.trim();
        const telefono = document.getElementById("telefonoCliente").value.trim();
        const banco = document.getElementById("bancoCliente").value.trim();
        const tabla = document.querySelector("#tablaClientes tbody");

        if (id) {
            const fila = [...tabla.rows].find(
                (registro) => registro.cells[0].textContent.trim() === id
            );

            if (fila) {
                fila.cells[1].textContent = nombre;
                fila.cells[2].textContent = telefono;
                fila.cells[3].textContent = banco;
            }
        } else {
            const nuevoId = `#${String(tabla.rows.length + 1).padStart(3, "0")}`;
            const fila = document.createElement("tr");

            fila.innerHTML = `
                <td>${nuevoId}</td>
                <td>${nombre}</td>
                <td>${telefono}</td>
                <td>${banco}</td>
                <td><span class="estado pendiente">Pendiente</span></td>
                <td>${new Date().toLocaleDateString("es-MX")}</td>
                <td>
                    <button type="button" class="btn-tabla btn-ver" onclick="verCliente(this)">Ver</button>
                    <button type="button" class="btn-tabla btn-editar" onclick="editarCliente(this)">Modificar</button>
                    <button type="button" class="btn-tabla btn-eliminar" onclick="eliminarCliente(this)">Eliminar</button>
                </td>
            `;

            tabla.appendChild(fila);
        }

        limpiarFormularioCliente();
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

function calcularPrestamo() {

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
        round(total / numeroPagos);


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

    pagosRegistrados = [];
    historialPagos = [];
    prepararRegistroPagos();


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

function obtenerFechaPago(numero) {

    const fecha = new Date(prestamoActual.fechaInicio);

    if (prestamoActual.periodicidad === "quincenal") {
        fecha.setDate(fecha.getDate() + (numero * 15));
    } else {
        fecha.setMonth(fecha.getMonth() + numero);
    }

    return fecha;
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

    if (!prestamoActual) {
        alert("Primero debes calcular el préstamo.");
        return;
    }

    const p = prestamoActual;
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

    tarjetaPDF(pdf, 15, 73, 42, "MONTO PRESTADO", formatoDinero(p.monto));
    tarjetaPDF(pdf, 61, 73, 42, "TOTAL A PAGAR", formatoDinero(p.total), true);
    tarjetaPDF(pdf, 107, 73, 42, "PAGO POR PERIODO", formatoDinero(p.pago));
    tarjetaPDF(pdf, 153, 73, 42, "NÚMERO DE PAGOS", p.numeroPagos);

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

        const fechaPago = obtenerFechaPago(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(16, 42, 67);
        pdf.text(String(i), 22, y);
        pdf.text(formatoFecha(fechaPago), 62, y);
        pdf.text(formatoDinero(p.pago), 125, y);
        pdf.setTextColor(29, 78, 137);
        pdf.text("PENDIENTE", 163, y);
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

    if (!prestamoActual || !historialPagos.length) {
        alert("Calcula un préstamo y registra al menos un pago.");
        return;
    }

    const cliente = prestamoActual.cliente || "Cliente";
    const totalPrestamo = Number(prestamoActual.total);
    const totalPagado = historialPagos.reduce(
        (total, pago) => total + Number(pago.monto),
        0
    );
    const saldoActual = Math.max(totalPrestamo - totalPagado, 0);
    const ultimoPago = historialPagos[historialPagos.length - 1];
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
    pdf.text(`Corte: ${formatoFechaPDF(new Date())}   |   Pago más reciente: #${ultimoPago.numero}`, 15, 63);
    pdf.setTextColor(16, 42, 67);

    tarjetaPDF(pdf, 15, 73, 55, "TOTAL DEL PRÉSTAMO", dinero(totalPrestamo));
    tarjetaPDF(pdf, 75, 73, 55, "TOTAL PAGADO", dinero(totalPagado), true);
    tarjetaPDF(pdf, 135, 73, 60, "SALDO ACTUAL", dinero(saldoActual), true);

    tituloPDF(pdf, "ÚLTIMO PAGO", 116);
    tarjetaPDF(pdf, 15, 123, 55, "PAGO", dinero(ultimoPago.monto));
    tarjetaPDF(pdf, 75, 123, 55, "FECHA", formatoFechaPDF(ultimoPago.fecha));
    tarjetaPDF(pdf, 135, 123, 60, "SALDO DESPUÉS", dinero(ultimoPago.nuevoSaldo));

    tituloPDF(pdf, "HISTORIAL", 166);
    pdf.setFillColor(232, 241, 251);
    pdf.roundedRect(15, 172, 180, 9, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("PAGO", 22, 178);
    pdf.text("FECHA", 58, 178);
    pdf.text("IMPORTE", 100, 178);
    pdf.text("SALDO", 143, 178);

    let y = 188;

    historialPagos.forEach((pago) => {
        if (y > 275) {
            pdf.addPage();
            y = 22;
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(16, 42, 67);
        pdf.text(String(pago.numero), 22, y);
        pdf.text(formatoFechaPDF(pago.fecha), 58, y);
        pdf.text(dinero(pago.monto), 100, y);
        pdf.text(dinero(pago.nuevoSaldo), 143, y);
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
            <tr>
                <td>#${String(cliente.id).padStart(3, "0")}</td>
                <td>${cliente.nombre}</td>
                <td>${cliente.telefono}</td>
                <td>${cliente.banco}</td>
                <td><span class="estado ${estadoClase}">${estadoTexto}</span></td>
                <td>${new Date(cliente.creado_en).toLocaleDateString("es-MX")}</td>
                <td>
                    <a class="btn-tabla btn-ver" href="/cliente?${parametros}">Ver</a>
                    <button type="button" class="btn-tabla btn-editar" onclick="editarCliente(this)">Modificar</button>
                    <button type="button" class="btn-tabla btn-eliminar" onclick="eliminarCliente(this)">Eliminar</button>
                </td>
            </tr>
        `;
    }).join("");
}