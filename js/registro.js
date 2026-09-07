const formulario = document.getElementById("formRegistro");

const telefono = document.getElementById("telefono");
const cuenta = document.getElementById("cuenta");

const fotoFrente = document.getElementById("fotoFrente");
const fotoReverso = document.getElementById("fotoReverso");

const previewFrente = document.getElementById("previewFrente");
const previewReverso = document.getElementById("previewReverso");

const mensajeCuenta = document.getElementById("mensajeCuenta");

const btnEnviar = document.getElementById("btnEnviar");

const mensajeExito = document.getElementById("mensajeExito");


// =====================================================
// OBTENER TOKEN DEL LINK
// =====================================================

const parametros = new URLSearchParams(window.location.search);
const tokenOculto = document.querySelector('input[name="token"]');
const partesRuta = window.location.pathname.split("/").filter(Boolean);
const tokenRuta = partesRuta[0] === "registro" && partesRuta[1]
    ? partesRuta[1]
    : "";
const token = tokenOculto?.value || parametros.get("token") || tokenRuta;

console.log("Token del registro:", token);


// =====================================================
// SOLO NÚMEROS - TELÉFONO
// =====================================================

telefono.addEventListener("input", function () {

    this.value = this.value.replace(/\D/g, "");

    if (this.value.length > 10) {
        this.value = this.value.substring(0, 10);
    }

});


// =====================================================
// SOLO NÚMEROS - CUENTA
// =====================================================

cuenta.addEventListener("input", function () {

    this.value = this.value.replace(/\D/g, "");

    if (this.value.length > 16) {
        this.value = this.value.substring(0, 16);
    }


    if (this.value.length === 16) {

        mensajeCuenta.textContent =
            "Número de cuenta válido.";

        mensajeCuenta.style.color = "#16a34a";

    try {
        const respuesta = await fetch("/api/registro", {
            method: "POST",
            body: new FormData(formulario),
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo enviar el registro.");
        }

        formulario.classList.add("oculto");
        mensajeExito.classList.remove("oculto");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        alert(error.message);
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar registro";
    }


    if (!archivo.type.startsWith("image/")) {

        alert("Selecciona una imagen válida.");

        input.value = "";

        contenedor.innerHTML = "";

        return;
    }


    const lector = new FileReader();


    lector.onload = function (evento) {

        contenedor.innerHTML = `
            <img
                src="${evento.target.result}"
                alt="Vista previa"
            >
        `;

    };


    lector.readAsDataURL(archivo);
}


fotoFrente.addEventListener("change", function () {

    mostrarPreview(
        fotoFrente,
        previewFrente
    );

});


fotoReverso.addEventListener("change", function () {

    mostrarPreview(
        fotoReverso,
        previewReverso
    );

});


// =====================================================
// ENVIAR FORMULARIO
// =====================================================

formulario.addEventListener("submit", async function (evento) {

    evento.preventDefault();


    // VALIDAR TOKEN

    if (!token) {

        alert(
            "Este enlace de registro no es válido."
        );

        return;
    }


    // VALIDAR TELÉFONO

    if (telefono.value.length !== 10) {

        alert(
            "El número de teléfono debe contener 10 dígitos."
        );

        telefono.focus();

        return;
    }


    // VALIDAR CUENTA

    if (cuenta.value.length !== 16) {

        alert(
            "El número de cuenta debe contener exactamente 16 dígitos."
        );

        cuenta.focus();

        return;
    }


    // VALIDAR FOTOGRAFÍAS

    if (
        fotoFrente.files.length === 0 ||
        fotoReverso.files.length === 0
    ) {

        alert(
            "Debes subir el frente y reverso de tu identificación."
        );

        return;
    }


    // BOTÓN

    btnEnviar.disabled = true;

    btnEnviar.textContent =
        "Enviando registro...";


    /*
        POR AHORA SIMULAMOS EL ENVÍO.

        Posteriormente aquí conectaremos:

        try {
            const respuesta = await fetch("/api/registro", {
                method: "POST",
                body: new FormData(formulario),
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || "No se pudo enviar el registro.");
            }

            formulario.classList.add("oculto");
            mensajeExito.classList.remove("oculto");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            alert(error.message);
            btnEnviar.disabled = false;
            btnEnviar.textContent = "Enviar registro";
        }