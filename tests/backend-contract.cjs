const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const backend =
  process.env.DELIVERY_BACKEND_ROOT ||
  path.resolve(__dirname, "../../../Nuxt/restaurante-comandpos");
const realBackend = path.resolve(
  __dirname,
  "../../../Nuxt/restaurante-comandpos",
);
const { createRequire } = require("node:module");
const backendRequire = createRequire(path.join(realBackend, "package.json"));
const error = (o) => Object.assign(new Error(o.statusMessage), o);
function load(relative, db, extra = {}) {
  const file = path.join(backend, relative);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    require: (n) => {
      if (n === "zod") return backendRequire(n);
      if (n.endsWith("/rider-mobile-orders"))
        return load("server/utils/rider-mobile-orders.ts", db);
      if (n.endsWith("/rider-realtime")) return { emitRiderOrderUpdate() {} };
      throw Error("Missing dependency " + n);
    },
    defineEventHandler: (fn) => fn,
    dbClient: db,
    createError: error,
    getQuery: (e) => e.query || {},
    readBody: async (e) => e.body,
    Date,
    JSON,
    Math,
    Set,
    Map,
    console,
    ...extra,
  };
  vm.runInNewContext(code, context);
  return exports;
}
const event = (body = {}, query = {}) => ({
  context: { userId: 77 },
  body,
  query,
  node: { req: { io: { emit() {} } } },
});
const row = (rows) => ({ rows, rowCount: rows.length });
test("legacy availability rejects rider mutations without DB writes", async () => {
  const handler = load("server/api/restaurant/delivery/availability.post.ts", {
    query() {
      throw Error("Unexpected mutation");
    },
  }).default;
  await assert.rejects(
    handler(event({ accepting: true })),
    (e) => e.statusCode === 403,
  );
});
test("cashier controls reject authenticated rider before any operation", async () => {
  const helper = load("server/utils/rider-cashier-control.ts", {
    query: async () => row([{}]),
  });
  await assert.rejects(
    helper.assertNotRiderCashierControl(event()),
    (e) => e.statusCode === 403,
  );
});
test("mobile orders bind token owner, keep active orders without date cutoff and retain route stops", async () => {
  let sql = "",
    params;
  const db = {
    query: async (s, p) => {
      if (s.includes("SELECT accepting_orders"))
        return row([{ accepting_orders: false }]);
      sql = s;
      params = p;
      return row([]);
    },
  };
  const result = await load(
    "server/api/restaurant/delivery/my-orders.get.ts",
    db,
  ).default(event({}, { rider_use_id: 999, location_id: 3 }));
  assert.equal(params[0], 77);
  assert.equal(params[2], 3);
  assert.match(sql, /status_tracker_id IN \(3,4,5,6,12\)/);
  assert.match(sql, /OR a.delivery_route_id IN/);
  assert.equal(result.meta.accepting_orders, false);
});
test("history rejects invalid date ranges and scopes valid pagination to authenticated rider", async () => {
  let calls = [];
  const handler = load("server/api/restaurant/delivery/history.get.ts", {
    query: async (s, p) => {
      calls.push([s, p]);
      return row(Array.from({ length: 31 }, (_, id) => ({ id })));
    },
  }).default;
  await assert.rejects(
    handler(event({}, { from: "invalid", to: "2026-09-22" })),
    (e) => e.statusCode === 400,
  );
  assert.equal(calls.length, 0);
  const result = await handler(
    event(
      {},
      { from: "2026-09-01", to: "2026-09-22", offset: 30, rider_use_id: 999 },
    ),
  );
  assert.equal(calls[0][1][0], 77);
  assert.equal(result.data.length, 30);
  assert.equal(result.next_offset, 60);
  assert.match(calls[0][0], /COALESCE\(a.completed_at, history.happened_at\)/);
  assert.doesNotMatch(calls[0][0], /COALESCE\(a.completed_at,a.updated_at\)/);
});
test("finances separate customer debts, settlements, review and funds by currency", async () => {
  const params = [];
  const db = {
    query: async (s, p) => {
      params.push(p);
      return s.includes("FROM restaurant.rider_funds")
        ? row([
            { status: "open", currency_code: "DOP", amount: 500 },
            { status: "returned", currency_code: "DOP", amount: 900 },
            { status: "open", currency_code: "USD", amount: 20 },
          ])
        : row([
            { stage: "collection", currency_code: "DOP", balance: 100 },
            { stage: "settlement", currency_code: "DOP", balance: 250.25 },
            { stage: "review", currency_code: "DOP", balance: 30 },
          ]);
    },
  };
  const result = await load(
    "server/api/restaurant/delivery/my-finances.get.ts",
    db,
  ).default(event({}, { rider_use_id: 999, location_id: 3 }));
  assert.ok(params.every((p) => p[0] === 77));
  const dop = result.data.summaries.find((s) => s.currency_code === "DOP");
  assert.equal(dop.fund_to_return, 500);
  assert.equal(dop.pending_collection, 100);
  assert.equal(dop.pending_settlement, 250.25);
  assert.equal(dop.pending_review, 30);
  assert.equal(result.data.summaries.length, 2);
});
function completeDB(order) {
  const statements = [];
  const client = {
    query: async (sql, p) => {
      statements.push(sql);
      if (sql.includes("FROM restaurant.accounts a LEFT JOIN"))
        return row([order]);
      if (sql.includes("update_account_status_manual"))
        return row([{ success: true }]);
      return row([]);
    },
    release() {},
  };
  return { statements, connect: async () => client };
}
test("completion rejects another rider before updates", async () => {
  const db = completeDB({ assigned_driver_id: 88, status_tracker_id: 6 });
  await assert.rejects(
    load("server/api/restaurant/delivery/complete.post.ts", db).default(
      event({ account_id: 1 }),
    ),
    (e) => e.statusCode === 404,
  );
  assert.ok(!db.statements.some((s) => /^UPDATE/.test(s)));
  assert.ok(db.statements.includes("ROLLBACK"));
});
test("completion is idempotent and proof is required when enabled", async () => {
  let db = completeDB({ assigned_driver_id: 77, status_tracker_id: 7 });
  await load("server/api/restaurant/delivery/complete.post.ts", db).default(
    event({ account_id: 1 }),
  );
  assert.ok(
    !db.statements.some((s) => s.includes("update_account_status_manual")),
  );
  db = completeDB({
    assigned_driver_id: 77,
    status_tracker_id: 6,
    proof_required: true,
  });
  await assert.rejects(
    load("server/api/restaurant/delivery/complete.post.ts", db).default(
      event({ account_id: 1 }),
    ),
    (e) => e.statusCode === 422,
  );
  assert.ok(
    !db.statements.some((s) => s.includes("update_account_status_manual")),
  );
});
test("presence reports preserve cashier availability and replay request IDs idempotently", async () => {
  let prior = null;
  const statements = [];
  const client = {
    query: async (sql, p) => {
      statements.push(sql);
      if (sql.includes("FROM restaurant.delivery_riders r JOIN"))
        return row([
          {
            location_id: 3,
            use_fullname: "Rider",
            dispatch_status: "unavailable",
          },
        ]);
      if (sql.includes("SELECT metadata"))
        return prior ? row([{ metadata: prior }]) : row([]);
      if (sql.includes("INSERT INTO restaurant.rider_dispatch_events"))
        prior = JSON.parse(p[3]);
      return row([]);
    },
    release() {},
  };
  const handler = load(
    "server/api/restaurant/delivery/operations/presence.post.ts",
    { connect: async () => client },
  ).default;
  const e = event({ active: true, request_id: "unique-report-1" });
  await handler(e);
  await handler(e);
  assert.equal(
    statements.filter((s) => s.includes("UPDATE restaurant.delivery_riders"))
      .length,
    1,
  );
  assert.ok(
    statements
      .filter((s) => s.startsWith("UPDATE"))
      .every(
        (s) => !s.includes("accepting_orders") && !s.includes("is_active"),
      ),
  );
});
