const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(file, deps = {}, globals = {}) {
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(root, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (n) => {
      if (n in deps) return deps[n];
      throw Error("Missing dependency " + n);
    },
    Date,
    JSON,
    Math,
    Map,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    ...globals,
  });
  return exports;
}
const delivery = load("src/utils/delivery.ts");
const format = load("src/utils/format.ts", {}, { Intl });
const types = load("src/types/delivery.ts");
const order = (id, status, route = 10) => ({
  id,
  status_tracker_id: status,
  delivery_route_id: route,
  delivery_route_order: id,
});
test("route progress retains completed stops and a completed trip", () => {
  const orders = [order(1, 7), order(2, 7), order(3, 6)];
  let route = delivery.deriveRoutes(orders)[0];
  assert.equal(route.done, 2);
  assert.equal(route.stops.length, 3);
  assert.equal(route.active.length, 1);
  orders[2].status_tracker_id = 7;
  route = delivery.deriveRoutes(orders)[0];
  assert.equal(route.done, 3);
  assert.equal(route.closed, true);
});
test("multiple routes stay separate and in-transit route takes priority", () => {
  const routes = delivery.deriveRoutes([
    order(1, 5, 10),
    order(2, 6, 20),
    order(3, 7, 20),
  ]);
  assert.equal(routes[0].id, 20);
  assert.equal(routes[0].stops.length, 2);
  assert.equal(routes[1].stops.length, 1);
});
test("incidents remain active and cancelled state is never scheduled", () => {
  assert.equal(delivery.isActive(order(1, 12)), true);
  assert.equal(delivery.isActive(order(1, 10)), false);
  assert.match(types.STATUS_META[10].label, /Cancelada/);
  assert.equal(types.STATUS_META[5].label, "Asignada");
});
test("coordinates accept zero and reject missing, NaN and out-of-range values", () => {
  assert.equal(
    delivery.hasCoordinates({
      ...order(1, 6),
      delivery_lat: 0,
      delivery_lng: 0,
    }),
    true,
  );
  for (const [lat, lng] of [
    [null, 0],
    [91, 0],
    [0, 181],
    [NaN, 12],
  ])
    assert.equal(
      delivery.hasCoordinates({
        ...order(1, 6),
        delivery_lat: lat,
        delivery_lng: lng,
      }),
      false,
    );
});
test("totals preserve server amounts, cents and unknown amounts", () => {
  assert.equal(
    format.orderTotal({
      order_total: "1100.35",
      order_subtotal: 1000,
      delivery_cost: 100,
    }),
    1100.35,
  );
  assert.equal(
    format.orderTotal({ order_subtotal: 1000, delivery_cost: 100 }),
    null,
  );
  assert.equal(format.money(null), "Por confirmar");
  assert.match(format.money(100.25), /100[.,]25/);
  assert.equal(delivery.dueAmount({ amount_due: "0" }), 0);
  assert.equal(delivery.dueAmount({ rider_collection_amount: 50 }), null);
});
function syncHarness() {
  let owner = "rider-a",
    token = "token-a";
  let sent = [];
  let networkError = null;
  let pause = null;
  const state = {
    items: [],
    online: true,
    hydrated: true,
    flushing: false,
    setFlushing(v) {
      this.flushing = v;
    },
    setOnline(v) {
      this.online = v;
    },
    remove(id) {
      this.items = this.items.filter((i) => i.id !== id);
    },
    fail(id, error) {
      this.items = this.items.map((i) =>
        i.id === id ? { ...i, state: "failed", error } : i,
      );
    },
    enqueue(i) {
      this.items.push(i);
    },
  };
  const sync = load("src/services/sync.ts", {
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "./queryClient": {
      queryClient: { invalidateQueries: async () => {}, setQueryData() {} },
    },
    "./session": {
      currentScope: () => owner,
      sessionKey: (s) => ["delivery", s],
      ordersKey: (s) => ["delivery", s, "orders"],
    },
    "./delivery": {
      markDelivered: async (id, name, cfg) => {
        sent.push({ id, owner: cfg.deliveryScope });
        if (pause) await pause;
        if (networkError) throw networkError;
      },
      reportPresence: async (active, id, cfg) => {
        sent.push({ active, id, owner: cfg.deliveryScope });
        if (networkError) throw networkError;
      },
    },
    "@store/useSyncQueue": {
      useSyncQueue: { getState: () => state, subscribe: () => () => {} },
    },
    "@store/useAuthStore": { useAuthStore: { getState: () => ({ token }) } },
    "@store/useToastStore": { showToast() {} },
  });
  return {
    sync,
    state,
    sent,
    setOwner(v) {
      owner = v;
      token = "token-" + v;
    },
    setError(v) {
      networkError = v;
    },
    setPause(v) {
      pause = v;
    },
  };
}
function item(id, owner = "rider-a") {
  return {
    id,
    owner,
    kind: "markDelivered",
    accountId: Number(id),
    payload: { accountId: Number(id) },
    state: "pending",
    createdAt: Date.now(),
    label: id,
    attempts: 0,
  };
}
test("queue never replays legacy or another rider operations", async () => {
  const h = syncHarness();
  h.state.items = [item("1", null), item("2", "rider-b"), item("3")];
  await h.sync.flushQueue();
  assert.deepEqual(h.sent, [{ id: 3, owner: "rider-a" }]);
  assert.equal(h.state.items.length, 2);
});
test("HTTP conflicts remain actionable and stop subsequent operations", async () => {
  const h = syncHarness();
  h.state.items = [item("1"), item("2")];
  h.setError({ status: 409, message: "Reasignada" });
  await h.sync.flushQueue();
  assert.equal(h.state.items[0].state, "failed");
  assert.equal(h.state.items[0].error, "Reasignada");
  assert.equal(h.sent.length, 1);
  await h.sync.flushQueue();
  assert.equal(h.sent.length, 1);
});
test("network failure retains pending operation and a retry completes once", async () => {
  const h = syncHarness();
  h.state.items = [item("1")];
  h.setError({ message: "Offline" });
  await h.sync.flushQueue();
  assert.equal(h.state.items.length, 1);
  assert.equal(h.state.online, false);
  h.setError(null);
  await h.sync.flushQueue();
  assert.equal(h.state.items.length, 0);
  assert.equal(h.sent.length, 2);
});
test("session changes while a request is in flight stop subsequent replays", async () => {
  const h = syncHarness();
  h.state.items = [item("1"), item("2")];
  let resume;
  h.setPause(new Promise((resolve) => (resume = resolve)));
  const pending = h.sync.flushQueue();
  h.setOwner("rider-b");
  resume();
  await pending;
  assert.equal(h.sent.length, 1);
  assert.equal(h.state.items[0].id, "2");
});
test("pending delivery shows completion date only for its owner", () => {
  const h = syncHarness();
  const source = [order(1, 6)];
  const queue = [item("1")];
  const own = h.sync.applyPending(source, queue, "rider-a")[0];
  assert.equal(own.status_tracker_id, 7);
  assert.ok(own.completed_at);
  assert.equal(own.pending_sync, true);
  assert.equal(
    h.sync.applyPending(source, queue, "rider-b")[0].status_tracker_id,
    6,
  );
});
