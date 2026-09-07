const formulario = document.getElementById(
    "formularioRegistro"
);

formulario.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const datos = new FormData(formulario);

        const respuesta = await fetch(
            "/api/registro",
            {
                method: "POST",
                body: datos
            }
        );

        const resultado =
            await respuesta.json();

        if (resultado.success) {

            formulario.style.display = "none";

            // Mostrar mensaje de éxito
            document.getElementById(
                "mensajeExito"
            ).style.display = "block";

        } else {

            alert(resultado.error);

        }

    }
);