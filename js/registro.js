const formulario = document.getElementById("formRegistro");
const telefono = document.getElementById("telefono");
const cuenta = document.getElementById("cuenta");
const curp = document.getElementById("curp");
const nombres = document.getElementById("nombre");
const apellidos = document.getElementById("apellidos");
const nombreCompleto = document.getElementById("nombreCompleto");

const fotoFrente = document.getElementById("fotoFrente");
const fotoReverso = document.getElementById("fotoReverso");
const comprobanteDomicilio = document.getElementById("comprobanteDomicilio");
const previewFrente = document.getElementById("previewFrente");
const previewReverso = document.getElementById("previewReverso");
const previewComprobante = document.getElementById("previewComprobante");

const mensajeCuenta = document.getElementById("mensajeCuenta");
const btnAnterior = document.getElementById("btnAnterior");
const btnContinuar = document.getElementById("btnContinuar");
const btnEnviar = document.getElementById("btnEnviar");
const mensajeExito = document.getElementById("mensajeExito");
const pasos = Array.from(document.querySelectorAll(".registro-paso"));
const indicadores = Array.from(document.querySelectorAll("[data-progress]"));

const parametros = new URLSearchParams(window.location.search);
const tokenOculto = document.querySelector('input[name="token"]');
const partesRuta = window.location.pathname.split("/").filter(Boolean);
const tokenRuta = partesRuta[0] === "registro" && partesRuta[1] ? partesRuta[1] : "";
const token = tokenOculto?.value || parametros.get("token") || tokenRuta;

let pasoActual = 1;
const TAMANO_MAXIMO = 5 * 1024 * 1024;

function mostrarPaso(numero) {
    pasoActual = numero;

    pasos.forEach((paso) => {
        paso.hidden = Number(paso.dataset.step) !== numero;
    });

    indicadores.forEach((indicador) => {
        const paso = Number(indicador.dataset.progress);
        indicador.classList.toggle("activo", paso === numero);
        indicador.classList.toggle("completo", paso < numero);
    });

    btnAnterior.hidden = numero === 1;
    btnContinuar.hidden = numero === pasos.length;
    btnEnviar.hidden = numero !== pasos.length;
    document.querySelector(".registro-form-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function validarPaso(numero) {
    const paso = pasos.find((elemento) => Number(elemento.dataset.step) === numero);
    const campos = Array.from(paso.querySelectorAll("input, select, textarea"));

    for (const campo of campos) {
        if (!campo.checkValidity()) {
            campo.reportValidity();
            campo.focus();
            return false;
        }
    }

    if (numero === 1 && curp.value.length !== 18) {
        curp.setCustomValidity("La CURP debe contener exactamente 18 caracteres.");
        curp.reportValidity();
        curp.setCustomValidity("");
        return false;
    }

    if (numero === 2 && cuenta.value.length !== 18) {
        cuenta.setCustomValidity("La CLABE debe contener exactamente 18 dígitos.");
        cuenta.reportValidity();
        cuenta.setCustomValidity("");
        return false;
    }

    return true;
}

telefono.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 10);
});

cuenta.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 18);
    const valida = this.value.length === 18;
    mensajeCuenta.textContent = valida
        ? "CLABE válida."
        : "Ingresa únicamente 18 números.";
    mensajeCuenta.style.color = valida ? "#187448" : "";
});

curp.addEventListener("input", function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18);
});

function mostrarPreview(input, contenedor) {
    const archivo = input.files[0];
    contenedor.replaceChildren();

    if (!archivo) {
        return;
    }

    if (archivo.size > TAMANO_MAXIMO) {
        alert("Cada archivo debe pesar como máximo 5 MB.");
        input.value = "";
        return;
    }

    if (archivo.type === "application/pdf") {
        contenedor.textContent = `Archivo seleccionado: ${archivo.name}`;
        return;
    }

    if (!archivo.type.startsWith("image/")) {
        alert("Selecciona una imagen o PDF válido.");
        input.value = "";
        return;
    }

    const lector = new FileReader();
    lector.onload = function (evento) {
        const imagen = document.createElement("img");
        imagen.src = evento.target.result;
        imagen.alt = `Vista previa de ${archivo.name}`;
        contenedor.appendChild(imagen);
    };
    lector.readAsDataURL(archivo);
}

fotoFrente.addEventListener("change", () => mostrarPreview(fotoFrente, previewFrente));
fotoReverso.addEventListener("change", () => mostrarPreview(fotoReverso, previewReverso));
comprobanteDomicilio.addEventListener("change", () => mostrarPreview(comprobanteDomicilio, previewComprobante));

btnContinuar.addEventListener("click", () => {
    if (validarPaso(pasoActual)) {
        mostrarPaso(Math.min(pasoActual + 1, pasos.length));
    }
});

btnAnterior.addEventListener("click", () => {
    mostrarPaso(Math.max(pasoActual - 1, 1));
});

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    if (!validarPaso(pasoActual)) {
        return;
    }

    if (!token) {
        alert("Este enlace de registro no es válido.");
        return;
    }

    if (telefono.value.length !== 10) {
        mostrarPaso(1);
        telefono.setCustomValidity("El teléfono debe contener exactamente 10 dígitos.");
        telefono.reportValidity();
        telefono.setCustomValidity("");
        return;
    }

    nombreCompleto.value = `${nombres.value.trim()} ${apellidos.value.trim()}`.trim();
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando expediente...";

    try {
        const respuesta = await fetch("/api/registro", {
            method: "POST",
            body: new FormData(formulario),
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo enviar el expediente.");
        }

        formulario.classList.add("oculto");
        document.querySelector(".registro-progreso")?.classList.add("oculto");
        mensajeExito.classList.remove("oculto");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        alert(error.message);
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = 'Enviar expediente <span aria-hidden="true">→</span>';
    }
});

mostrarPaso(1);
