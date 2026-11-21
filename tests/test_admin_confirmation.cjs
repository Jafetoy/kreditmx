const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const adminSource = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin.js"),
    "utf8"
);
const helperStart = adminSource.indexOf("function mostrarConfirmacionSistema(");
const helperEnd = adminSource.indexOf("async function generarLink()", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "confirmation helpers must exist");
const helperSource = adminSource.slice(helperStart, helperEnd);

function makeSystemDialog() {
    const dialog = {
        open: false,
        showCount: 0,
        showModal() {
            this.open = true;
            this.showCount += 1;
        },
        close() {
            this.open = false;
        },
    };
    const message = { textContent: "" };
    const cancel = { onclick: null, focus() {} };
    const accept = { onclick: null, focus() {} };
    const elements = {
        kxActionConfirmDialog: dialog,
        kxActionConfirmMessage: message,
        kxActionConfirmCancel: cancel,
        kxActionConfirmAccept: accept,
    };
    return { dialog, message, cancel, accept, document: { getElementById: (id) => elements[id] } };
}

function loadConfirmation({ window = {}, document = { getElementById: () => null } } = {}) {
    const context = { window, document };
    vm.runInNewContext(
        `${helperSource}; this.confirmarAccion = confirmarAccion;`,
        context
    );
    return context.confirmarAccion;
}

test("uses the KreditMX confirmation dialog when available", async () => {
    const { document } = makeSystemDialog();
    const window = { KreditmxNotifications: { confirm: async () => false } };

    assert.equal(await loadConfirmation({ window, document })("Delete client?"), false);
});

test("shows the branded system dialog when the shared component is unavailable", async () => {
    const system = makeSystemDialog();
    const confirm = loadConfirmation({ document: system.document });
    const result = confirm("Withdraw gains?");

    assert.equal(system.dialog.showCount, 1);
    assert.equal(system.message.textContent, "Withdraw gains?");
    system.accept.onclick();
    assert.equal(await result, true);
});

test("cancelling the system dialog prevents the action", async () => {
    const system = makeSystemDialog();
    const result = loadConfirmation({ document: system.document })("Delete investment?");

    system.cancel.onclick();
    assert.equal(await result, false);
});

test("uses the branded system dialog when the shared component fails", async () => {
    const system = makeSystemDialog();
    const window = {
        KreditmxNotifications: {
            confirm: () => Promise.reject(new Error("dialog unavailable")),
        },
    };
    const result = loadConfirmation({ window, document: system.document })("Cancel loan?");

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(system.dialog.showCount, 1);
    system.accept.onclick();
    assert.equal(await result, true);
});
