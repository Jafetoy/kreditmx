// Session guard: a protected page restored from the browser back/forward
// cache (bfcache) must not let a logged-out user keep seeing the panel.
// The server already redirects on a fresh request; this closes the bfcache
// gap where no network request happens at all.
(function () {
    "use strict";

    var redirigiendo = false;

    function irAlLogin() {
        if (redirigiendo) return;
        redirigiendo = true;
        window.location.replace("/login");
    }

    function verificarSesion() {
        if (redirigiendo) return;
        fetch("/api/sesion", { credentials: "same-origin", cache: "no-store" })
            .then(function (respuesta) {
                if (!respuesta.ok || respuesta.redirected) {
                    irAlLogin();
                }
            })
            .catch(function () {
                // On a transient network error do not kick the user out;
                // the server-side guard still protects the next real request.
            });
    }

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") verificarSesion();
    });

    window.addEventListener("pageshow", function (evento) {
        if (evento.persisted) verificarSesion();
    });
})();
